/**
 * Created by fatman on 21/02/16.
 */
    
'use strict';

var WebsocketService = require("../websocketservice/index");
var Gamemechanics = require('../gamemechanics/index');
var sinon = require('sinon');
var Context = require('../gamemechanics/context');
var assert = require('chai').assert;
var Messages = require("../messages/index");

var gamemechanics = new Gamemechanics({});
var Util_tools = {};
Util_tools.inScreen = sinon.stub();

var websocketservice = sinon.mock(WebsocketService.prototype);
gamemechanics.websocketservice = websocketservice;

describe('gamemechanics.checkGarbageVisibility', function() {

    function testCheckGarbageVisibility(particlesNumber, playersNumber, parentsNumber, isReady, inScreenValue, expected) {
        it('should send add to to playersWhoSee array every particle in screen,' +
            ' and all chemicalParents of every object too', function () {
            var context = new Context({}, {}, {}, websocketservice);
            for (let i = 0; i < particlesNumber; ++i) {
                var garbage = { body: { playersWhoSee: [] } };
                var currentGarbage = garbage.body;
                for (let j = 0; j < parentsNumber; ++j) {
                    currentGarbage.chemicalParent = {};
                    currentGarbage = currentGarbage.chemicalParent;
                }
                context.garbage.push(garbage);
            }
            var inScreen = sinon.stub();
            for (let i = 0; i < playersNumber; ++i) {
                context.players.push({ isReady: isReady, inScreen: inScreen });
            }
            websocketservice.sendToPlayer = sinon.stub();
            gamemechanics.addPlayerWhoSee = sinon.expectation.create('addPlayersWhoSee');
            gamemechanics.addPlayerWhoSee.exactly(expected);
            gamemechanics.context = context;
            inScreen.returns(inScreenValue);
            gamemechanics.addPlayerWhoSee.returns(true);
            gamemechanics.checkGarbageVisibility();
            gamemechanics.addPlayerWhoSee.verify();
        });
    }

    var particlesNumber = Math.round(Math.random() * 10) + 10;
    var playersNumber = Math.round(Math.random() * 10) + 9;
    var parentsNumber = Math.round(Math.random() * 3) + 2;

    testCheckGarbageVisibility(particlesNumber, playersNumber, 0, true, true, particlesNumber * playersNumber);
    testCheckGarbageVisibility(particlesNumber, playersNumber, 0, false, true, 0);
    testCheckGarbageVisibility(particlesNumber, playersNumber, 0, true, false, 0);
    testCheckGarbageVisibility(particlesNumber, playersNumber, parentsNumber, true, true, (particlesNumber *
                                (parentsNumber + 1)) * playersNumber);

    it('should inform players to delete garbage that just left the screen', function() {
        var playersWhoSeeQuantitiy = 10;
        var particlesNumber = 10;
        var playersNumber = 20;
        if (particlesNumber < playersWhoSeeQuantitiy) throw new Error(
            'Incorrect tset input data: playersWhoSeeQuantity is ' + playersWhoSeeQuantitiy +
            ' which is more than actual players(' + playersNumber + ')');

        websocketservice.sendToPlayer = sinon.stub();
        var context = new Context({}, {}, {}, websocketservice);

        var inScreen = sinon.stub();

        for (let i = 0; i < playersNumber; ++i) {
            context.players.push({ inScreen: inScreen });
        }

        for (let i = 0; i < particlesNumber; ++i) {
            var garbage = { body: { playersWhoSee: [], id: i } };
            for (let j = 0; j < playersWhoSeeQuantitiy; ++j) {
                garbage.body.playersWhoSee.push(j);
                websocketservice.sendToPlayer.withArgs(
                    Messages.deleteParticle(i), context.players[j]);
            }
            context.garbage.push(garbage);
        }

        gamemechanics.context = context;
        inScreen.returns(false);
        gamemechanics.checkGarbageVisibility();

        for (let i = 0; i < particlesNumber; ++i) {
            for (let j = 0; j < playersWhoSeeQuantitiy; ++j) {
                assert(websocketservice.sendToPlayer.withArgs(
                    Messages.deleteParticle(i), context.players[j]).called);
            }
        }

        for (let i = 0; i < particlesNumber; ++i) {
            assert(!context.garbage[i].body.playersWhoSee.length);
        }
    });

    it('should delete players who let the server', function() {
        var particlesNumber = 10;
        var playersWhoSeeQuantity = 9;

        var context = new Context({}, {}, {}, websocketservice);

        for (let i = 0; i < particlesNumber; ++i) {
            var garbage = { body: { playersWhoSee: [] } };
            for (let j = 0; j < playersWhoSeeQuantity; ++j) {
                garbage.body.playersWhoSee.push(j);
            }
            context.garbage.push(garbage);
        }

        gamemechanics.context = context;
        gamemechanics.checkGarbageVisibility();

        for (let i = 0; i < particlesNumber; ++i) {
            assert(!context.garbage[i].body.playersWhoSee.length);
        }
    })
});
