/**
 * Created by fatman on 09/02/16.
 */
var API_NOCH = require("./api");

var Messages = {
    greeting: function(playerId, color, element) {
        var message = {};
        message[API_NOCH.getCode("self id")] = playerId;
        message[API_NOCH.getCode("color")] = color;
        message[API_NOCH.getCode("element")] = element;
        return message;
    },

    newPlayer: function(playerId, color, element, position) {
        var message = {};
        message[API_NOCH.getCode("player id")] = playerId;
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

    newBorderOnScreen: function(position, borderId, angle) {
        var message = {};
        message[API_NOCH.getCode("position")] = position;
        message[API_NOCH.getCode("border id")] = borderId;
        message[API_NOCH.getCode("angle")] = angle;
        return message;
    },

    newBondOnScreen: function(firstBondedBodyId, secondBondedBodyId) {
        var message = {};
        message[API_NOCH.getCode("first id in bond")] = firstBondedBodyId;
        message[API_NOCH.getCode("second id in bond")] = secondBondedBodyId;
        return message;
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
        var message = {};
        message[API_NOCH.getCode("first id in bond to delete")] = firstBondBodyId;
        message[API_NOCH.getCode("second id in bond to delete")] = secondBondBodyId;
        return message;
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

    changeCoeficient: function(coefficient) {
        var message = {};
        message[API_NOCH.getCode("coefficient")] = coefficient;
        return message;
    },

    notifyDeath: function(value) {
        var message = {};
        message[API_NOCH.getCode("player is dead")] = value;
        return message;
    }
};

module.exports = Messages;