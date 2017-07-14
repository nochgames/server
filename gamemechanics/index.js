'use strict';

const Messages = require("../messages");
const Util_tools = require("../util_tools");
const Matter = require('matter-js/build/matter.js');
const RecycleBin = require('./recycleBin');
const Context = require('./context');
const Garbage = require("./garbage");
const Player = require('./player');
const GameMap = require('./game_map');
const CollisionHandler = require('./collision_handler');
const Chemistry = require('./chemistry/chemistry_advanced');
const config = require('config-node');
const elements = config.game.chemistry.elements;
const portions = config.game.map.portions;
const DynamicBot = require('./DynamicBot');

const Engine = Matter.Engine,
    World = Matter.World,
    Bodies = Matter.Bodies,
    Body = Matter.Body,
    Composite = Matter.Composite;

class GameMechanics {

    constructor(playersEmitter) {
        this.websocketservice = {};
        this.intervals = [];

        this.playersToUpdateConnectionPossibility = [];

        this.recyclebin = new RecycleBin();
        var engine = Engine.create();

        engine.world.gravity.y = 0;
        engine.enableSleeping = true;

        this.isRunning = false;

        this.isFullSent = false;
        this.tooMuchC = false;

        this.context = new Context(engine, playersEmitter, this.recyclebin, this.websocketservice);
        new CollisionHandler(this.context);
        this.recyclebin.context = this.context;

        this.game_map = new GameMap(engine, this.context);

        this.context.chemistry = new Chemistry(this.context);
    }

    createGarbage(garbageDensity) {

        var diameter = this.game_map.radius * 2;

        var quantity = Math.floor(garbageDensity * Math.PI * diameter * diameter / 4);

        let maxElementsPossible = quantity + config.server.playersPerServer;
        let elementsLimit = Math.floor(Math.pow(this.game_map.gridSize, 2) / 1.5);
        if (quantity > 4 && maxElementsPossible > elementsLimit) {
            Util_tools.handleError(`An attempt to create ${quantity} elements
            while limit is ${elementsLimit - config.server.playersPerServer}`);
        }

        console.log(`creating ${quantity} elements`);

        //this.createRandomGarbage(quantity);
        this.createPortionsOfGarbage(quantity);
    }

    createRandomGarbage(quantity) {

        for (let j = 0; j < quantity; ++j) {
            let element = this.getRandomElement();

            let position = this.game_map
                .getRandomPositionOuter();

            this.createSingleGarbage(element, position, j);
        }
    }

    getRandomColor() {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++ ) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }

    createPortionsOfGarbage(quantity) {

        this.context.initialElementsQuantity.total =
            this.context.currentElementsQuantity.total = quantity;

        let i = 0;
        for (let key in portions) {
            let elementQuantity = Math.round(quantity / 100 * portions[key]);

            this.context.currentElementsQuantity[key] = 0;
            this.context.initialElementsQuantity[key] = elementQuantity;

            for (let j = 0; j < elementQuantity; ++j) {

                var position = this.game_map.getRandomPositionOuter();

                this.createSingleGarbage(key, position, i);
                ++i;
            }
        }
    }

    createSingleGarbage(element, position, number = this.context.garbage.length) {
        var singleGarbage = new Garbage(position, this.context.engine, element,
            this.context.playersEmitter, this.context.chemistry);

        this.context.garbage.push(singleGarbage);
        singleGarbage.body.number = number;

        this.processNewBody(singleGarbage.body);
    }

    getRandomElement() {
        return elements[Math.ceil(Math.random() * 10 - 1)];
    }

    getCertainPossibilityElement() {
        var key = Math.random() * 100;
        //TODO finish this function
    }

    addPlayerStub(ws) {

        if (!this.context.players.filter(player => { return player; }).length) {
            this.createBots();
        }

        //TODO: change test parameters to normal
        let pos = this.game_map.getPositionForPlayerStub();
        console.log(pos);
        var stub = {
            body: { position: pos, coefficient: 0.2 },
            ws: ws,
            isStub: true,
            resolution: {width: 0, height: 0 },
            isReady: true
        };

        stub.number = this.context.addToArray(
            this.context.players,
            stub
        );

        this.context.websocketservice.sendToPlayer(
            Messages.greetingStub(pos, this.game_map.borderPartLength,
                                this.game_map.borderPartHeight), stub);
        this.notifyStubAboutPlayers(stub);

        this.updateScoreBoard();
        return stub;
    }

    addPlayer(ws, position, index, resolution, name, color) {
        var player = new Player(
            ws, name, position, this.context.engine,
            config.game.defaultElement,
            this.context.playersEmitter, this.websocketservice,
            this.context.chemistry, color, index);

        this.context.players[index] = player;
        player.setResolution({ x: resolution.width, y: resolution.height });

        this.websocketservice
            .sendToPlayer(Messages.greeting(
                player.body.id, player.color, player.body.element),
            player);

        player.isReady = true;

        //this.notifyAndInformNewPlayer(player);
        this.notifyEverybodyAboutNewPlayer(player);
        //risky
        this.notifyStubAboutPlayers(player);

        //Most player bodies never sleep, so they never throw
        //sleepEnd event so they can't be in garbageActive array
        this.processNewBody(player.body);

        this.context.chemistry.updateGarbageConnectingPossibilityForPlayer(index);
        this.updateScoreBoard();

        return player;
    }

    addBot(name) {

        let bot = new DynamicBot(name,
            this.game_map.getRandomPositionInner(),
            this.context.engine, config.game.defaultElement,
            this.context.playersEmitter, this.context.websocketservice,
            this.context.chemistry, this.getRandomColor(), this.context);

        bot.setNumber(this.context.addToArray(
            this.context.players,
            bot
        ));

        bot.isReady = true;

        this.notifyEverybodyAboutNewPlayer(bot);

        this.processNewBody(bot.body);

        this.updateScoreBoard();

        return bot;
    }

    createBots() {
        for (let i = 0; i < config.game.botsQuantity; ++i) {
            this.addBot('PhysicsBot');
        }
    }

    processNewBody(body) {
        this.context.garbageActive.push(body);
        this.subscribeToSleepStart(body);
        this.subscribeToSleepEnd(body);
    }

    subscribeToSleepEnd(Body) {
        Matter.Events.on(Body, 'sleepEnd', event => {
            this.context.garbageActive.push(Body);
            //console.log(body.id + ' woke');
        });
        //console.log("body with id " + Body.id + " is subscribed to sleep end.");
    }

    subscribeToSleepStart(Body) {
        Matter.Events.on(Body, 'sleepStart', event => {
            Util_tools.deleteFromArray(this.context.garbageActive, Body);
            //console.log(body.id + ' slept');
        });
        //console.log("body with id " + Body.id + " is subscribed to sleep start.");
    }

    notifyStubAboutPlayers(stub) {
        for (let i = 0; i < this.context.players.length; ++i) {
            if (!this.context.players[i] || this.context.players[i].isStub ||
                i == stub.body.number) continue;
            this.websocketservice.sendToPlayer(Messages.newPlayer(
                this.context.players[i].body.id,
                this.context.players[i].color,
                this.context.players[i].body.element,
                Util_tools.ceilPosition(this.context.players[i].body.position)
                ),
                stub);
        }
    }

    notifyEverybodyAboutNewPlayer(player) {
        for (let i = 0; i < this.context.players.length; ++i) {
            if (!this.context.players[i]||
                i == player.body.number) continue;
            this.websocketservice.sendToPlayer(
                Messages.newPlayer(
                    player.body.id,
                    player.color,
                    player.body.element,
                    Util_tools.ceilPosition(player.body.position)
                ),
                this.context.players[i]);
        }
    }

    //TODO: delete notifyAndInformNewPlayer after tests
    notifyAndInformNewPlayer(player) {
        for (let i = 0; i < this.context.players.length; ++i) {
            if (!(this.context.players[i] &&
                player.body.number != i)) continue;
            this.websocketservice.sendToPlayer(
                Messages.newPlayer(
                    player.body.id,
                    player.color,
                    player.body.element,
                    Util_tools.ceilPosition(player.body.position)
                ),
                this.context.players[i]);
            this.websocketservice.sendToPlayer(
                Messages.newPlayer(
                    this.context.players[i].body.id,
                    this.context.players[i].color,
                    this.context.players[i].body.element,
                    Util_tools.ceilPosition(this.context.players[i].body.position)
                ),
                player);
        }
    }

    createMessage() {

        var response = {};

        var playersWhoMove =
            Util_tools.parseCoordinates(this.context.players.map(player => {
                if (!player.isStub && (
                    Math.abs(player.previousPosition.x - player.body.position.x) > 1 ||
                    Math.abs(player.previousPosition.y - player.body.position.y) > 1)) {

                    var pos = player.body.position;
                    return {id: player.body.id, x: Math.ceil(pos.x), y: Math.ceil(pos.y)};
                }
            }));

        if (playersWhoMove.length) response["players"] = playersWhoMove;

        return response;
    }

    updatePlayers() {
        for (let i = 0; i < this.context.players.length; ++i) {
            if (this.context.players[i] && !this.context.players[i].isStub) {
                this.context.players[i].update();
            }
        }
    }

    sendAllBonds(object, playerNumber) {
        for (let i = 0; i < object.body.chemicalChildren.length; ++i) {
            if (!object.body.chemicalChildren[i]) continue;
            this.context.websocketservice.sendToPlayer(
                Messages.newBondOnScreen(object.body.id,
                    object.body.chemicalChildren[i].id, object.body.chemicalChildren[i].bondType),
                this.context.players[playerNumber]);
        }
        if (object.body.chemicalParent) {
            this.context.websocketservice.sendToPlayer(
                Messages.newBondOnScreen(object.body.id,
                    object.body.chemicalParent.id, object.body.bondType),
                this.context.players[playerNumber]);
        }
    }

    addPlayerWhoSee(object, playerNumber) {
        if (object.body.playersWhoSee.indexOf(playerNumber) != -1) return false;
        object.body.playersWhoSee.push(playerNumber);

        var message;
        var pos = Util_tools.ceilPosition(object.body.position);

        switch (object.body.inGameType) {
            case 'playerPart':
                message = Messages.newAvailableParticleOnScreen(
                    pos, object.body.id, object.body.element, 'white');
                this.sendAllBonds(object, playerNumber);
                break;
            case 'garbage':
                message = Messages.newAvailableParticleOnScreen(
                    pos, object.body.id, object.body.element,
                    this.context.chemistry.getColorForPlayer(object, playerNumber)
                );
                this.sendAllBonds(object, playerNumber);
                break;
            case 'Border':
                message = Messages.newBorderOnScreen(
                    pos, object.body.id, object.body.angle.toFixed(3));
                break;
            case 'n':
            case 'p':
            case 'ph':
                message = Messages.newParticleOnScreen(
                    pos, object.body.id, object.body.element);
        }

        this.context.websocketservice.sendToPlayer(message, this.context.players[playerNumber]);
        return true;
    }

    updateScoreBoard(deadId = -1) {

        var scoreBoard = this.context.players.filter(player => {
            return player && !player.isStub && player.body.number != deadId;
        }).sort((playerA, playerB) => {
            return playerB.kills - playerA.kills;
        }).slice(0, 7).map(player => {
            return { name: player.name, kills: player.kills }
        });

        this.context.websocketservice.sendEverybody(Messages.scoreBoard(scoreBoard));
    }

    checkGarbageVisibility() {
        var objects = this.context.garbage.concat(this.context.border)
            .concat(this.context.freeProtons);
        objects = objects.filter(obj => {
            return obj;
        });
        for (let i = 0; i < objects.length; ++i) {
            for (let j = 0; j < this.context.players.length; ++j) {
                // inScreen is called on context for tests
                if (this.context.players[j] && this.context.players[j].isReady &&
                    this.context.inScreen(objects[i], this.context.players[j], 500)) {

                    var addedSuccessfully = this.addPlayerWhoSee(objects[i], j);
                    if (addedSuccessfully) {
                        //console.log("player number " + j + " now sees " + objects[i].body.id);
                    }
                }
            }
            var playersWhoSee = objects[i].body.playersWhoSee;
    
            let j = playersWhoSee.length;
            while (j--) {
                if (!this.context.players[playersWhoSee[j]]) {
                    playersWhoSee.splice(j, 1);
                    // inScreen is called on context for tests
                } else if (!this.context.inScreen(objects[i], this.context.players[playersWhoSee[j]], 500)) {
                    this.context.websocketservice.sendToPlayer(
                        Messages.deleteParticle(objects[i].body.id),
                        this.context.players[playersWhoSee[j]]);
                    playersWhoSee.splice(j, 1);
                }
            }
        }
    }

    configureEmitter() {

        this.context.playersEmitter.on('particle appeared', event => {
            this.checkGarbageVisibility();
        });

        this.context.playersEmitter.on('shot fired', event => {
            this.context.websocketservice.sendEverybody(Messages.playerShot(event.shid));
        });

        this.context.playersEmitter.on('murder', event => {

        });

        this.context.playersEmitter.on('player died', event => {
            var playerId = this.context.players.indexOf(event.player);
            this.context.websocketservice.sendEverybody(Messages.deletePlayer(
                                                        event.player.body.id));
            var objects = this.context.garbage.concat(this.context.border)
                            .concat(this.context.freeProtons);
            objects = objects.filter(obj => {
                return obj;
            });
            for (let i = 0; i < objects.length; ++i) {
                Util_tools.deleteFromArray(objects[i].body.playersWhoSee, playerId);
            }
            this.updateScoreBoard(playerId);
            console.log("player died " + event.player.body.id);
        });

        this.context.playersEmitter.on('particle died', event => {
            this.context.websocketservice.sendSpecificPlayers(
                Messages.deleteParticle(event.id), event.playersWhoSee);
        });

        this.context.playersEmitter.on('element deleted', event => {
            --this.context.currentElementsQuantity[event.element];
        });

        this.context.playersEmitter.on('element appeared', event => {
            ++this.context.currentElementsQuantity[event.element];
        });

        this.context.playersEmitter.on('element changed', event => {
            if (event.body.inGameType == 'player') {
                this.context.websocketservice.sendEverybody(
                    Messages.changeElementGarbage(
                        event.body.id,
                        event.body.element));

            } else {
                this.context.websocketservice
                    .sendSpecificPlayers(Messages.changeElementGarbage(
                                        event.body.id,
                                        event.body.element),
                                        event.body.playersWhoSee);
            }

            this.context.chemistry.updateGarbageConnectingPossibility();
        });

        this.context.playersEmitter.on('bond created', event => {

            /*if (event.bc1.inGameType == 'garbage')
                this.synchronizePlayersWhoSee(event.bc1, event.bc2.playersWhoSee);
            if (event.bc2.inGameType == 'garbage')
                this.synchronizePlayersWhoSee(event.bc2, event.bc1.playersWhoSee);*/
            let playersWhoSee = event.bc1.playersWhoSee.length > event.bc2.playersWhoSee.length ?
                event.bc1.playersWhoSee : event.bc2.playersWhoSee;
            this.context.websocketservice.sendSpecificPlayers(
                Messages.newBondOnScreen(event.bc1.id, event.bc2.id, event.t),
                playersWhoSee);

            let player = this.context.players.indexOf(event.p);

            if (!player.isBot && !player.isStub)
                this.addPlayerToUpdateConnectionPossibility(player)
        });


        this.context.playersEmitter.on('decoupled', event => {

            let playersWhoSee = event.decoupledBodyA.playersWhoSee;
            for (let i = 0; i < event.decoupledBodyB.playersWhoSee.length; ++i) {
                if (playersWhoSee.indexOf(event.decoupledBodyB.playersWhoSee[i]) == -1) {
                    playersWhoSee.push(event.decoupledBodyB.playersWhoSee[i]);
                }
            }

            //console.log("sending " + event.decoupledBodyA.id + " " +
            //            event.decoupledBodyB.id + " to  " + playersWhoSee);

            this.context.websocketservice.sendSpecificPlayers(
                Messages.deleteBond(event.decoupledBodyA.id, event.decoupledBodyB.id),
                playersWhoSee);

            /*this.context.websocketservice.sendSpecificPlayers(
                Messages.deleteBond(event.decoupledBodyA.id, event.decoupledBodyB.id),
                event.decoupledBodyB.playersWhoSee);*/

            let player = this.context.players.indexOf(event.p);

            if (!player.isBot && !player.isStub)
                this.addPlayerToUpdateConnectionPossibility(player)
        });


        this.context.playersEmitter.on('became playerPart', event => {

        this.context.websocketservice.sendSpecificPlayers(
            Messages.particleBecamePlayerPart(event.garbageBody.id),
            event.garbageBody.playersWhoSee);
        });

        this.context.playersEmitter.on('became garbage', event => {

            let playersWhoSee = event.garbageBody.playersWhoSee;
            for (let i = 0; i < playersWhoSee.length; ++i) {
                if (this.context.players[playersWhoSee[i]]) {
                    this.context.websocketservice.sendToPlayer(
                        Messages.particleBecameGarbage(event.garbageBody.id,
                            this.context.chemistry.getColorForPlayer(
                                this.context.getMainObject(event.garbageBody), playersWhoSee[i])),
                        this.context.players[playersWhoSee[i]]);
                }
            }
            /*this.context.websocketservice.sendSpecificPlayers(
                { 'bg': event.garbageBody.id, 'p': Util_tools.ceilPosition(event.garbageBody.position) },
                event.garbageBody.playersWhoSee);*/
        })
    }

    addPlayerToUpdateConnectionPossibility(index) {
        if (this.playersToUpdateConnectionPossibility.indexOf(index) == -1) {
            this.playersToUpdateConnectionPossibility.push(index);
        }
    }

    updateConnectionPossibilityGeneral() {
        for (let i = 0; i < this.playersToUpdateConnectionPossibility.length; ++i) {
            if (this.context.players[this.playersToUpdateConnectionPossibility[i]] &&
                !this.context.players[this.playersToUpdateConnectionPossibility[i]].isStub) {
                this.context.chemistry.updateGarbageConnectingPossibilityForPlayer(
                    this.playersToUpdateConnectionPossibility[i]);
            }
        }

        this.playersToUpdateConnectionPossibility = [];
    }

    synchronizePlayersWhoSee(target, mainArray) {
        for (let i = 0; i < mainArray.length; ++i) {
            if (target.playersWhoSee.indexOf(mainArray[i]) == -1) {
                this.addPlayerWhoSee(this.context.getMainObject(target), mainArray[i]);
            }
        }
    }

    updateActiveGarbage() {

        var particlesActive = this.context.garbageActive
            .concat(this.context.freeProtons.filter(particle => {
            return particle;
        }).map(particle => {
            return particle.body;
        }));

        var playersActive = this.createMessage().players;

        for (let i = 0; i < this.context.players.length; ++i) {
            if (!this.context.players[i]) continue;
            var garbageToSend = [];
            for (let j = 0; j < particlesActive.length; ++j) {
                var playerWhoSeeIndex = particlesActive[j].playersWhoSee
                    .indexOf(i);
                if (playerWhoSeeIndex != -1) {
                    var position = particlesActive[j].position;
                    if (position) {
                        position = Util_tools.ceilPosition(position);
                        garbageToSend.push(particlesActive[j].id);
                        garbageToSend.push(position.x);
                        garbageToSend.push(position.y);
                    }
                }
            }
            var message = Messages.activeGarbageUpdate(garbageToSend);
            if (playersActive) message.players = playersActive;
            if (garbageToSend.length || playersActive)
                this.context.websocketservice.sendToPlayer(
                    message, this.context.players[i]);
        }
    }

    sendToAllPlayers() {
        for (let j = 0; j < this.context.players.length; ++j) {
            if (this.context.players[j]) {
                var message = this.createMessage(j);
                if (!Util_tools.isEmpty(message)) this.websocketservice
                    .sendToPlayer(message, this.context.players[j]);
            }
        }
    }

    balanceElementsQuantity() {
        let elements = config.game.chemistry.elements;
        for (let i = 0; i < elements.length; ++i) {
            //console.log(`element ${elements[i]} init quantity ${this.context.initialElementsQuantity[elements[i]]}
            //            current quantity ${this.context.currentElementsQuantity[elements[i]]}`);
            while (this.context.initialElementsQuantity[elements[i]] >
                    this.context.currentElementsQuantity[elements[i]]) {
                this.createSingleGarbage(elements[i], this.game_map.getRandomPosition());
            }
            let elementsToDeleteNumber = this.context.currentElementsQuantity[elements[i]] -
                    this.context.initialElementsQuantity[elements[i]];
            if (elementsToDeleteNumber > 0) {
                console.log(`There are ${this.context.currentElementsQuantity[elements[i]] -
                    this.context.initialElementsQuantity[elements[i]]} more ${elements[i]} than allowed`);
                let freeGarbage = this.context.garbage.filter(
                    garbage => {return garbage.body.inGameType == 'garbage' && garbage.body.element == elements[i]});

                console.log(`found ${freeGarbage.length} elements`);
                let deletedElements = 0;
                while (freeGarbage.length && this.context.initialElementsQuantity[elements[i]] <
                        this.context.currentElementsQuantity[elements[i]]) {
                    this.context.recyclebin.prepareToDelete(freeGarbage[0].body);
                    this.context.playersEmitter.emit('particle died', { id: freeGarbage[0].body.id,
                        playersWhoSee: freeGarbage[0].body.playersWhoSee });

                    freeGarbage = freeGarbage.shift();
                    ++deletedElements;
                }

                if (elements[i] == 'C') {
                    //console.log(`There are ${this.context.currentElementsQuantity[elements[i]] -
                    //this.context.initialElementsQuantity[elements[i]]} more ${elements[i]} than allowed`);
                    if (this.tooMuchC && elementsToDeleteNumber == deletedElements) {
                        this.tooMuchC = false;
                    }
                    if (!this.tooMuchC && elementsToDeleteNumber != deletedElements) {
                        this.tooMuchC = true;
                        console.log('Too much C!');
                    }
                }
            }
            else if (elements[i] == 'C' && this.tooMuchC) {
                this.tooMuchC = false;
            }
        }
    }

    handlePlayersNumber() {
        let playersNumber = this.context.players.filter(player =>
        { return player && !player.isBot; }).length;

        if (!this.isFullSent && (playersNumber == config.server.playersPerServer || this.tooMuchC)) {
            this.context.playersEmitter.emit('is full');
            this.isFullSent = true;
        }

        if (!playersNumber) {
            this.checkGarbageVisibility();
            this.balanceElementsQuantity();
            this.context.playersEmitter.emit('no players');
        }

        if (this.isFullSent && (playersNumber < config.server.playersPerServer && !this.tooMuchC)) {
            this.context.playersEmitter.emit('is not full');
            this.isFullSent = false;
        }
    }

    run() {

        this.intervals.push(setInterval(() => {
            this.handlePlayersNumber();

            Matter.Engine.update(this.context.engine, this.context.engine.timing.delta);
            this.recyclebin.empty();
            this.updateActiveGarbage();
            this.updatePlayers();
        }, 1000 / config.game.updatesPerSec));

        this.intervals.push(setInterval(() => {
            this.checkGarbageVisibility();
            this.updateConnectionPossibilityGeneral();
            this.balanceElementsQuantity();
        }, 1000));

        this.logMemoryUsage();

        this.isRunning = true;
        console.log('game loop started');
    }

    stop() {
        for (let i = 0; i < this.intervals.length; ++i) {
          clearInterval(this.intervals[i]);
        }
        this.isRunning = false;
        console.log('game loop stopped');
    }

    logGA() {

        this.intervals.push(setInterval(() => {
            console.log('ga: ' + this.context.garbageActive.map(ga =>
                    { return ga.id }
                ).sort());
        }, 400));
    }

    logPlayerNumbers() {
        this.intervals.push(setInterval(() => {
            console.log("players: " + this.context.players.map(player => {
                    if (player) {
                        return player.body.playerNumber;
                    } else {
                        return null;
                    }
                }));
        }, 200));
    }

    logMemoryUsage() {
        let min = Infinity;
        let max = 0;
        let start = new Date().getTime();

        this.intervals.push(setInterval(() => {
            let now = new Date().getTime();
            let secondsPassed = (now - start) / 1000;

            console.log(`Server is active ${
            Math.floor(secondsPassed / 60) } minutes ${
                (secondsPassed % 60).toFixed(5)
                } seconds`);
            let usage = process.memoryUsage().heapUsed;
            if (usage < min) min = usage;
            if (usage > max) max = usage;
            console.log("Heap used: " + usage + ' (min: '
                + min + ', max: ' + max + ')');
        }, 30000));
    }
}

module.exports = GameMechanics;
