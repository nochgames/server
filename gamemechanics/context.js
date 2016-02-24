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
            case "player temporary undefined":
            case "temporary undefined":
            case "playerPart":
            case "playerPart temporary undefined":
            case "garbage":
            case "garbage temporary undefined":
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
        switch (body.inGameType) {
            case "player":
                return this.players[body.number];
            case "player temporary undefined":
            case "temporary undefined":
            case "playerPart":
            case "playerPart temporary undefined":
            case "garbage":
            case "garbage temporary undefined":
                if (!this.garbage[body.number]) {
                    console.log(body.inGameType);
                    console.log('actual id is ' +
                        this.garbage.map(function(gb) {
                        if (gb)  {
                            return gb.body.id;
                        }
                        return null;
                    }).indexOf(body.id) + ' fake id is ' +
                    body.number);
                    console.log('id ' + body.id);
                    console.log("Was player: " + body.wasPlayer);
                    console.log("Was deleted: " );
                    console.log(this.recyclebin.deletedIds.indexOf(body.id));
                    console.log("Is player: ");
                    console.log(this.players.map(function(gb) {
                        if (gb)  {
                            return gb.body.id;
                        }
                        return null;
                    }).indexOf(body.id));
                    console.log("Was deleted from garbage array: ");
                    console.log(this.recyclebin.deletedGabageNumbers.indexOf(body.number));
                    console.log("deleted from garbage array total: " +
                                this.recyclebin.deletedGabageNumbers.length);
                }
                return this.garbage[body.number];
            case "n":
            case "p":
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
