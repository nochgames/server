/**
 * Created by fatman on 13/07/15.
 */

'use strict';


var Matter = require('matter-js/build/matter.js');
var basicParticle = require("../basic particle");

var Engine = Matter.Engine,
    World = Matter.World,
    Bodies = Matter.Bodies,
    Body = Matter.Body,
    Composite = Matter.Composite;

class Garbage extends basicParticle {
    constructor(position, engine, elem, emitter, chemistry) {

        super(position, engine, elem, emitter, chemistry);

        this.body.frictionAir = 0.003;

        this.body.inGameType = "garbage";
    }
}

module.exports = Garbage;