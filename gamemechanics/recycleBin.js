/**
 * Created by fatman on 30/01/16.
 */

'use strict';

var Util_tools = require("../util_tools");
var Matter = require('matter-js/build/matter.js');
var World = Matter.World;

class RecycleBin {

    constructor(context) {
        this.context = context;
        this.ghosts = [];
        this.deletedIds = [];
        this.deletedGabageNumbers = [];
    }

    add(gameObject) {
        this.ghosts.add(gameObject);
    }

    restore(gameObject) {
        this.ghosts.restore(gameObject);
    }

    empty() {
        for (let i = 0; i < this.ghosts.length; ++i) {
            if (!this.ghosts[i]) continue;
            var ghost = this.ghosts[i];
            this.deletedIds.push(ghost.id);
            switch (ghost.inGameType) {
                case "p":
                case "n":
                case "ph":
                    this.deleteProperly(ghost);
                    delete this.ghosts[i];
                    break;
                case "playerPart":
                    this.deletedGabageNumbers.push(ghost.number);
                    var playerToCheck = this.context.getPlayer(ghost);
                    this.context.getMainObject(ghost).die(this.context.engine);
                    this.deleteProperly(ghost);
                    this.context.playersEmitter.emit('element deleted', {element:ghost.element});
                    delete this.ghosts[i];
                    playerToCheck.checkResizeShrink();
                    break;
                case "garbage":
                    this.deletedGabageNumbers.push(ghost.number);
                    this.context.getMainObject(ghost).die(this.context.engine);
                    this.deleteProperly(ghost);
                    this.context.playersEmitter.emit('element deleted', {element:ghost.element});
                    delete this.ghosts[i];
                    break;
                case "player":
                    console.log(`player number ${ghost.number} is dead.`);
                    var player = this.context.getMainObject(ghost);
                    this.context.playersEmitter.emit('player died', {player: player});
                    player.lose(this.context.engine, this.context.players, this.context.garbage);
                    this.deleteProperly(ghost);
                    //player.garbagify(this.context.players, this.context.garbage);
                    this.context.playersEmitter.emit('element deleted', {element:ghost.element});
                    delete this.ghosts[i];
                    break;
                default :
                    Util_tools.handleError(`ghost inGameType is unknown\n id:
                                    ${ghost.id}, inGameType: ${ghost.inGameType}`);
            }
        }
    }

    deleteProperly(body) {
        if (body.inGameType == "p") {
            clearTimeout(body.timerId1);
            clearTimeout(body.timerId2);
        }

        delete body.events;

        Util_tools.deleteFromArray(this.context.garbageActive, body);
        World.remove(this.context.engine.world, body);

        delete this.context.getArray(body)[body.number];
    }

    prepareToDelete(body) {
        if (this.ghosts.indexOf(body) == -1) {
            Util_tools.addToArray(this.ghosts, body);
        }
    }
}

module.exports = RecycleBin;