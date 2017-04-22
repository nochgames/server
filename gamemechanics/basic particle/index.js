/**
 * Created by fatman on 06/08/15.
 */

'use strict';

var Util_tools = require("../../util_tools");
var Geometry = require("geometry_noch");
var Matter = require('matter-js/build/matter.js');
var config = require('config-node')();
var elements = config.game.chemistry.elements;

var Engine = Matter.Engine,
    World = Matter.World,
    Bodies = Matter.Bodies,
    Body = Matter.Body,
    Composite = Matter.Composite,
    Vector = Matter.Vector;

class BasicParticle {
    constructor(position, engine, elem, emitter, chemistry) {
        this.CHARGE_RADIUS = 8;

        //creating physics body for player
        var element = config.game.chemistry[elem];
        this.body = Bodies.circle(position.x, position.y,
            element.radius + this.CHARGE_RADIUS,
            {restitution: 0.99});

        this.body.occupiedAngle = null;
        this.body.inertia = 0;
        this.body.inverseInertia = 0;

        this.body.emitter = emitter;
        this.body.playersWhoSee = [];

        /*Object.defineProperty(this.body, "energy",
         { set: function(value) { if (value > 0) this } });*/
        this.body.energy = 0;
        this.body.chemicalChildren = [];

        this.body.chemistry = chemistry;
        chemistry.setElement(elem, this);

        this.body.bondAngles = [];
        var angle = 0;
        for (let i = 0; i < this.body.elValency; ++i) {
            this.body.bondAngles.push({"angle": angle, "available": true});
            angle += 2 * Math.PI / this.body.elValency;
        }

        World.addBody(engine.world, this.body);

        var self = this;
        this.body.previousLocalPosition = {x: 0, y: 0};
        this.body.superMutex = 0;
        this.body.chemicalBonds = 0;
        this.body.intervalID = null;

        this.body.getFreeBonds = function () {
            return self.body.elValency - self.body.chemicalBonds;
        };
        this.body.getAvailableNeutrons = function () {
            return self.body.maxNeutrons - self.body.neutrons;
        }
    }

    traversDST(node, visit, visitAgain, engine) {
        visit(node, engine);
        if (!node.chemicalChildren) {
            if (visitAgain) {
                visitAgain(node);
            }
            return;
        }
        for (let i = 0; i < node.chemicalChildren.length; ++i) {
            if (node.chemicalChildren[i]) {
                if (node.constraint1 && !node.chemicalParent) {
                    Util_tools.handleError(node.id + " has constraint and no parent" +
                        node + " " + node.player.body.id);
                }
                this.traversDST(node.chemicalChildren[i], visit, visitAgain, engine);
            }
        }
        if (visitAgain) {
            visitAgain(node);
        }
    }

    resultDST(node, visit, additionalParameter) {
        var result = visit(node, additionalParameter);
        if (result) {
            return result
        }
        if (!node.chemicalChildren) {
            return false;
        }
        for (var i = 0; i < node.chemicalChildren.length; ++i) {
            if (node.chemicalChildren[i]) {
                result = this.resultDST(node.chemicalChildren[i], visit, additionalParameter);
                if (result) {
                    return result;
                }
            }
        }
        return false;
    }

    //second part of disconnecting body from player
    letGo(body) {
        body.chemicalChildren = [];
        var speed = Math.random() * 3;

        var pos;
        if (body.parentPosition) {
            pos = body.parentPosition;
            delete body.parentPosition;
        } else {
            pos = { x: Math.random(), y: Math.random() };
        }

        var mx = body.position.x - pos.x;
        var my = body.position.y - pos.y;

        Matter.Body.setVelocity(body, {
            x: speed * mx / Math.sqrt(mx * mx + my * my),
            y: speed * my / Math.sqrt(mx * mx + my * my)
        });
    }

    //first part of disconnecting body from player
    free(node, engine) {
        clearInterval(node.intervalID);
        node.collisionFilter.mask = 0x0001;
        //node.inGameType = "temporary undefined";

        if (node.constraint1) {
            for (let i = 0; i < node.bondAngles.length; ++i) {
                if (node.bondAngles[i].angle ==
                    node.constraint2.chemicalAngle) {
                    node.bondAngles[i].available = true;
                }
            }

            if (node.chemicalParent) {
                for (let i = 0; i < node.chemicalParent.bondAngles.length; ++i) {
                    if (node.chemicalParent.bondAngles[i].angle ==
                        node.constraint1.chemicalAngle) {
                        node.chemicalParent.bondAngles[i].available = true;
                    }
                }
            } else {
                Util_tools.handleError('constraint is here, but there is no parent though ' + node.id);
            }

            World.remove(engine.world, node.constraint1);
            World.remove(engine.world, node.constraint2);
            delete node["constraint1"];
            delete node["constraint2"];
        }

        if (node.chemicalParent) {
            node.emitter.emit('decoupled', { decoupledBodyA: node.chemicalParent,
                                            decoupledBodyB: node, p: node.player });

            node.chemistry.balanceEnergy(node);

            delete node.chemicalParent.chemicalChildren[
                node.chemicalParent.chemicalChildren.indexOf(node)];

            if (node.occupiedAngle) {
                node.chemicalParent.bondAngles.forEach(function(obj) {
                    if (obj.angle == node.occupiedAngle) {
                        obj.available = true;
                    }
                });
                node.occupiedAngle = null;
            }


            if (node.chemicalParent.chemicalBonds && node.bondType) {
                node.chemicalParent.chemicalBonds -= node.bondType;
                console.log(node.chemicalParent.chemicalBonds);
            }
            node.parentPosition = node.chemicalParent.position;
            delete node.chemicalParent;
        }

        if (node.player.body != node) {
            node.player.body.realMass -= node.mass;
            node.player.deleteFromMoleculeId(node.element);
            //console.log(node.player.moleculeId);
        }

        node.collisionFilter.group = 0;
        if (node.chemicalBonds && node.bondType) {
            node.chemicalBonds -= node.bondType;
            console.log(node.chemicalBonds);
            node.bondType = 0;
        }

        node.emitter.emit('became garbage', { garbageBody: node });

        node.chemistry.updateGarbageConnectingPossibilityForPlayer(node.playerNumber);

        if (node.inGameType != 'player') {
            node.inGameType = "garbage";
            node.playerNumber = -1175;
        }
    }

    connectBody(garbageBody, finalCreateBond, type) {
        var i = 0;
        var N = 30;     // Number of iterations

        this.body.player.addToMoleculeId(garbageBody.element);

        garbageBody.collisionFilter.mask = 0x0008;      // turn off collisions

        var currentAngle = Geometry.findAngle(this.body.position,
            garbageBody.position, this.body.angle);
        var angle = this.getClosestAngle(currentAngle);
        garbageBody.occupiedAngle = angle;

        var realAngle = angle;

        if (currentAngle > 3 * Math.PI / 2 && angle == 0) realAngle = 2 * Math.PI;
        var difference = realAngle - currentAngle;
        if (Math.abs(difference) > Math.PI) {
            difference = difference < 0 ? 2 * Math.PI +
                difference : difference - 2 * Math.PI;
        }

        N = Math.abs(Math.round(N / Math.PI / 2 * difference)) * 2 + 1;
        var step = difference / N;

        var self = this;
        garbageBody.intervalID = setInterval(function () {
            var pos1 = self.body.position;

            var ADDITIONAL_LENGTH = 20;

            var delta = {
                x: ((self.body.circleRadius + garbageBody.circleRadius
                + ADDITIONAL_LENGTH)
                * Math.cos(currentAngle + step * i + self.body.angle)
                + pos1.x - garbageBody.position.x) /*/ (N - i)*/,
                y: ((self.body.circleRadius + garbageBody.circleRadius
                + ADDITIONAL_LENGTH)
                * Math.sin(currentAngle + step * i + self.body.angle)
                + pos1.y - garbageBody.position.y) /*/ (N - i)*/
            };

            Body.translate(garbageBody, {
                x: delta.x,
                y: delta.y });

            if (i++ === N) {
                clearInterval(garbageBody.intervalID);

                var garbageAngle = self.correctParentBond.call(self, garbageBody, self.body);

                garbageBody.occupiedAngle = null;
                if (finalCreateBond) {
                    finalCreateBond(self.body, garbageBody, angle, garbageAngle, type);
                }
            }
        }, 30);
    }

    setElement(elem) {
        if (elem) {
            var element = config.game.chemistry[elem];
            if (!element) {
                Util_tools.handleError('Element from setElement not found in library: ' + elem);
            }
            this.body.element = elem;
            var coefficient = (element.radius + this.CHARGE_RADIUS)
                / this.body.circleRadius;

            Body.scale(this.body, coefficient, coefficient);
            this.body.circleRadius = element.radius + this.CHARGE_RADIUS;

            this.body.elValency = element.valency;
            this.body.nuclearSpeed = element.speed;
            this.body.realMass -= this.body.mass;
            this.body.mass = element.mass;
            this.body.realMass += this.body.mass;
            this.body.inverseMass = 1 / element.mass;
            this.body.coolDown = element.coolDown;
            this.body.neutrons = element.neutrons;
            this.body.maxNeutrons = element.maxNeutrons;

            if (this.body.bondAngles) {
                var angle = 0;
                while (this.body.bondAngles.length < this.body.elValency) {
                    this.body.bondAngles.push({ "angle": 0, "available": true });
                }
                for (let i = 0; i < this.body.elValency; ++i) {
                    this.body.bondAngles[i].angle = angle;
                    angle += 2 * Math.PI / this.body.elValency;
                }
                while (this.body.bondAngles.length > this.body.elValency) {
                    this.body.bondAngles.pop();
                }
            }
            this.body.emitter.emit("element changed", { body: this.body });
        }
    }

    createNucleon(particle, shotPos, nucleonsArray, engine) {
        var element = config.game.chemistry[particle];

        var OFFSET_SHOT = 20;

        if (particle != "ph") {
            this.body.mass -= element.mass;
        }

        var offset = this.body.circleRadius + OFFSET_SHOT;

        var mx = shotPos.x;
        var my = shotPos.y;

        var nucleon = {};

        var nucleonBody = Bodies.circle(this.body.position.x
            + offset * mx / Math.sqrt(mx * mx + my * my),
            this.body.position.y + offset * my
            / Math.sqrt(mx * mx + my * my), element.radius,
            {frictionAir: 0, restitution: 0.99, collisionFilter:
            { mask: 0x0007 }});

        nucleonBody.inGameType = nucleonBody.element = particle;

        Matter.Body.setVelocity(nucleonBody, Vector.create(
            element.speed * mx / Math.sqrt(mx * mx + my * my),
            element.speed * my / Math.sqrt(mx * mx + my * my))
        );

        nucleon.body = nucleonBody;
        nucleon.body.playersWhoSee = [];
        World.addBody(engine.world, nucleonBody);
        nucleonsArray.push(nucleon);
        nucleonBody.number = nucleonsArray.indexOf(nucleon);
        this.body.emitter.emit('particle appeared', { body: nucleonBody });
        return nucleonBody;
    }

    prepareForBond(newPlayerBody) {
        this.traversDST(this.body, function(node) {

            node.inGameType += " temporary undefined";

            if (newPlayerBody) {
                node.playerNumber = newPlayerBody.playerNumber;
            }
        });
    }

    markAsPlayer(newPlayerBody) {
        this.traversDST(this.body, function(node) {

            node.inGameType = "playerPart";
            node.playerNumber = newPlayerBody.playerNumber;

            node.emitter.emit('became playerPart', { garbageBody: node });
        });
    }

    die(engine) {
        this.traversDST(this.body, this.free, this.letGo, engine);
    }

    reverseFWD() {
        let exPlayer;
        let prevParent;
        let prevConstraint1;
        let prevConstraint2;
        let prevChildren;

        let node = this.body;

        let isFirst = true;

        while (node) {
            let parent = node;
            let cons1 = node.constraint1;
            let cons2 = node.constraint2;
            let childeren = node.chemicalChildren;

            if (prevParent) {
                node.chemecalParent = prevParent;
                node.constraint1 = prevConstraint1;
                node.constraint2 = prevConstraint2;
                Util_tools.addToArray(prevChildren, node);
            }

            prevParent = parent;
            prevConstraint1 = cons1;
            prevConstraint2 = cons2;
            prevChildren = childeren;

            if (!isFirst) {
                exPlayer = node;
            } else {
                isFirst = false;
            }

            node = node.chemecalParent;
        }
        return exPlayer;
    }

    checkDecoupling(momentum, engine) {
        var bondStrength = 30;
        if (momentum > bondStrength && this.body.chemicalBonds) {
            this.traversDST(this.body, this.free, this.letGo, engine);
            if (this.body.player) {
                this.body.player.checkResizeShrink();
            }
        }
    }

    getClosestAngle(angle) {
        //console.log("given angle " + angle);
        var bondAngles = this.body.bondAngles;
        var difference = this.body.bondAngles.map(function(obj) {
            var diff = Math.abs(obj.angle - angle);
            if (angle > Math.PI / 2 * 3 && obj.angle == 0) diff = 0;
            if(!obj.available) diff = Infinity;
            return {"diff": diff,
                    "index": bondAngles.indexOf(obj)};
        }).sort(function(a, b) {
            return a.diff - b.diff;
        });
        for (let i = 0; i < bondAngles.length; ++i) {
            if (bondAngles[i].available) {
                //console.log("possible angle " + bondAngles[i].angle);
            }
        }
        this.body.bondAngles[difference[0].index].available = false;
        //console.log("closest angle " + this.body.bondAngles[difference[0].index].angle);
        return this.body.bondAngles[difference[0].index].angle;
    }

    freeBondAngle(angle) {
        for (let i = 0; i < this.body.bondAngles.length; ++i) {
            if (this.body.bondAngles[i].angle == angle) {
                this.body.bondAngles[i].available = true;
            }
        }
    }

    reconnectBond(child, engine) {
        if (child.constraint2) {
            this.freeBondAngle.call({body: child}, child.constraint2.chemicalAngle);

            World.remove(engine.world, child.constraint1);
            World.remove(engine.world, child.constraint2);
            delete child["constraint1"];
            delete child["constraint2"];
        }

        this.connectBody(child, function(playerBody, garbageBody, angle, garbageAngle) {
            var stiffness = 0.05;

            var constraintA = Matter.Constraint.create({
                bodyA: playerBody, bodyB: garbageBody,
                pointA: {
                    x: garbageBody.position.x - playerBody.position.x,
                    y: garbageBody.position.y - playerBody.position.y
                }, stiffness: stiffness
            });
            var constraintB = Matter.Constraint.create({
                bodyA: garbageBody, bodyB: playerBody,
                pointA: {
                    x: playerBody.position.x - garbageBody.position.x,
                    y: playerBody.position.y - garbageBody.position.y
                }, stiffness: stiffness
            });

            garbageBody.constraint1 = constraintA;
            garbageBody.constraint1.chemicalAngle = angle;
            garbageBody.constraint2 = constraintB;
            garbageBody.constraint2.chemicalAngle = garbageAngle;
            World.add(engine.world, [constraintA, constraintB]);
            garbageBody.collisionFilter.mask = 0x0001;
        });
    }

    correctBondAnglesFinal(engine) {
        var body = this.body;
        for (let i = 0; i < body.chemicalChildren.length; ++i) {

            var child = body.chemicalChildren[i];

            if (child) {
                this.reconnectBond(child, engine);
            }
        }
    }

    changeCharge(value, engine, nucleonsArray) {

        this.CHARGE_RADIUS = 5;

        if (this.body.element == "Ne" && value == 1) {
            value = -1;
            this.createNucleon("p", { x: Math.random(), y: Math.random() },
                nucleonsArray, engine);
            this.createNucleon("p", { x: Math.random(), y: Math.random() },
                nucleonsArray, engine);
        }

        var elementName = elements[elements.indexOf(
            this.body.element) + value];

        this.body.chemistry.setElement(elementName, this);

        for (let i = 0; i < this.body.bondAngles.length; ++i) {
            this.body.bondAngles[i].available = true;
        }

        for (let i = 0; i < this.body.chemicalChildren.length; ++i) {
            if (this.body.chemicalChildren[i]) {
                clearInterval(this.body.chemicalChildren[i].intervalID);
            }
        }

        if (this.body.chemicalBonds) {
            this.correctBondAngles(engine);
        }
    }

    correctParentBond(garbageBody, parentBody) {
        var rotationAngle = Geometry.findAngle(garbageBody.position,
            parentBody.position, garbageBody.angle);

        var garbageAngle = this.getClosestAngle.call({ body: garbageBody }, rotationAngle);

        Body.rotate(garbageBody, (rotationAngle - garbageAngle));
        return garbageAngle;
    }

    correctBondAngles(engine) {
        if (this.body.inGameType == 'player') {
            this.correctBondAnglesFinal(engine);
        } else {
            //Note: body can have chemicalParent but no constraints if
            //chemicalParent is in state of reconnecting THIS particle.
            if (this.body.chemicalParent && this.body.constraint1) {
                this.freeBondAngle.call({ body: this.body.chemicalParent },
                    this.body.constraint1.chemicalAngle);
                //this.freeBondAngle(this.constraint2.chemicalAngle);
                var self = {};
                self.connectBody = this.connectBody;
                self.freeBondAngle = this.freeBondAngle;
                self.correctParentBond = this.correctParentBond;
                self.getClosestAngle = this.getClosestAngle;
                self.body = this.body.chemicalParent;

                this.reconnectBond.call(self, this.body, engine);
            }
            this.correctBondAnglesFinal(engine);
        }
    }

    dismountBranch(body, engine) {
        this.traversDST(body, this.free, this.letGo, engine);
    }

    dismountLightestBranch(engine) {
        if (this.body.inGameType == 'player') {
            let child = {
                body: null,
                mass: Infinity
            };

            for (let i = 0; i < this.body.chemicalChildren.length; ++i) {
                if (this.body.chemicalChildren[i]) {
                    var nextChild = {
                        body: this.body.chemicalChildren[i],
                        mass: this.calculateMass(this.body.chemicalChildren[i])
                    };
                    if (nextChild.mass < child.mass) child = nextChild;
                }
            }

            this.traversDST(child.body, this.free, this.letGo, engine);

            if (!this.body.chemicalBonds) this.checkResizeShrink();
        } else {
            if (this.body.chemicalBonds > 1) {
                let child = null;
                while (!child) {
                    child = this.body.chemicalChildren.pop();
                }
                if (!child) Util_tools.handleError(
                    "Tried to dismount branch, but no children were found. id: " + this.body.id);
                this.traversDST(child, this.free, this.letGo, engine);
            } else {
                this.traversDST(this.body, this.free, this.letGo, engine);
            }
        }
    }
}

module.exports = BasicParticle;
