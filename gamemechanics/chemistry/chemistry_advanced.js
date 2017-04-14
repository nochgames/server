/**
 * Created by fatman on 26/02/16.
 */

'use strict';

var Util_tools = require("../../util_tools");
let Messages = require("../../messages");
let Matter = require('matter-js/build/matter.js');

var config = require('config-node');

let Engine = Matter.Engine,
    World = Matter.World,
    Bodies = Matter.Bodies,
    Body = Matter.Body,
    Composite = Matter.Composite;

class ChemistryAdvanced {

    constructor(context) {
        this.context = context;
        var elements = config.game.chemistry.elements;
        this.testObjects = [];
        let element;
        for (let i = 0; i < elements; ++i) {
            element = config.game.chemistry[elements[i]];
            this.testObjects.push({
                element: elements[i],
                energy: element.energy
            })
        }
    }

    subtractBondEnergy(bodyA, bodyB) {
        var bond = this.getBondParams(bodyA, bodyB);
        bodyA.energy -= bond[bodyA.element];
        bodyB.energy -= bond[bodyB.element];
    }

    setElement(elem, particle) {
        if (!elem) return;
        this.recalculateEnergy(particle.body, elem);

        var element = config.game.chemistry[elem];
        let previousElement = null;
        if (particle.body.element) {
            previousElement = config.game.chemistry[particle.body.element];
            particle.body.energy -= previousElement.energy;
        }

        particle.body.energy += element.energy;

        while (this.isImpossible(particle.body)) {
            particle.dismountLightestBranch(this.context.engine);
        }

        particle.body.element = elem;

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

    recalculateEnergy(body, newElement) {
        let neighbours = body.chemicalChildren.concat([body.chemicalParent]);
        for (let i = 0; i < neighbours.length; ++i) {
            if (!neighbours[i]) continue;
            let bond = this.getBondParams(body, neighbours[i]);

            let newBond = this.getBondParams({ element: newElement }, neighbours[i]);
            if (!newBond) {
                this.context.getMainObject(body).dismountBranch(neighbours[i], this.context.engine);
            } else {
                body.energy += bond[body.element];
                neighbours[i].energy += bond[neighbours[i].element];
                body.energy -= newBond[newElement];
                neighbours[i].energy -= newBond[neighbours[i].element];
            }
        }
    }

    dismountImpossibleBonds(body, element) {

        for (let i = 0; i < body.chemicalChildren.length; ++i) {
            if (body.chemicalChildren[i] && !this.getBondParams({ element: element }, body.chemicalChildren[i])) {
                this.context.getMainObject(body).dismountBranch(body.chemicalChildren[i], this.context.engine);
            }
        }

        if (body.chemicalParent && !this.getBondParams({ element: element }, body.chemicalParent)) {
            this.context.getMainObject(body).dismountBranch(body.chemicalParent, this.context.engine);
        }
    }

    getBondParams(bodyA, bodyB) {
        return config.game.chemistry.connections[([bodyA.element,
            bodyB.element].sort()).join('')];
    }

    checkConnectingPossibilityGeneral(player, garbageBody, checkFunction) {
        return player.resultDST(player.body, checkFunction, garbageBody)
    }

    getColorForPlayer(body, playNumber) {
        if (this.context.players[playNumber].isStub ||
            this.checkParticleAvailabilityForPlayer(body, playNumber)) {
            return 'green';
        }
        return 'grey'
    }

    checkConnectingPossibility(bodyA, bodyB) {

        if (bodyA.inGameType == 'garbage') {

            if (bodyA.chemicalParent) console.log("id " + bodyA.chemicalParent.id);
            if (bodyA.chemicalChildren)
                console.log(bodyA.chemicalChildren.map(child => {
                    return child.id
                }));
            Util_tools.handleError("id is considered player, but is garbage: " + bodyA.id, false);
        }

        if (bodyA.getFreeBonds() && bodyB.getFreeBonds()) {
            let bond = config.game.chemistry.connections[(
                [bodyA.element, bodyB.element].sort()).join('')];

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
            if (!neighbours[i]) continue;
            let bond = this.getBondParams(body, neighbours[i]);
            if (bond) {
                energy += bond[body.element];
            }
        }
        return energy;
    }

    isImpossible(body) {
        if (body.energy < 0 && body.chemicalBonds == 0) {
            Util_tools.handleError("Body with negative energy has no bonds. id:" + body.id);
        }
        return body.chemicalBonds > body.elValency ||
            this.calculateEnergy(body) > body.energy;
    }

    balanceEnergy(body) {
        let bond = this.getBondParams(body, body.chemicalParent);
        body.energy += bond[body.element];
        body.chemicalParent.energy += bond[body.chemicalParent.element];
    }

    findBodyToConnect(playerBody, garbageBody) {
        return this.checkConnectingPossibilityGeneral(
            this.context.getPlayer(playerBody),
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

            if (this.context.garbage[i] &&
                this.context.garbage[i].body.playersWhoSee.indexOf(playerIndex) != -1) {

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

    updateElementConnectionPossibility(playerIndex) {
        for (let i = 0; i < this.testObjects.length; ++i) {
            if (this.checkConnectingPossibilityGeneral(
                this.context.players[playerIndex],
                this.testObjects[i], this.checkConnectingPossibility)) {
                //TODO: figure out way to draw player parts differently
            }
        }
    }

    checkParticleAvailabilityForPlayer(particle, playerNumber) {
        return !!this.checkConnectingPossibilityGeneral(
            this.context.players[playerNumber], particle.body, this.checkConnectingPossibility);
    }
}

module.exports = ChemistryAdvanced;