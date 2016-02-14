/**
 * Created by fatman on 01/02/16.
 */

var Context = function(engine, playersEmitter, recyclebin, websocketservice) {
    this.players = [];
    this.garbage = [];
    this.recyclebin = recyclebin;
    this.freeProtons = [];
    this.garbageActive = [];
    this.playersEmitter = playersEmitter;
    this.engine = engine;
    this.websocketservice = websocketservice;
};

Context.prototype = {
    getArray: function(body) {
        switch (body.inGameType) {
            case "player":
                return this.players;
            case "temporary undefined":
            case "playerPart":
            case "garbage":
                return this.garbage;
            case "n":
            case "p":
                return this.freeProtons;
        }
    },

    getPlayer: function(body) {
        var player = this.players[body.playerNumber];
        if (player !== undefined) {
            return player;
        } else {
            console.log("No such player! id: " + body.playerNumber);
        }
    },

    getMainObject: function(body) {
        //console.log(body.inGameType);
        switch (body.inGameType) {
            case "player":
                //console.log("returning player at " + body.number);
                return this.players[body.number];
            case "player temporary undefined":
            case "temporary undefined":
            case "playerPart":
            case "playerPart temporary undefined":
            case "garbage":
            case "garbage temporary undefined":
                //console.log("returning garbage at " + body.number);
                return this.garbage[body.number];
            case "n":
            case "p":
                //console.log("returning freeProtons at " + body.number);
                return this.freeProtons[body.number];
        }
    },

    addToArray: function(array, obj) {
        var i = 0;
        while(array[i]) ++i;
        array[i] = obj;
        return i;
    }
};

module.exports = Context;