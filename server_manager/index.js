/**
 * Created by fatman on 25/06/17.
 */

let fork = require('child_process').fork;
let Util_tools = require("../util_tools");
let config = require('config-node')();

class ServerManager {

    constructor() {
        this.servers = [];
        this.availablePorts = [];
        this.currentPort = config.server.port;

        this.spawnInitialServers();
    }

    getServerPort() {
        if (!this.availablePorts.length) return -1;
        return this.availablePorts[
            Math.floor(Math.random() * this.availablePorts.length)];
    }

    spawnInitialServers() {
        for (let i = 0; i < config.server.defaultServersNumber; ++i) {
            let port = this.currentPort++;
            let server = this.createServer(port);
            this.servers.push(server);
            this.availablePorts.push(port);
            server.send(JSON.stringify({port:port}));
        }
    }

    createServer(port) {
        let server = fork('./server.js');

        server.on('message', response => {
            let parsedMessage;

            try {
                parsedMessage = JSON.parse(response);
            } catch (e) {
                console.error("invalid JSON " + response);
            }

            if ("isFull" in parsedMessage) {
                if (parsedMessage.isFull) {
                    Util_tools.deleteFromArray(this.availablePorts, port);
                } else {
                    this.availablePorts.push(port);
                }
            }
        });

        return server;
    }
}

if (module.parent) {
    module.exports = ServerManager;
} else {
    new ServerManager();
}