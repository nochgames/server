/**
 * Created by fatman on 31/01/16.
 */

'use strict';

var WebSocketServer = new require('ws');
var Messages = require("../messages");

var WebsocketService = function(gamemechanics) {
    this.onCloseMap = new Map();
    this.onMessageMap = new Map();
    this.onErrorMap = new Map();
    this.IPs = new Set();

    this.webSocketServer = new WebSocketServer.Server({
        port: 8085
    });

    this.addressees = gamemechanics.context.players;
    this.gamemechanics = gamemechanics;

    var self = this;
    this.webSocketServer.on('connection', function(ws) {
        if (self.IPs.has(ws._socket.remoteAddress)) {
            ws.close();
            return;
        }
        self.IPs.add(ws._socket.remoteAddress);

        console.log(ws._socket.remoteAddress);
        
        if (!gamemechanics.isRunning) gamemechanics.run();


        var stub = gamemechanics.addPlayerStub(ws);

        self.updateEventListener(ws, 'message', stub, stub, self.onMessageMap,
                                    self.createDoOnMessageStub(ws, stub));
        self.updateEventListener(ws, 'error', stub, stub, self.onErrorMap,
            self.createDeleteStub(stub));
        self.updateEventListener(ws, 'close', stub, stub, self.onCloseMap,
            self.createDeleteStub(stub));
    });

    console.log('The server is running');
};

WebsocketService.prototype = {
    updateEventListener: function(socket, event, oldKey, newKey, map, callback) {
        if (map.has(oldKey)) {
            socket.removeListener(event, map.get(oldKey));
            map.delete(oldKey);
        }
        map.set(newKey, callback);
        socket.on(event, callback);
    },

    sendToPlayer: function(message, reciever, event_name) {
        message = JSON.stringify(message);
        try {
            reciever.ws.send(message);
        } catch(e) {
            console.log('Unable to send ' + message +
                ' to player. Player is\n' + reciever + '\n' + e);
        }
    },

    closeSocket: function(lastMessage, reciever) {
        this.sendToPlayer(lastMessage, reciever);

        reciever.ws.removeListener('message', this.onMessageMap.get(reciever));
        reciever.ws.removeListener('error', this.onErrorMap.get(reciever));
        reciever.ws.removeListener('close', this.onCloseMap.get(reciever));
        this.onCloseMap.delete(reciever);
        this.onErrorMap.delete(reciever);
        this.onCloseMap.delete(reciever);

        try {
            var ip = reciever.ws._socket.remoteAddress;
            reciever.ws.close();

            console.log("killing player, IP " + ip);
            this.IPs.delete(ip);
        } catch (e) {
            //do nothing
        }
    },

    sendEverybody: function(message) {
        for (let i = 0; i < this.addressees.length; ++i) {
            if (this.addressees[i]) {
                this.sendToPlayer(message, this.addressees[i]);
            }
        }
    },

    sendSpecificPlayers: function(message, addressesIndexes) {
        for (let i = 0; i < addressesIndexes.length; ++i) {
            if (this.addressees[addressesIndexes[i]]) {
                this.sendToPlayer(message, this.addressees[addressesIndexes[i]]);
            }
        }
    },

    createDoOnMessageStub: function(socket, stubCurrent) {
        var self = this;
        var stub = stubCurrent;
        var ws = socket;

        return function(message) {

            try {
                message = JSON.parse(message);
            } catch (e) {
                console.error("Invalid json " + message);
                return;
            }
            
            if (!(message instanceof Object)) {
                console.error("Invalid message " + message);
                return;
            }

            if ('startGame' in message) {

                var player = self.gamemechanics.addPlayer(ws, stub.body.position, stub.number,
                    stub.resolution, message.name, message.color);

                self.updateEventListener(ws, 'message', stub, player,
                    self.onMessageMap, self.createDoOnMessage(player));
                self.updateEventListener(ws, 'error', stub, player,
                    self.onErrorMap, self.createDoOnError(player));
                self.updateEventListener(ws, 'close', stub, player,
                    self.onCloseMap, self.createDoOnClose(player));
            }

            if ('x' in message) {
                stub.resolution = { width: message.x, height: message.y };
            }
        }
    },

    createDoOnMessage: function(playerCurrent) {
        var player = playerCurrent;
        var self = this;
        return function(message) {
            //console.log('player ' + id + " says " + message);

            try {
                var parsedMessage = JSON.parse(message);
            } catch (e) {
                console.error("Invalid JSON " + message);
            }

            if ('x' in parsedMessage) {
                player.setResolution(parsedMessage);
                self.gamemechanics.context.chemistry.updateGarbageConnectingPossibilityForPlayer()
                console.log("Now resolution is " + message);
            }

            if ('mouseX' in parsedMessage) {

                player.applyVelocityGlobal(parsedMessage.mouseX, parsedMessage.mouseY);
            }

            if ('shotX' in parsedMessage) {

                //in case someone will send old data manually
                if (parsedMessage.particle == "p" || parsedMessage.particle == "n") return;

                var shotPos = {
                    x: parsedMessage.shotX - player.getLocalPosition().x,
                    y: parsedMessage.shotY - player.getLocalPosition().y
                };
                player.shoot(parsedMessage.particle, shotPos,
                        self.gamemechanics.context.freeProtons,
                        self.gamemechanics.context.engine);
            }
        }
    },

    createDeleteStub: function(stub) {
        var self = this;
        var number = stub.number;

        return function() {
            console.log("deleting stub IP " + this._socket.remoteAddress);
            self.IPs.delete(this._socket.remoteAddress);
            delete self.gamemechanics.context.players[number];
        }
    },

    createDoOnError: function(playerCurrent) {
        var player = playerCurrent;
        var self = this;
        return function(event) {
            if (event != 1000) {
                if (player.body.inGameType == "player") {
                    self.gamemechanics.recyclebin.prepareToDelete(player.body);
                }
                console.log('player exited ' + player.body.number);
            } else {
                console.log('player lost ' + player.body.number);
            }
        }
    },

    createDoOnClose: function(playerCurrent) {
        var player = playerCurrent;
        var self = this;
        return function(event) {
            console.log('player disconnected ' + player.body.number);
            
            console.log("deleting player IP " + this._socket.remoteAddress);
            self.IPs.delete(this._socket.remoteAddress);
            
            if (player.body.inGameType == "player") {
                self.gamemechanics.recyclebin.prepareToDelete(player.body);
            }
        }
    }
};

module.exports = WebsocketService;