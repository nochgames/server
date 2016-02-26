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

    this.webSocketServer = new WebSocketServer.Server({
        port: 8085
    });

    this.addressees = gamemechanics.context.players;
    this.gamemechanics = gamemechanics;

    var self = this;
    this.webSocketServer.on('connection', function(ws) {
        var player = gamemechanics.addPlayer(ws);

        self.onMessageMap.set(player, self.createDoOnMessage(player));
        self.onCloseMap.set(player, self.createDoOnClose(player));
        self.onErrorMap.set(player, self.createDoOnError(player));
        ws.on('message', self.onMessageMap.get(player));
        ws.on('error', self.onErrorMap.get(player));
        ws.on('close', self.onCloseMap.get(player));
    });

    console.log('The server is running');
};

WebsocketService.prototype = {
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
        reciever.ws.close();
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

    createDoOnMessage: function(playerCurrent) {
        var player = playerCurrent;
        var self = this;
        return function(message) {
            //console.log('player ' + id + " says " + message);

            var parsedMessage = JSON.parse(message);

            if ('x' in parsedMessage) {
                player.setResolution(parsedMessage);
                //console.log("Now resolution is " + message);
            }

            if ('mouseX' in parsedMessage) {

                var mouseX = parsedMessage.mouseX - player.getLocalPosition().x;
                var mouseY = parsedMessage.mouseY - player.getLocalPosition().y;

                player.applyVelocity(mouseX, mouseY);
            }

            if ('shotX' in parsedMessage) {

                var shotPos = {
                    x: parsedMessage.shotX - player.getLocalPosition().x,
                    y: parsedMessage.shotY - player.getLocalPosition().y
                };
                if (player.shoot(parsedMessage.particle, shotPos,
                        self.gamemechanics.context.freeProtons,
                        self.gamemechanics.context.engine)) {
                    self.sendEverybody(Messages.shotFired(parsedMessage.particle, player.body.id));
                    if (parsedMessage.particle == 'p') {
                        self.sendEverybody(Messages.changeElementPlayer(
                            player.body.id, player.body.element));
                    }
                }
            }
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
            if (player.body.inGameType == "player") {
                self.gamemechanics.recyclebin.prepareToDelete(player.body);
            }
        }
    }
};

module.exports = WebsocketService;