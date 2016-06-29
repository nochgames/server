/**
 * Created by fatman on 08/02/16.
 */

'use strict';

var Matter = require('matter-js/build/matter.js');

var GameMechanics = require("./gamemechanics");
var WebsocketService = require("./websocketservice");

var Emitter = require('events').EventEmitter;

class Server {
    
    constructor(wsPort) {
        this.playersEmitter = new Emitter();

        this.gamemechanics = new GameMechanics(this.playersEmitter);

        this.websocketService = new WebsocketService(wsPort, this.gamemechanics);

        this.gamemechanics.websocketservice =
            this.gamemechanics.context.websocketservice = this.websocketService;
    }

    run() {
        this.gamemechanics.configureEmitter();
        this.gamemechanics.game_map.createFullBorder();
        this.gamemechanics.createGarbage(0.000008);
        this.gamemechanics.run();
        this.playersEmitter.on('no players', (event) => { this.gamemechanics.stop(); });
    }
    
    getClientsNumber() {
        return this.websocketService.webSocketServer.clients.length;
    }
}

if (module.parent) {
    module.exports = Server;
} else {
    var server = new Server(8085);
    server.run();
}
