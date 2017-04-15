/**
 * Created by fatman on 01/02/16.
 */

class Context {
    constructor(engine, playersEmitter, recyclebin, websocketservice) {
        this.players = [];
        this.garbage = [];
        this.recyclebin = recyclebin;
        this.freeProtons = [];
        this.garbageActive = [];
        this.playersEmitter = playersEmitter;
        this.engine = engine;
        this.websocketservice = websocketservice;
    }

    getArray(body) {
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
            case "ph":
                return this.freeProtons;
        }
    }

    getPlayer(body) {
        var player = this.players[body.playerNumber];
        if (player !== undefined) {
            return player;
        } else {
            console.log(`No such player! id: ${body.playerNumber}
                        \nplayers: ${this.players.map(function(player) {
                    if (player) {
                        return player.body.playerNumber;
                    } else {
                        return null;
                    }
                    })}`);
        }
    }

    getMainObject(body) {
        switch (body.inGameType) {
            case "player":
                return this.players[body.number];
            case "player temporary undefined":
            case "temporary undefined":
            case "playerPart":
            case "playerPart temporary undefined":
            case "garbage":
            case "garbage temporary undefined":
                return this.garbage[body.number];
            case "n":
            case "p":
            case "ph":
                return this.freeProtons[body.number];
            default:
                console.error("Body has no main object. number: " +
                    body.number + "\nelement: " + body.element +
                    "\nid: " + body.id + "\ntype: " + body.inGameType +
                    "\ndeleted ids: " + this.recyclebin.deletedIds);
        }
    }

    addToArray(array, obj) {
        var i = 0;
        while(array[i]) ++i;
        array[i] = obj;
        return i;
    }

    inScreen(object, tolerance) {
        if (!tolerance) tolerance = 0;
        return (object.body.position.x - object.body.circleRadius < this.body.position.x +
        this.resolution.width / this.body.coefficient / 2 *
        1366 / this.resolution.width *  + tolerance &&
        object.body.position.x + object.body.circleRadius > this.body.position.x -
        this.resolution.width / this.body.coefficient / 2 *
        1366 / this.resolution.width - tolerance &&
        object.body.position.y - object.body.circleRadius < this.body.position.y +
        this.resolution.height / this.body.coefficient / 2 *
        1366 / this.resolution.width + tolerance &&
        object.body.position.y + object.body.circleRadius > this.body.position.y -
        this.resolution.height / this.body.coefficient / 2 *
        1366 / this.resolution.width - tolerance);
    }
}

module.exports = Context;
