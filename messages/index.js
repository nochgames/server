/**
 * Created by fatman on 09/02/16.
 */

'use strict';

var API_NOCH = require("./api");

var Messages = {
    greeting: function(playerId, color, element) {
        var message = {};
        message[API_NOCH.getCode("self id")] = playerId;
        message[API_NOCH.getCode("color")] = color;
        message[API_NOCH.getCode("element")] = element;
        return message;
    },

    greetingStub: function(stubPosition, borderLength, borderHeight) {
        return {
            [API_NOCH.getCode("stub position")]: stubPosition,
            [API_NOCH.getCode("border length")]: borderLength,
            [API_NOCH.getCode("border height")]: borderHeight
        }
    },

    newPlayer: function(playerId, color, element, position) {
        var message = {};
        message[API_NOCH.getCode("new player id")] = playerId;
        message[API_NOCH.getCode("color")] = color;
        message[API_NOCH.getCode("element")] = element;
        message[API_NOCH.getCode("position")] = position;
        return message;
    },

    newParticleOnScreen: function(position, particleId, element) {
        var message = {};
        message[API_NOCH.getCode("position")] = position;
        message[API_NOCH.getCode("particle id")] = particleId;
        message[API_NOCH.getCode("element")] = element;
        return message;
    },

    newAvailableParticleOnScreen: function(position, particleId, element, canConnect) {
        var message = {};
        message[API_NOCH.getCode("position")] = position;
        message[API_NOCH.getCode("particle id")] = particleId;
        message[API_NOCH.getCode("element")] = element;
        if (canConnect == canConnect)
            message[API_NOCH.getCode("availability")] = canConnect;
        return message;
    },

    newBorderOnScreen: function(position, borderId, angle) {
        var message = {};
        message[API_NOCH.getCode("position")] = position;
        message[API_NOCH.getCode("border id")] = borderId;
        message[API_NOCH.getCode("angle")] = angle;
        return message;
    },

    newBondOnScreen: function(firstBondedBodyId, secondBondedBodyId) {

        let first = firstBondedBodyId < secondBondedBodyId ?
                    firstBondedBodyId : secondBondedBodyId;
        let second = firstBondedBodyId > secondBondedBodyId ?
                    firstBondedBodyId : secondBondedBodyId;

        return {[API_NOCH.getCode("first id in bond")]: first,
                [API_NOCH.getCode("second id in bond")]: second }
    },

    deleteParticle: function(idToDelete) {
        var message = {};
        message[API_NOCH.getCode("id to delete")] = idToDelete;
        return message;
    },

    changeElementGarbage: function(idToChange, element) {
        var message = {};
        message[API_NOCH.getCode("id to change")] = idToChange;
        message[API_NOCH.getCode("element")] = element;
        return message;
    },

    deleteBond: function(firstBondBodyId, secondBondBodyId) {
        let first = firstBondBodyId < secondBondBodyId ?
                    firstBondBodyId : secondBondBodyId;
        let second = firstBondBodyId > secondBondBodyId ?
                    firstBondBodyId : secondBondBodyId;

        return {[API_NOCH.getCode("first id in bond to delete")]: first,
                [API_NOCH.getCode("second id in bond to delete")]: second }
    },

    deletePlayer: function(playerId) {
        var message = {};
        message[API_NOCH.getCode("id of player to delete")] = playerId;
        return message;
    },

    activeGarbageUpdate: function(activeGarbageArray) {
        var message = {};
        message[API_NOCH.getCode("active garbage array")] = activeGarbageArray;
        return message;
    },

    changeElementPlayer: function(playerId, newElement) {
        var message = {};
        message[API_NOCH.getCode("player id")] = playerId;
        message[API_NOCH.getCode("new element")] = newElement;
        return message;
    },

    shotFired: function(particle, shooterId) {
        var message = {};
        message[API_NOCH.getCode("id of player who shot " + particle)] = shooterId;
        return message;
    },

    changeCoefficient: function(coefficient) {
        var message = {};
        message[API_NOCH.getCode("coefficient")] = coefficient;
        return message;
    },

    notifyDeath: function(value) {
        var message = {};
        message[API_NOCH.getCode("player is dead")] = value;
        return message;
    },

    newGarbageAvailable: function(availableGarbageID) {
        return {[API_NOCH.getCode("garbage available")]: availableGarbageID }
    },

    garbageIsNotAvailableAnymore: function(notAvailableGarbage) {
        return {[API_NOCH.getCode("garbage not available")]: notAvailableGarbage }
    },

    particleBecamePlayerPart: function(particleId) {
        return {
            [API_NOCH.getCode("transformed player part id")]: particleId
        }
    },

    particleBecameGarbage: function(particleId, color) {
        return {
            [API_NOCH.getCode("transformed garbage id")]: particleId,
            [API_NOCH.getCode("color")]: color
        }
    },

    scoreBoard: function(scoreBoard) {
        return {
            [API_NOCH.getCode("scoreBoard")]: scoreBoard
        }
    },

    playerShot: function(id) {
        return {
            [API_NOCH.getCode("id of player who shot ph")]: id
        }
    }
};

module.exports = Messages;