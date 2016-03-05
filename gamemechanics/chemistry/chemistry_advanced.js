/**
 * Created by fatman on 26/02/16.
 */

'use strict';

let Messages = require("../../messages");
let params = require("db_noch");
let Matter = require('matter-js/build/matter.js');

let Engine = Matter.Engine,
    World = Matter.World,
    Bodies = Matter.Bodies,
    Body = Matter.Body,
    Composite = Matter.Composite;

class ChemistryAdvanced {

    constructor(context) {
        this.context = context;
    }

    setElement(elem, particle) {
        if (elem) {
            let element = params.getParameter(elem);
            let previousElement = null;
            if (particle.body.element) {
                previousElement = params.getParameter(particle.body.element);
                particle.body.energy -= previousElement.energy;
            }
            particle.body.element = elem;

            particle.body.energy += element.energy;

            let coefficient = (element.radius + particle.CHARGE_RADIUS)
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
                let angle = 0;
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
            if (previousElement) {
                particle.body.emitter.emit("element changed", { body: particle.body});
            }
        }
    }

    getBondParams(bodyA, bodyB) {
        return params.getParameter(([bodyA.element,
            bodyB.element].sort()).join(''));
    }

    checkConnectingPossibilityGeneral(player, garbageBody, checkFunction) {
        return player.resultDST(player.body, checkFunction, garbageBody)
    }

    getColorForPlayer(body, playNumber) {
        if (this.context.players[playNumber].isStub || this.checkParticleAvailabilityForPlayer(body, playNumber)) {
            return 'green';
        }
        return 'grey'
    }

    checkConnectingPossibility(bodyA, bodyB) {
        if (bodyA.getFreeBonds() && bodyB.getFreeBonds()) {
            let bond = params.getParameter(([bodyA.element,
                bodyB.element].sort()).join(''));

            if (bond && (bodyA.energy - bond[bodyA.element]) >= 0 &&
                (bodyB.energy - bond[bodyB.element]) >= 0) {
                return bodyA;
            }
        }
        return false;
    }

    calculateEnergy(body) {
        let energy = 0;
        let neighbours = body.chemicalChildren.concat([body.chemicalParent]);
        for (let i = 0; i < neighbours.length; ++i) {
            if (neighbours[i]) {
                let bond = this.getBondParams(body, neighbours[i]);
                if (bond) {
                    energy += bond[body.element];
                }
            }
        }
        return energy;
    }

    isImpossible(body) {
        return body.chemicalBonds > body.elValency||
            this.calculateEnergy(body) > body.energy;
    }

    balanceEnergy(body) {
        let bond = this.getBondParams(body, body.chemicalParent);
        body.energy += bond[body.element];
        body.chemicalParent.energy += bond[body.chemicalParent.element];
    }

    findBodyToConnect(playerBody, garbageBody) {
        return this.checkConnectingPossibilityGeneral(this.context.getPlayer(playerBody),
            garbageBody, this.checkConnectingPossibility);
    }

    updateGarbageConnectingPossibility() {
        for (let i = 0; i < this.context.garbage.length; ++i) {
            if (this.context.garbage[i]) {
                let playersWhoSee = this.context.garbage[i].body.playersWhoSee;
                for (let j = 0; j < playersWhoSee.length; ++j) {
                    if (this.checkConnectingPossibilityGeneral(
                            this.context.players[playersWhoSee[j]],
                            this.context.garbage[i].body, this.checkConnectingPossibility)) {
                        this.context.websocketservice.sendToPlayer(
                            Messages.newGarbageAvailable(this.context.garbage[i].body.id),
                            this.context.players[playersWhoSee[j]])
                    } else {
                        this.context.websocketservice.sendToPlayer(
                            Messages.garbageIsNotAvailableAnymore(this.context.garbage[i].body.id),
                            this.context.players[playersWhoSee[j]])
                    }
                }
            }
        }
    }

    updateGarbageConnectingPossibilityForPlayer(playerIndex) {
        for (let i = 0; i < this.context.garbage.length; ++i) {
            if (this.context.garbage[i] && playerIndex in this.context.garbage[i].body.playersWhoSee) {
                if (this.checkConnectingPossibilityGeneral(
                        this.context.players[playerIndex],
                        this.context.garbage[i].body, this.checkConnectingPossibility)) {
                    this.context.websocketservice.sendToPlayer(
                        Messages.newGarbageAvailable(this.context.garbage[i].body.id),
                        this.context.players[playerIndex])
                } else {
                    this.context.websocketservice.sendToPlayer(
                        Messages.garbageIsNotAvailableAnymore(this.context.garbage[i].body.id),
                        this.context.players[playerIndex])
                }
            }
        }
    }

    checkParticleAvailabilityForPlayer(particle, playerNumber) {
        return !!this.checkConnectingPossibility(
            this.context.players[playerNumber].body, particle.body);
    }
}

module.exports = ChemistryAdvanced;