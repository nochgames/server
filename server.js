/**
 * Created by fatman on 08/02/16.
 */
var Matter = require('matter-js/build/matter.js');

var GameMechanics = require("./gamemechanics");
var WebsocketService = require("./websocketservice");

var Emitter = require('events').EventEmitter;
var playersEmitter = new Emitter();

var gamemechanics = new GameMechanics(playersEmitter);

var websocketService = new WebsocketService(gamemechanics);

gamemechanics.websocketservice =
    gamemechanics.context.websocketservice = websocketService;

gamemechanics.configureEmitter();
gamemechanics.game_map.createFullBorder();
gamemechanics.createGarbage(0.000008);
gamemechanics.run();
gamemechanics.logMemoryUsage();
