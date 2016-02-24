/**
 * Created by fatman on 13/07/15.
 */

var params = require("db_noch");
var elements = params.getParameter("elements");
var Matter = require('matter-js/build/matter.js');
var basicParticle = require("../basic particle");

var Engine = Matter.Engine,
    World = Matter.World,
    Bodies = Matter.Bodies,
    Body = Matter.Body,
    Composite = Matter.Composite;

var Garbage = function(position, engine, elem, emitter) {

    basicParticle.call(this, position, engine, elem, emitter);

    this.body.frictionAir = 0.003;

    this.body.inGameType = "garbage";
};

Garbage.prototype = {

};

Garbage.prototype.__proto__ = basicParticle.prototype;

module.exports = Garbage;