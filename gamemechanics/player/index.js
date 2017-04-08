/**
 * Created by fatman on 06/07/15.
 */

'use strict';

var Messages = require("../../messages");
var Matter = require('matter-js/build/matter.js');
var params = require("db_noch");
var elements = params.getParameter("elements");
var ActiveElement = require("../ActiveElement");
var garbage = require("../garbage");

var Engine = Matter.Engine,
    World = Matter.World,
    Bodies = Matter.Bodies,
    Body = Matter.Body,
    Composite = Matter.Composite,
    Vector = Matter.Vector;

class Player extends ActiveElement {
    constructor(ws, name, position, engine, elem, emitter,
                websocketservice, chemistry, color, number) {

        super(websocketservice, position, engine,
                elem, emitter, chemistry, color);

        this.name = name;
        this.isBot = false;

        this.body.number = this.body.playerNumber = number;

        this.ws = ws;

        this.body.inGameType = "player";

        this.websocketservice.sendToPlayer(
            Messages.changeCoefficient(this.body.coefficient), this);
    }

    setResolution(res) {
        this.resolution.width = res["x"];
        this.resolution.height = res["y"];
    }

    applyVelocityGlobal(mx, my) {
        mx = mx - this.getLocalPosition().x;
        my = my - this.getLocalPosition().y;

        this.applyVelocity(mx, my);
    }

    getLocalPosition() {
        return { x: this.resolution.width / 2,
            y: this.resolution.height / 2 };
    }

    lose(engine, playersArray, garbageArray, newPlayerBody) {
        super.lose(engine, playersArray, garbageArray, newPlayerBody);
        this.websocketservice.closeSocket(Messages.notifyDeath(true), this);

        delete (this.ws);
    }

    checkResizeGrow(newRadius) {
        if (newRadius > this.body.realRadius) {
            this.body.realRadius = newRadius;
            this.body.coefficient = this.body.multiplier / Math.sqrt(this.body.realRadius);
            if (this.coefficientTimeOut) clearTimeout(this.coefficientTimeOut);

            this.websocketservice.sendToPlayer(Messages.changeCoefficient(this.body.coefficient), this);
        }
    }

    checkResizeShrink() {
        this.body.realRadius = this.body.circleRadius;

        var self = this;
        this.traversDST(this.body, function(body) {
            var pos1 = self.body.position;
            var pos2 = body.position;
            var newRadius = Math.sqrt((pos1.x - pos2.x) * (pos1.x - pos2.x)
                + (pos1.y - pos2.y) * (pos1.y - pos2.y));
            if (newRadius > self.body.realRadius) {
                self.body.realRadius = newRadius;
            }
        });

        var coefficient = this.body.multiplier / Math.sqrt(this.body.realRadius);

        this.websocketservice.sendToPlayer(Messages.changeCoefficient(coefficient), this);

        //console.log(self.body.realRadius);

        if (this.coefficientTimeOut) clearTimeout(this.coefficientTimeOut);
        this.coefficientTimeOut = setTimeout(function() {
            self.body.coefficient = coefficient;
        }, 2000);
    }

    update() {
        super.update();
    }
}

module.exports = Player;