/**
 * Created by fatman on 21/02/16.
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

describe('garbageActive array contains all active particles' , function() {
    function makeIncorrectDeletationTest(numberOfGarbage, numberOfPlayers) {

        it('should not change when new player arrives', function(done) {
            var playersEmitter = new Emitter;
            var gamemechanics = new Gamemechanics(playersEmitter);
            var websocketserviceMock = sinon.mock(WebsocketService.prototype).object;
            gamemechanics.websocketservice
                = gamemechanics.context.websocketservice = websocketserviceMock;
            gamemechanics.configureEmitter();
            gamemechanics.createCertainAmountOfGarbage(numberOfGarbage);
            gamemechanics.run();
            this.timeout(30000);

            var interval1 = setInterval(function() {
                for (var i = 0; i < numberOfGarbage; ++i) {
                    Body.applyForce(gamemechanics.context.garbage[i].body,
                        gamemechanics.context.garbage[i].body.position,
                        Vector.create(1000, 1000));
                }
            }, 800);

            var interval2 = setInterval(function () {
                if (gamemechanics.context.garbageActive.length == numberOfGarbage) {
                    clearInterval(interval2);
                    for (i = 0; i < numberOfPlayers; ++i) {
                        var body = Bodies.circle(5 * i, 5 * i, 4);
                        World.addBody(gamemechanics.context.engine.world, body);
                        gamemechanics.subscribeToSleepEnd(body);
                        gamemechanics.subscribeToSleepStart(body);
                        Matter.Events.trigger(body, 'sleepStart', {});
                    }

                    clearInterval(interval1);
                    gamemechanics.stop();

                    assert.equal(gamemechanics.context.garbageActive.length, numberOfGarbage);
                    done();
                }
            }, 1000)
        });
    }

    for (var i = 0; i < Math.round(Math.random() * 2) + 1 ; ++i) {
        makeIncorrectDeletationTest(Math.round(Math.random() * 10) + 10, Math.round(Math.random() * 9) + 1)
    }
});