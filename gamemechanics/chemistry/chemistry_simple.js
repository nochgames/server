/**
 * Created by fatman on 26/02/16.
 */

'use strict';

var Matter = require('matter-js/build/matter.js');

var Engine = Matter.Engine,
    World = Matter.World,
    Bodies = Matter.Bodies,
    Body = Matter.Body,
    Composite = Matter.Composite;

class ChemistrySimple {

    constructor(context) {
        this.context = context;
    }

    subtractBondEnergy(bodyA, bodyB) {
        //do nothing
    }

    setElement(elem, particle) {
        if (elem) {
            var element = config.game.chemistry[elem];
            particle.body.element = elem;
            var coefficient = (element.radius + particle.CHARGE_RADIUS)
                / particle.body.circleRadius;

            Body.scale(particle.body, coefficient, coefficient);
            particle.body.circleRadius = element.radius + particle.CHARGE_RADIUS;

            particle.body.elValency = element.valency;
            particle.body.nuclearSpeed = element.speed;
            particle.body.realMass -= particle.body.mass;
            particle.body.mass = element.mass;
            particle.body.realMass += particle.body.mass;
            particle.body.inverseMass = 1 / element.mass;
            particle.body.coolDown = element.coolDown;
            particle.body.neutrons = element.neutrons;
            particle.body.maxNeutrons = element.maxNeutrons;

            if (particle.body.bondAngles) {
                var angle = 0;
                while (particle.body.bondAngles.length < particle.body.elValency) {
                    particle.body.bondAngles.push({ "angle": 0, "available": true });
                }
                for (let i = 0; i < particle.body.elValency; ++i) {
                    particle.body.bondAngles[i].angle = angle;
                    angle += 2 * Math.PI / particle.body.elValency;
                }
                while (particle.body.bondAngles.length > particle.body.elValency) {
                    particle.body.bondAngles.pop();
                }
            }
            particle.body.emitter.emit("element changed", { body: particle.body });
        }
    }

    isImpossible(body) {
        return body.chemicalBonds > body.elValency;
    }

    balanceEnergy() {
        //do nothing
    }

    findBodyToConnect(playerBody, garbageBody) {
        if (this.checkConnectingPossibility(playerBody, garbageBody)) {
            return playerBody;
        }
        return null;
    }

    checkConnectingPossibility(bodyA, bodyB) {
        return bodyA.getFreeBonds() && bodyB.getFreeBonds();
    }

    updateGarbageConnectingPossibility() {
        //do nothing
    }

    updateGarbageConnectingPossibilityForPlayer() {
        //do nothing
    }

    checkParticleAvailabilityForPlayer() {
        return NaN;
    }

    getColorForPlayer() {

    }
}

module.exports = ChemistrySimple;