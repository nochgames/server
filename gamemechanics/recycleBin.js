/**
 * Created by fatman on 30/01/16.
 */

'use strict';

var Util_tools = require("../util_tools");
var Matter = require('matter-js/build/matter.js');
var World = Matter.World;

var RecycleBin = function(context) {
    this.context = context;
    this.ghosts = [];
    this.deletedIds = [];
    this.deletedGabageNumbers = [];
};

RecycleBin.prototype = {
    add: function(gameObject) {
        this.ghosts.add(gameObject);
    },

    restore: function(gameObject) {
        this.ghosts.restore(gameObject);
    },

    empty: function() {
        for (let i = 0; i < this.ghosts.length; ++i) {
            if (!this.ghosts[i]) continue;
            var ghost = this.ghosts[i];
            this.deletedIds.push(ghost.id);
            switch (ghost.inGameType) {
                case "p":
                case "n":
                    this.deleteProperly(ghost);
                    delete this.ghosts[i];
                    break;
                case "playerPart":
                    this.deletedGabageNumbers.push(ghost.number);
                    var playerToCheck = this.context.getPlayer(ghost);
                    this.context.getMainObject(ghost).die(this.context.engine);
                    this.deleteProperly(ghost);
                    delete this.ghosts[i];
                    playerToCheck.checkResizeShrink();
                    break;
                case "garbage":
                    this.deletedGabageNumbers.push(ghost.number);
                    this.context.garbage[ghost.number].die(this.context.engine);
                    this.deleteProperly(ghost);
                    delete this.ghosts[i];
                    break;
                case "player":
                    console.log("player number " + ghost.number + " is dead.");
                    var player = this.context.getMainObject(ghost);
                    player.lose(this.context.engine, this.context.players, this.context.garbage);
                    this.context.playersEmitter.emit('player died', {player: player});
                    //player.garbagify(this.context.players, this.context.garbage);
                    delete this.ghosts[i];
                    break;
                default :
                    throw new Error('Incorrect behaviour');
            }
        }
    },

    deleteProperly: function(body) {
        if (body.inGameType == "p") {
            clearTimeout(body.timerId1);
            clearTimeout(body.timerId2);
        }

        Util_tools.deleteFromArray(this.context.garbageActive, body);
        World.remove(this.context.engine.world, body);
        if (this.context.getArray(body)[body.number].body.id != body.id) {
            console.log(this.context.getArray(body)[body.number]);
            console.log('\n==================================\n');
            console.log(body);
            var numbers = this.context.garbage.map(function(gb) {
                if (gb) {
                    return gb.body.number;
                }
                return null;
            });
            //console.log(numbers);
            throw new Error('incorrect behaviour');
        }
        delete this.context.getArray(body)[body.number];
    },

    prepareToDelete: function(body) {
        if (this.ghosts.indexOf(body) == -1) {
            this.context.addToArray(this.ghosts, body);
        }
    }
};

module.exports = RecycleBin;