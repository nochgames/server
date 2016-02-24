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

    this.game_map = new GameMap(engine);
    
    this.colors = ["green", "blue", "yellow", "purple", "orange"];

    this.context = new Context(engine, playersEmitter, this.recyclebin, this.websocketservice);
    new CollisionHandler(this.context);
    this.recyclebin.context = this.context;
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

            var singleGarbage = new Garbage(position, this.context.engine, element, this.context.playersEmitter);

            this.context.garbage.push(singleGarbage);
            this.context.garbageActive.push(singleGarbage.body);
            singleGarbage.body.number = j;
            this.subscribeToSleepEnd(singleGarbage.body);
            this.subscribeToSleepStart(singleGarbage.body);
        }
    },

    addPlayer: function(ws) {
        var player = new Player(ws, this.game_map.getRandomPositionInside(0, 850),
                                this.context.engine, "C", this.context.playersEmitter,
                                this.websocketservice);

        var id = this.context.addToArray(this.context.players, player);

        player.body.number = player.body.playerNumber = id;
        player.color = this.colors[Math.ceil(Math.random() * 4)];

        this.websocketservice
            .sendToPlayer(Messages.greeting(
                player.body.id, player.color, player.body.element),
            player);

        this.context.players[id] = player;
        player.isReady = true;

        this.notifyAndInformNewPlayer(player);

        this.subscribeToSleepStart(player.body);
        this.subscribeToSleepEnd(player.body);

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
                if (Math.abs(player.previousPosition.x - player.body.position.x) > 1 ||
                    Math.abs(player.previousPosition.y - player.body.position.y) > 1) {

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
            if (this.context.players[i]) {
                this.context.players[i].updatePreviousPosition();
            }
        }
    },

    addPlayerWhoSee: function(object, playerNumber) {
        if (object.body.playersWhoSee.indexOf(playerNumber) != -1) return false;
        object.body.playersWhoSee.push(playerNumber);

        var message;
        var pos = Util_tools.ceilPosition(object.body.position);

        switch (object.body.inGameType) {
            case 'garbage':
            case 'playerPart':
                message = Messages.newParticleOnScreen(
                    pos, object.body.id, object.body.element);
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
                    this.context.players[j].inScreen(objects[i], 500)) {

                    var addedSuccessfully = this.addPlayerWhoSee(objects[i], j);
                    if (addedSuccessfully) {
                        var currentBody = objects[i].body;

                        //TODO: make new system
                        /*while (currentBody.chemicalParent && addedSuccessfully) {
                            var secondBody = currentBody.chemicalParent;
    
                            if (currentBody.chemicalParent.inGameType != 'player') {
                                addedSuccessfully = this.addPlayerWhoSee(
                                    this.context.getMainObject(secondBody), j);
                            } else {
                                addedSuccessfully = false;
                            }
                            this.context.websocketservice.sendToPlayer(
                                Messages.newBondOnScreen(currentBody.id, secondBody.id),
                                this.context.players[j]);
                            currentBody = secondBody;
                        }*/
                    }
                }
            }
            var playersWhoSee = objects[i].body.playersWhoSee;
    
            let j = playersWhoSee.length;
            while (j--) {
                if (!this.context.players[playersWhoSee[j]]) {
                    playersWhoSee.splice(j, 1);
                } else if (!this.context.players[playersWhoSee[j]].inScreen(objects[i], 500)) {
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
            /*for (let i = 0; i < objects.length; ++i) {
                Util_tools.deleteFromArray(objects[i].body.playersWhoSee, playerId);
            }*/
            console.log('player died');
        });

        self.context.playersEmitter.on('particle died', function(event) {
            self.context.websocketservice.sendSpecificPlayers(
                Messages.deleteParticle(event.id), event.playersWhoSee);
        });

        this.context.playersEmitter.on('element changed', function(event) {
             self.context.websocketservice
                .sendSpecificPlayers(Messages.changeElementGarbage(event.body.id,
                                        event.body.element),
                                        event.body.playersWhoSee)
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

        });


        self.context.playersEmitter.on('decoupled', function(event) {
            var playersWhoSee = event.decoupledBodyB.inGameType != 'player' ?
                event.decoupledBodyB.playersWhoSee : event.decoupledBodyA.playersWhoSee;
            self.context.websocketservice.sendSpecificPlayers(
                Messages.deleteBond(event.decoupledBodyA.id, event.decoupledBodyB.id),
                playersWhoSee);

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
        var realPlayers = this.context.players.filter(player => {
            return player;
        });

        var particlesActive = this.context.garbageActive
            .concat(this.context.freeProtons.filter(particle => {
            return particle;
        }).map(particle => {
            return particle.body;
        }));

        for (let i = 0; i < realPlayers.length; ++i) {
            var garbageToSend = [];
            var playerIndex = this.context.players.indexOf(realPlayers[i]);
            for (let j = 0; j < particlesActive.length; ++j) {
                var realPlayerIndex = particlesActive[j].playersWhoSee
                    .indexOf(playerIndex);
                if (realPlayerIndex != -1) {
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
                    this.context.players[playerIndex]);
        }
    },

    run: function() {
        var self = this;
        this.intervals.push(setInterval(function() {
            Matter.Engine.update(self.context.engine, self.context.engine.timing.delta);
            self.recyclebin.empty();
            self.sendToAllPlayers();
            self.updatePlayersStats();
        }, 1000 / 60));

        this.intervals.push(setInterval(function() {
            self.updateActiveGarbage();

        }, 1000 / 60));

        this.intervals.push(setInterval(function() {
            self.checkGarbageVisibility();
            var unique = [];
            var numbers = self.context.garbage.map(gb => {
                if (gb) {
                    return gb.body.number;
                }
                return null;
            }).filter(gb => { return gb; });
            for (let i = 0; i < numbers.length; ++i) {
                if (unique.indexOf(numbers[i]) == -1) {
                    unique.push(numbers[i]);
                }
            }
            if (numbers.length != unique.length) {
                console.log(unique);
                console.log(numbers);
                throw new Error('Incorrect behaviour');
            }
        }, 1000));
    },

    stop: function() {
        for (let i = 0; i < this.intervals.length; ++i) {
          clearInterval(this.intervals[i]);
        }
    },

    logMemoryUsage: function() {
        var min = Infinity;
        var max = 0;
        let time = new Date();
        let sec = time.getSeconds();
        let minutes = time.getMinutes();

        setInterval(function() {
            console.log(`Server is active ${new Date().getMinutes() - minutes
                } minutes ${new Date().getSeconds() - sec} seconds`);
            var usage = process.memoryUsage().heapUsed;
            if (usage < min) min = usage;
            if (usage > max) max = usage;
            console.log(usage + ' (min: '
                + min + ', max: ' + max + ')');
        }, 25000);
    }
};

module.exports = GameMechanics;