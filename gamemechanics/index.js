'use strict';

var Geometry = require("geometry_noch");
var Messages = require("../messages");
var Util_tools = require("../util_tools");
var params = require("db_noch");
params.connect();
var Matter = require('matter-js/build/matter.js');
var elements = params.getParameter("elements");
var RecycleBin = require('./recycleBin');
var Context = require('./context');
var Garbage = require("./garbage");
var Player = require('./player');
var GameMap = require('./game_map');
var CollisionHandler = require('./collision_handler');
var Chemistry = require('./chemistry/chemistry_advanced');

var Engine = Matter.Engine,
    World = Matter.World,
    Bodies = Matter.Bodies,
    Body = Matter.Body,
    Composite = Matter.Composite;

var GameMechanics = function(playersEmitter) {
    this.websocketservice = {};
    this.intervals = [];

    this.recyclebin = new RecycleBin();
    var engine = Engine.create();

    engine.world.gravity.y = 0;
    engine.enableSleeping = true;

    this.isRunning = false;

    this.game_map = new GameMap(engine);

    this.context = new Context(engine, playersEmitter, this.recyclebin, this.websocketservice);
    new CollisionHandler(this.context);
    this.recyclebin.context = this.context;

    this.context.chemistry = new Chemistry(this.context);
};

GameMechanics.prototype = {
    createGarbage: function(garbageDensity) {

        var diameter = params.getParameter("gameDiameter");

        var quantity = garbageDensity * diameter * diameter / 4;

        this.createCertainAmountOfGarbage(quantity);
    },

    createCertainAmountOfGarbage: function(quantity) {
        var diameter = params.getParameter("gameDiameter");

        for (let j = 0; j < quantity; ++j) {
            var element = elements[Math.ceil(Math.random() * 10 - 1)];

            var OFFSET_BORDER = 40;
            var OFFSET_PLAYER = 1000;
            var position = this.game_map.getRandomPositionInside(diameter / 2, OFFSET_PLAYER,
                diameter / 2 - OFFSET_BORDER);

            var singleGarbage = new Garbage(position, this.context.engine, element,
                                            this.context.playersEmitter, this.context.chemistry);

            this.context.garbage.push(singleGarbage);
            this.context.garbageActive.push(singleGarbage.body);
            singleGarbage.body.number = j;
            this.subscribeToSleepEnd(singleGarbage.body);
            this.subscribeToSleepStart(singleGarbage.body);
        }
    },

    addPlayerStub: function(ws) {
        //TODO: change test parameters to normal
        var pos = this.game_map.getRandomPositionInside(850);
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

        this.context.websocketservice.sendToPlayer(Messages.greetingStub(pos), stub);
        return stub;
    },

    addPlayer: function(ws, position, index, resolution, name, color) {
        var player = new Player(ws, name, position, this.context.engine,
                                "C", this.context.playersEmitter,
                                this.websocketservice, this.context.chemistry);

        //var id = this.context.addToArray(this.context.players, player);
        this.context.players[index] = player;
        player.setResolution({ x: resolution.width, y: resolution.height });

        player.body.number = player.body.playerNumber = index;
        player.color = color;

        this.websocketservice
            .sendToPlayer(Messages.greeting(
                player.body.id, player.color, player.body.element),
            player);

        player.isReady = true;

        this.notifyAndInformNewPlayer(player);

        //Most player bodies never sleep, so they never throw
        //sleepEnd event so they can't be in garbageActive array
        this.context.garbageActive.push(player.body);
        this.subscribeToSleepStart(player.body);
        this.subscribeToSleepEnd(player.body);

        this.context.chemistry.updateGarbageConnectingPossibilityForPlayer(index);

        return player;
    },

    subscribeToSleepEnd: function(Body) {
        var self = this;
        Matter.Events.on(Body, 'sleepEnd', function(event) {
            var body = this;
            self.context.garbageActive.push(body);
            //console.log(body.id + ' woke');
        });
        //console.log("body with id " + Body.id + " is subscribed to sleep end.");
    },

    subscribeToSleepStart: function(Body) {
        var self = this;
        Matter.Events.on(Body, 'sleepStart', function(event) {
            var body = this;
            Util_tools.deleteFromArray(self.context.garbageActive, body);
            //console.log(body.id + ' slept');
        });
        //console.log("body with id " + Body.id + " is subscribed to sleep start.");
    },

    notifyAndInformNewPlayer: function(player) {
        for (let i = 0; i < this.context.players.length; ++i) {
            if (!(this.context.players[i] && player.body.number != i)) continue;
            try {
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
            } catch (e) {
                console.log('Caught ' + e.name + ': ' + e.message);
            }
        }
    },

    createMessage: function() {

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
    },

    sendToAllPlayers: function() {
        for (let j = 0; j < this.context.players.length; ++j) {
            if (this.context.players[j]) {
                var message = this.createMessage(j);
                if (!Util_tools.isEmpty(message)) this.websocketservice
                    .sendToPlayer(message, this.context.players[j]);
            }
        }
    },

    updatePlayersStats: function() {
        for (let i = 0; i < this.context.players.length; ++i) {
            if (this.context.players[i] && !this.context.players[i].isStub) {
                this.context.players[i].updatePreviousPosition();
            }
        }
    },

    sendAllBonds: function(object, playerNumber) {
        for (let i = 0; i < object.body.chemicalChildren.length; ++i) {
            if (!object.body.chemicalChildren[i]) continue;
            this.context.websocketservice.sendToPlayer(
                Messages.newBondOnScreen(object.body.id, object.body.chemicalChildren[i].id),
                this.context.players[playerNumber]);
        }
        if (object.body.chemicalParent) {
            this.context.websocketservice.sendToPlayer(
                Messages.newBondOnScreen(object.body.id, object.body.chemicalParent.id),
                this.context.players[playerNumber]);
        }
    },

    addPlayerWhoSee: function(object, playerNumber) {
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
                message = Messages.newParticleOnScreen(
                    pos, object.body.id, object.body.element);
        }

        this.context.websocketservice.sendToPlayer(message, this.context.players[playerNumber]);
        return true;
    },

    checkGarbageVisibility: function() {
        var objects = this.context.garbage.concat(this.game_map.border)
            .concat(this.context.freeProtons);
        objects = objects.filter(obj => {
            return obj;
        });
        for (let i = 0; i < objects.length; ++i) {
            for (let j = 0; j < this.context.players.length; ++j) {
                if (this.context.players[j] && this.context.players[j].isReady &&
                    Util_tools.inScreen.call(this.context.players[j], objects[i], 500)) {

                    var addedSuccessfully = this.addPlayerWhoSee(objects[i], j);
                }
            }
            var playersWhoSee = objects[i].body.playersWhoSee;
    
            let j = playersWhoSee.length;
            while (j--) {
                if (!this.context.players[playersWhoSee[j]]) {
                    playersWhoSee.splice(j, 1);
                } else if (!Util_tools.inScreen.call(this.context.players[playersWhoSee[j]], objects[i], 500)) {
                    this.context.websocketservice.sendToPlayer(
                        Messages.deleteParticle(objects[i].body.id),
                        this.context.players[playersWhoSee[j]]);
                    playersWhoSee.splice(j, 1);
                }
            }
        }
    },

    configureEmitter: function() {
        var self = this;

        this.context.playersEmitter.on('particle appeared', function(event) {
            self.checkGarbageVisibility();
        });

        this.context.playersEmitter.on('player died', function(event) {
            var playerId = self.context.players.indexOf(event.player);
            self.context.websocketservice.sendEverybody(Messages.deletePlayer(
                                                        event.player.body.id));
            var objects = self.context.garbage.concat(self.game_map.border)
                            .concat(self.context.freeProtons);
            objects = objects.filter(obj => {
                return obj;
            });
            for (let i = 0; i < objects.length; ++i) {
                Util_tools.deleteFromArray(objects[i].body.playersWhoSee, playerId);
            }
        });

        self.context.playersEmitter.on('particle died', function(event) {
            self.context.websocketservice.sendSpecificPlayers(
                Messages.deleteParticle(event.id), event.playersWhoSee);
        });

        this.context.playersEmitter.on('element changed', function(event) {
             self.context.websocketservice
                .sendSpecificPlayers(Messages.changeElementGarbage(event.body.id,
                                        event.body.element),
                                        event.body.playersWhoSee);

            self.context.chemistry.updateGarbageConnectingPossibility();
        });

        self.context.playersEmitter.on('bond created', function(event) {

            if (event.bc1.inGameType == 'garbage')
                self.synchronizePlayersWhoSee(event.bc1, event.bc2.playersWhoSee);
            if (event.bc2.inGameType == 'garbage')
                self.synchronizePlayersWhoSee(event.bc2, event.bc1.playersWhoSee);
            var playersWhoSee = event.bc1.inGameType == 'garbage' ?
                event.bc1.playersWhoSee : event.bc2.playersWhoSee;
            self.context.websocketservice.sendSpecificPlayers(
                Messages.newBondOnScreen(event.bc1.id, event.bc2.id),
                playersWhoSee);

            self.context.chemistry.updateGarbageConnectingPossibilityForPlayer(
                self.context.players.indexOf(event.p));
        });


        self.context.playersEmitter.on('decoupled', function(event) {

            self.context.websocketservice.sendSpecificPlayers(
                Messages.deleteBond(event.decoupledBodyA.id, event.decoupledBodyB.id),
                event.decoupledBodyA.playersWhoSee);

            self.context.websocketservice.sendSpecificPlayers(
                Messages.deleteBond(event.decoupledBodyA.id, event.decoupledBodyB.id),
                event.decoupledBodyB.playersWhoSee);
        });


        self.context.playersEmitter.on('became playerPart', function(event) {

        self.context.websocketservice.sendSpecificPlayers(
            Messages.particleBecamePlayerPart(event.garbageBody.id),
            event.garbageBody.playersWhoSee);
        });

        self.context.playersEmitter.on('became garbage', function(event) {

            let playersWhoSee = event.garbageBody.playersWhoSee;
            for (let i = 0; i < playersWhoSee.length; ++i) {
                if (self.context.players[playersWhoSee[i]]) {
                    self.context.websocketservice.sendToPlayer(
                        Messages.particleBecameGarbage(event.garbageBody.id,
                            self.context.chemistry.getColorForPlayer(
                                self.context.getMainObject(event.garbageBody), playersWhoSee[i])),
                        self.context.players[playersWhoSee[i]]);
                }
            }
            /*self.context.websocketservice.sendSpecificPlayers(
                { 'bg': event.garbageBody.id, 'p': Util_tools.ceilPosition(event.garbageBody.position) },
                event.garbageBody.playersWhoSee);*/
        });
    },

    synchronizePlayersWhoSee: function(target, mainArray) {
        for (let i = 0; i < mainArray.length; ++i) {
            if (target.playersWhoSee.indexOf(mainArray[i]) == -1) {
                this.addPlayerWhoSee(this.context.getMainObject(target), mainArray[i]);
            }
        }
    },

    updateActiveGarbage: function() {

        var particlesActive = this.context.garbageActive
            .concat(this.context.freeProtons.filter(particle => {
            return particle;
        }).map(particle => {
            return particle.body;
        }));

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
            if (garbageToSend.length)
                this.context.websocketservice.sendToPlayer(
                    Messages.activeGarbageUpdate(garbageToSend),
                    this.context.players[i]);
        }
    },

    run: function() {
        var self = this;

        this.intervals.push(setInterval(function() {
            if (!self.context.players.filter(player =>
                { return player; }).length) self.context.playersEmitter.emit('no players');

            Matter.Engine.update(self.context.engine, self.context.engine.timing.delta);
            self.recyclebin.empty();
            self.sendToAllPlayers();
            self.updateActiveGarbage();
            self.updatePlayersStats();
        }, 1000 / 60));

        this.intervals.push(setInterval(function() {
            self.checkGarbageVisibility();
        }, 1000));

        this.logMemoryUsage();

        this.isRunning = true;
        console.log('game loop started');
    },

    stop: function() {
        for (let i = 0; i < this.intervals.length; ++i) {
          clearInterval(this.intervals[i]);
        }
        this.isRunning = false;
        console.log('game loop stopped');
    },

    logGA: function() {
        var self = this;
        this.intervals.push(setInterval(function() {
            console.log('ga: ' + self.context.garbageActive.map(ga =>
                    { return ga.id }
                ).sort());
        }, 400));
    },

    logMemoryUsage: function() {
        var min = Infinity;
        var max = 0;
        let start = new Date().getTime();

        this.intervals.push(setInterval(function() {
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
};

module.exports = GameMechanics;