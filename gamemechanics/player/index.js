/**
 * Created by fatman on 06/07/15.
 */

var Messages = require("../../messages");
var Matter = require('matter-js/build/matter.js');
var params = require("db_noch");
var elements = params.getParameter("elements");
var basicParticle = require("../basic particle/index");
var garbage = require("../garbage");

var Engine = Matter.Engine,
    World = Matter.World,
    Bodies = Matter.Bodies,
    Body = Matter.Body,
    Composite = Matter.Composite,
    Vector = Matter.Vector;

var Player = function(ws, name, position, engine, elem, emitter, websocketservice, chemistry) {

    basicParticle.call(this, position, engine, elem, emitter, chemistry);

    this.name = name;

    this.kills = 0;

    this.isStub = false;
    this.ws = ws;
    this.websocketservice = websocketservice;

    this.isReady = false;

    this.previousPosition = { x: 0, y: 0 };
    this.body.inGameType = "player";
    this.body.player = this;
    this.body.realMass = this.body.mass;

    this.body.realRadius = this.body.circleRadius;
    this.body.multiplier =  Math.sqrt(this.body.realRadius);
    this.resolution = { width: 0, height: 0 };
    this.body.coefficient = 1;
    this.websocketservice.sendToPlayer(
        Messages.changeCoefficient(this.body.coefficient), this);
};

Player.prototype = {
    setResolution: function(res) {
        this.resolution.width = res["x"];
        this.resolution.height = res["y"];
    },

    getLocalPosition: function() {
        return { x: this.resolution.width / 2,
                 y: this.resolution.height / 2 };
    },

    makeMassCalc: function() {
        function addMass(body) {
            addMass.mass += body.mass;
        }
        addMass.mass = 0;
        return addMass;
    },

    recalculateMass: function() {
        this.body.realMass = this.calculateMass(this.body);
    },

    calculateMass: function(body) {
        var func = this.makeMassCalc();
        this.traversDST(body, func);
        return func.mass;
    },

    shoot: function(particle, shotPos, nucleonsArray, engine) {

        if (particle == "p" && this.body.element == "H") return false;
        if (particle == "n" && this.body.neutrons == 0) return false;

        if (!this["timeLimit" + particle]) {
            var element = params.getParameter(particle);

            var nucleonBody = this.createNucleon(particle, shotPos, nucleonsArray, engine);

            //if (particle == "p") this.changeCharge(-1, engine, nucleonsArray);

            var self = this;

            this["timeLimit" + particle] = true;
            setTimeout(function() {
                self["timeLimit" + particle] = false;
            }, /*100*/this.body.coolDown);

            nucleonBody.timerId1 = setTimeout(function() {
                nucleonBody.collisionFilter.mask = 0x0001;
            }, 1000);

            nucleonBody.timerId2 = setTimeout(function() {
                if (nucleonsArray[nucleonBody.number]) {
                    World.remove(engine.world, nucleonBody);
                    self.body.emitter.emit('particle died', { id: nucleonBody.id,
                                            playersWhoSee: nucleonBody.playersWhoSee });
                    delete nucleonsArray[nucleonBody.number];
                }
            }, 10000);

            if (particle == "n") {

                --this.body.neutrons;

                this.body.inverseMass = 1 / this.body.mass;

                setTimeout(function() {
                    ++self.body.neutrons;
                    self.body.mass += element.mass;
                    self.body.inverseMass = 1 / self.body.mass;
                }, this.body.coolDown);
                setTimeout(function() {
                    nucleonBody.inGameType =
                        nucleonBody.element = "p";
                }, element.protonMorphing);
            }

            this.body.emitter.emit('shot fired', { shid: this.body.id });

            //debugging
            /*nucleonBody.inGameType =
                nucleonBody.element = "p";*/
            return true;
        }
        return false;
    },

    lose: function(engine, playersArray, garbageArray, newPlayerBody) {

        this.websocketservice.closeSocket(Messages.notifyDeath(true), this);

        delete (this.ws);
        if (newPlayerBody) {
            this.garbagify(playersArray, garbageArray, newPlayerBody);
        } else {
            this.garbagify(playersArray, garbageArray);
            this.die(engine);
        }
    },

    //turns player into garbage before appending it to another player
    garbagify: function(playersArray, garbageArray, newPlayerBody) {

        var playerIndex = this.body.playerNumber;
        garbageArray.push(this);
        this.body.number = garbageArray.indexOf(this);

        if (newPlayerBody !== undefined) {

            this.prepareForBond(newPlayerBody);
        } else {
            this.traversDST(this.body, function(node) {
                node.emitter.emit('became garbage', { garbageBody: node });
                node.inGameType = "garbage";
                node.playerNumber = -958;
            });
        }

        delete (this.body.realRadius);
        delete (this.body.coefficient);
        delete (this.body.resolution);

        if (playerIndex > -1) {
            delete playersArray[playerIndex];
        } else {
            throw new Error(new Date() + '\nIncorrect behaviour');
        }
    },

    applyVelocity: function(mx, my) {
        var speed = this.body.nuclearSpeed;

        var PERCENT_FULL = 100;
        var massCoefficient = 6;
        var minMultiplier = 20;
        var partsMultiplier = 2;
        var forceCoefficient = 490;

        var multiplier = PERCENT_FULL - this.body.realMass * massCoefficient;
        if (multiplier < minMultiplier) multiplier = minMultiplier;
        speed = speed / PERCENT_FULL * multiplier / partsMultiplier;

        //apply decreased velocity to all parts of the player

        var pos1 = this.body.position;

        //TODO: make players move properly
        this.traversDST(this.body, function(body) {
            body.force = { x: 0, y: 0 };
            body.torque = 0;
            var pos2 = body.position;
            /*var distance = Math.sqrt((pos1.x - pos2.x) * (pos1.x - pos2.x)
                + (pos1.y - pos2.y) * (pos1.y - pos2.y));
            if (!distance) distance = 1;*/
            Body.applyForce(body, body.position,
                /*Matter.Body.setVelocity(body,*/ Vector.create(
                    speed / forceCoefficient /*!/ Math.sqrt(distance) */*
                    mx / Math.sqrt(mx * mx + my * my),
                    speed / forceCoefficient /*/ Math.sqrt(distance) */*
                    my / Math.sqrt(mx * mx + my * my)
            ));
        });

        speed *= partsMultiplier;

        //apply regular velocity to player.body only
        this.body.force = { x: 0, y: 0 };
        this.body.torque = 0;
        Body.applyForce(this.body, this.body.position,
        /*Body.setVelocity(this.body,*/ Vector.create(
            speed / forceCoefficient * mx / Math.sqrt(mx * mx + my * my),
            speed / forceCoefficient * my / Math.sqrt(mx * mx + my * my)
        ));

    },

    checkResizeGrow: function(newRadius) {
        if (newRadius > this.body.realRadius) {
            this.body.realRadius = newRadius;
            this.body.coefficient = this.body.multiplier / Math.sqrt(this.body.realRadius);
            if (this.coefficientTimeOut) clearTimeout(this.coefficientTimeOut);

            this.websocketservice.sendToPlayer(Messages.changeCoefficient(this.body.coefficient), this);
        }
    },

    checkResizeShrink: function() {
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
    },

    updatePreviousPosition: function() {
        if (Math.abs(this.previousPosition.x - this.body.position.x) > 1 ||
            Math.abs(this.previousPosition.x - this.body.position.x) > 1) {
            this.previousPosition.x = this.body.position.x;
            this.previousPosition.y = this.body.position.y;
        }
    },

    inScreen: function(object, tolerance) {
        if (!tolerance) tolerance = 0;
        return (object.body.position.x - object.body.circleRadius < this.body.position.x +
        this.resolution.width / this.body.coefficient / 2 + tolerance &&
        object.body.position.x + object.body.circleRadius > this.body.position.x -
        this.resolution.width / this.body.coefficient / 2 - tolerance &&
        object.body.position.y - object.body.circleRadius < this.body.position.y +
        this.resolution.height / this.body.coefficient / 2 + tolerance &&
        object.body.position.y + object.body.circleRadius > this.body.position.y -
        this.resolution.height / this.body.coefficient / 2 - tolerance);
    }
};

Player.prototype.__proto__ = basicParticle.prototype;

module.exports = Player;