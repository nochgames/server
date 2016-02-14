/**
 * Created by fatman on 08/02/16.
 */

var GameMechanics = require("./gamemechanics");
var WebsocketService = require("./websocketservice");

var Emitter = require('events').EventEmitter;
var playersEmitter = new Emitter;

var gamemechanics = new GameMechanics(playersEmitter);

var websocketService = new WebsocketService(gamemechanics);

gamemechanics.websocketservice =
    gamemechanics.context.websocketservice = websocketService;

gamemechanics.configureEmitter();
gamemechanics.createGarbage(0.000008);
gamemechanics.run();
