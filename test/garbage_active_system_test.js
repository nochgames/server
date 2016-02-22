/**
 * Created by fatman on 20/02/16.
 */
var WebSocket = new require('ws/lib/WebSocket');
var Gamemechanics = require('../gamemechanics');
var Emitter = require('events').EventEmitter;
var assert = require('chai').assert;
var sinon = require('sinon');
var WebsocketService = require("../websocketservice");

var Matter = require('matter-js/build/matter.js');
var Engine = Matter.Engine,
    World = Matter.World,
    Bodies = Matter.Bodies,
    Body = Matter.Body,
    Vector = Matter.Vector,
    Composite = Matter.Composite;

describe('Active garbage array should contain all moving bodies',
    function() {
        var playersEmitter = new Emitter;
        var gamemechanics = new Gamemechanics(playersEmitter);
        var websocketserviceMock = sinon.mock(WebsocketService.prototype).object;
        gamemechanics.websocketservice
            = gamemechanics.context.websocketservice = websocketserviceMock;
        gamemechanics.configureEmitter();
        gamemechanics.createGarbage(0.000008);
        gamemechanics.run();
        var allBodies = Composite.allBodies(gamemechanics.context.engine.world);

        it('should be empty when there is no movement', function() {
            assert.isAtLeast(gamemechanics.context.garbageActive.length, 0);
            gamemechanics.stop();
        });

        function makeAddingTest(number) {
            var playersEmitter = new Emitter;
            var gamemechanics = new Gamemechanics(playersEmitter);
            var websocketserviceMock = sinon.mock(WebsocketService.prototype).object;
            gamemechanics.websocketservice
                = gamemechanics.context.websocketservice = websocketserviceMock;
            gamemechanics.configureEmitter();
            gamemechanics.createCertainAmountOfGarbage(number);
            gamemechanics.run();
            var allBodies = Composite.allBodies(gamemechanics.context.engine.world);
            it('should contain all moving objects', function (done) {
                this.timeout(30000);
                var interval = setInterval(function () {
                    if (gamemechanics.context.garbageActive.length == 0)
                        for (var i = 0; i < number; ++i) {
                            Body.applyForce(allBodies[i], allBodies[i].position,
                                Vector.create(10, 10));
                        }
                    if (gamemechanics.context.garbageActive.length == number) {
                        clearInterval(interval);
                        gamemechanics.stop();
                        done();
                    }
                }, 1000)
            });
        }

        for (var i = 0; i < Math.round(Math.random() * 10) + 1; ++i) {
            makeAddingTest(Math.round(Math.random() * 100));
        }
    }
);