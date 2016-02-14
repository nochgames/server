/**
 * Created by fatman on 30/01/16.
 */

var Util_tools = require("../util_tools");
var Matter = require('matter-js/build/matter.js');
var World = Matter.World;

var RecycleBin = function(context) {
    this.context = context;
    this.ghosts = [];
};

RecycleBin.prototype = {
    add: function(gameObject) {
        this.ghosts.add(gameObject);
    },

    restore: function(gameObject) {
        this.ghosts.restore(gameObject);
    },

    empty: function() {
        for (var i = 0; i < this.ghosts.length; ++i) {
            if (!this.ghosts[i]) continue;
            var ghost = this.ghosts[i];
            switch (ghost.inGameType) {
                case "p":
                    this.deleteProperly(ghost);
                    delete this.ghosts[i];
                    break;
                case "playerPart":
                    var playerToCheck = this.context.getPlayer(ghost);
                    this.context.getMainObject(ghost).die(this.context.engine);
                    this.deleteProperly(ghost);
                    delete this.ghosts[i];
                    playerToCheck.checkResizeShrink();
                    break;
                case "garbage":
                    this.context.garbage[ghost.number].die(this.context.engine);
                    this.deleteProperly(ghost);
                    delete this.ghosts[i];
                    break;
                case "player":
                    console.log("player number " + ghost.number + " is dead.");
                    var player = this.context.getMainObject(ghost);
                    player.lose(this.context.engine, this.context.players, this.context.garbage);
                    this.context.playersEmitter.emit('player died', {player: player});
                    player.garbagify(this.context.players, this.context.garbage);
                    delete this.ghosts[i];
                    break;
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
        delete this.context.getArray(body)[body.number];
    },

    prepareToDelete: function(body) {
        if (this.ghosts.indexOf(body) == -1) {
            this.context.addToArray(this.ghosts, body);
        }
    }
};

module.exports = RecycleBin;