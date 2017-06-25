/**
 * Created by fatman on 08/02/16.
 */

'use strict';

var Matter = require('matter-js/build/matter.js');

var GameMechanics = require("./gamemechanics");
var WebsocketService = require("./websocketservice");

var Emitter = require('events').EventEmitter;

var config = require('config-node')();

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
        this.gamemechanics.createGarbage(config.game.garbageDensity);
        this.gamemechanics.run();
        this.playersEmitter.on('no players', (event) => { this.gamemechanics.stop(); });
    }
    
    getClientsNumber() {
        return this.websocketService.webSocketServer.clients.length;
    }

    static initProcessCallbacks() {
        process.on('message', function(message) {
            let parsedMessage;
            try {
                parsedMessage = JSON.parse(message);
            } catch (e) {
                console.error("Invalid JSON " + message);
            }

            if ('port' in parsedMessage && !Server.instance) {
                let server = new Server(parsedMessage.port);
                server.initMultiProcessEventHandling();
                server.run();
                Server.instance = server;
            }
        });
    }

    initMultiProcessEventHandling() {
        this.playersEmitter.on('is full', event => process.send(JSON.stringify({isFull:true})));
        this.playersEmitter.on('is not full', event => process.send(JSON.stringify({isFull:false})));
    }
}

if (module.parent) {
    module.exports = Server;
} else if (process.connected) {
    Server.initProcessCallbacks();
} else {
    let server = new Server(config.server.port);
    server.run();
}
