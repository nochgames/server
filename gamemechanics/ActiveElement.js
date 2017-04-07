/**
 * Created by fatman on 07/04/17.
 */

'use strict';

var Messages = require("../messages");
var Matter = require('matter-js/build/matter.js');
var params = require("db_noch");
var elements = params.getParameter("elements");
var basicParticle = require("./basic particle");
var garbage = require("./garbage");

var Engine = Matter.Engine,
    World = Matter.World,
    Bodies = Matter.Bodies,
    Body = Matter.Body,
    Composite = Matter.Composite,
    Vector = Matter.Vector;

class ActiveElement extends basicParticle {
    constructor(websocketservice, position, engine, elem,
                emitter, chemistry) {

        super(position, engine, elem, emitter, chemistry);

        this.websocketservice = websocketservice;

        this.kills = 0;

        this.isStub = false;

        this.isReady = false;

        this.previousPosition = { x: 0, y: 0 };

        this.body.player = this;
        this.body.realMass = this.body.mass;

        this.body.realRadius = this.body.circleRadius;
        this.body.multiplier =  Math.sqrt(this.body.realRadius);
        this.resolution = { width: 0, height: 0 };
        this.body.coefficient = 1;
    }

    getLocalPosition() {
        return { x: this.resolution.width / 2,
            y: this.resolution.height / 2 };
    }

    makeMassCalc() {
        function addMass(body) {
            addMass.mass += body.mass;
        }
        addMass.mass = 0;
        return addMass;
    }

    recalculateMass() {
        this.body.realMass = this.calculateMass(this.body);
    }

    calculateMass(body) {
        var func = this.makeMassCalc();
        this.traversDST(body, func);
        return func.mass;
    }

    shoot(particle, shotPos, nucleonsArray, engine) {

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

            this.websocketservice.sendEverybody(Messages.shotFired(particle, this.body.id));
            if (particle == 'p') {
                this.websocketservice.sendEverybody(Messages.changeElementPlayer(
                    this.body.id, this.body.element));
            }

            return true;
        }
        return false;
    }

    lose(engine, playersArray, garbageArray, newPlayerBody) {
        if (newPlayerBody) {
            this.garbagify(playersArray, garbageArray, newPlayerBody);
        } else {
            this.garbagify(playersArray, garbageArray);
            this.die(engine);
        }
    }

    //turns player into garbage before appending it to another player
    garbagify(playersArray, garbageArray, newPlayerBody) {

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
    }

    applyVelocityGlobal(mx, my) {
        mx = mx - this.getLocalPosition().x;
        my = my - this.getLocalPosition().y;

        this.applyVelocity(mx, my);
    }

    applyVelocity(mx, my) {

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

    }

    updatePreviousPosition() {
        if (Math.abs(this.previousPosition.x - this.body.position.x) > 1 ||
            Math.abs(this.previousPosition.x - this.body.position.x) > 1) {
            this.previousPosition.x = this.body.position.x;
            this.previousPosition.y = this.body.position.y;
        }
    }

    inScreen(object, tolerance) {
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
}

module.exports = ActiveElement;