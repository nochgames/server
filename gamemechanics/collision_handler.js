/**
 * Created by fatman on 10/02/16.
 */

'use strict';

var Messages = require("../messages");
var Matter = require('matter-js/build/matter.js');
var config = require('config-node');
var Util_tools = require("../util_tools");
var Engine = Matter.Engine,
    World = Matter.World,
    Bodies = Matter.Bodies,
    Body = Matter.Body,
    Composite = Matter.Composite;


var CollisionHandler = function(context) {
    this.context = context;
    var self = this;
    Matter.Events.on(context.engine, 'collisionStart', function(event) {
        var pairs = event.pairs;
        for (let i = 0; i < pairs.length; i++) {
            var bodyA = pairs[i].bodyA;
            var bodyB = pairs[i].bodyB;

            if (bodyA.collisionFilter.mask == 8 ||
                bodyB.collisionFilter.mask == 8) {
                //console.log("Same body is processed again");
                continue;
            }

            if ((bodyA.inGameType  == "player" ||
                bodyA.inGameType  == "playerPart") &&
                bodyB.inGameType  == "garbage") {
                self.collideWithGarbage(bodyA, bodyB);
            } else if (bodyA.inGameType  == "garbage" &&
                (bodyB.inGameType  == "player" ||
                bodyB.inGameType  == "playerPart")) {
                self.collideWithGarbage(bodyB, bodyA);
            } else if (bodyA.inGameType  == "p" &&
                (bodyB.inGameType  == "player" ||
                bodyB.inGameType  == "playerPart" ||
                bodyB.inGameType  == "garbage")) {
                self.collideWithProton(bodyB, bodyA);
            } else if (bodyB.inGameType  == "p" &&
                (bodyA.inGameType  == "player"||
                bodyA.inGameType  == "playerPart" ||
                bodyA.inGameType  == "garbage")) {
                self.collideWithProton(bodyA, bodyB);
            } else if (bodyA.inGameType  == "ph" &&
                (bodyB.inGameType  == "player" ||
                bodyB.inGameType  == "playerPart" ||
                bodyB.inGameType  == "garbage")) {
                self.collideWithPhoton(bodyB, bodyA);
            } else if (bodyB.inGameType  == "ph" &&
                (bodyA.inGameType  == "player"||
                bodyA.inGameType  == "playerPart" ||
                bodyA.inGameType  == "garbage")) {
                self.collideWithPhoton(bodyA, bodyB);
            } else if (bodyB.inGameType  == "player" &&
                bodyA.inGameType  == "player" ||
                bodyB.inGameType  == "player" &&
                bodyA.inGameType  == "playerPart" ||
                bodyB.inGameType  == "playerPart" &&
                bodyA.inGameType  == "player" ||
                bodyB.inGameType  == "playerPart" &&
                bodyA.inGameType  == "playerPart") {
                self.collidePVP(bodyA, bodyB);
            } else if (bodyA.inGameType == "n" &&
                (bodyB.inGameType == "player" ||
                bodyB.inGameType == "garbage")) {
                self.collideWithNeutron(bodyB, bodyA);
            } else if (bodyB.inGameType == "n" &&
                (bodyA.inGameType == "player" ||
                bodyA.inGameType == "garbage")) {
                self.collideWithNeutron(bodyA, bodyB);
            } else if (config.game.map.deadlyBorder &&
                bodyA.inGameType == "Border") {
                self.collideWithBorder(bodyB);
            } else if (config.game.map.deadlyBorder &&
                bodyB.inGameType == "Border") {
                self.collideWithBorder(bodyA);
            }
        }
    });
};

CollisionHandler.prototype = {

    createBond: function(playerBody, garbageBody) {

        ++playerBody.chemicalBonds;
        ++garbageBody.chemicalBonds;

        this.context.chemistry.subtractBondEnergy(playerBody, garbageBody);

        this.link(garbageBody, playerBody);

        let player = this.context.getPlayer(playerBody);

        if (!player) console.log(
            "playerBody: type " + playerBody.inGameType +
                " id " + garbageBody.playerNumber +
                " garbageBody: type " + garbageBody.inGameType +
                " id " + garbageBody.playerNumber
        );

        var newRadius =
            Geometry.calculateDistance(player.body.position, garbageBody.position);

        garbageBody.player = player;
        player.checkResizeGrow(newRadius);

        player.recalculateMass();
        this.context.getMainObject(garbageBody).markAsPlayer(playerBody);
        this.context.getMainObject(playerBody).connectBody(garbageBody, this.createFinalCreateBond());
    },

    createFinalCreateBond: function() {

        function createBondConstraint(_bodyA, _bodyB, _stiffness) {
            return Matter.Constraint.create({bodyA: _bodyA, bodyB: _bodyB,
                pointA: { x: _bodyB.position.x - _bodyA.position.x,
                    y: _bodyB.position.y - _bodyA.position.y }, stiffness: _stiffness});
        }

        var context = this.context;

        return function(playerBody, garbageBody, angle1, angle2) {

            garbageBody.collisionFilter.mask = 0x0001;

            if (garbageBody.chemicalParent != playerBody ||
                playerBody.chemicalChildren.indexOf(garbageBody) == -1) {
                var message = "";
                if (garbageBody.chemicalChildren)
                    message += playerBody.chemicalChildren.map(
                        child => {return child.id});
                if (garbageBody.chemicalParent) {
                    message += "\nparent id " + garbageBody.chemicalParent.id +
                                "\nmask " + garbageBody.collisionFilter.mask;
                }
                Util_tools.handleError(message + "\nbodies are connected in a wrong way!\n" +
                    (garbageBody.player.body.id == playerBody.id) +
                    " garbageBody id " + garbageBody.id +
                    " playerBody id " + playerBody.id);
                if (config.noThrow)
                    return;
            }
            else if (playerBody.chemicalParent == garbageBody &&
                garbageBody.chemicalChildren.indexOf(playerBody) != -1) {
                Util_tools.handleError("reversed connection" +
                    " garbageBody id " + garbageBody.id +
                    " playerBody id " + playerBody.id);
                if (config.noThrow)
                    return;
            }

            var bondStiffness = 0.05;

            var constraintA = createBondConstraint(playerBody, garbageBody, bondStiffness);
            var constraintB = createBondConstraint(garbageBody, playerBody, bondStiffness);

            garbageBody.constraint1 = constraintA;
            garbageBody.constraint2 = constraintB;

            garbageBody.constraint1.chemicalAngle = angle1;
            garbageBody.constraint2.chemicalAngle = angle2;

            World.add(context.engine.world, [constraintA, constraintB]);

            context.playersEmitter.emit('bond created',
                {bc1: playerBody, bc2: garbageBody, p: context.getPlayer(playerBody)});
        }
    },

    link: function(child, parent) {
        Util_tools.addToArray(parent.chemicalChildren, child);
        child.chemicalParent = parent;
    },

    connectGarbageToPlayer: function(playerBody, garbageBody) {
        if (config.game.doReverseGarbage)
            this.context.getMainObject(garbageBody).reverse();
        this.context.getMainObject(garbageBody).prepareForBond();
        this.createBond(playerBody, garbageBody);
    },

    connectPlayers: function(bodyA, bodyB) {

        var massA = this.context.getPlayer(bodyA).body.realMass;
        var massB = this.context.getPlayer(bodyB).body.realMass;
        if (massA == massB) return;
        var playerBody = massA > massB ? bodyA : bodyB;
        var garbageBody = massA < massB ? bodyA : bodyB;

        ++this.context.getPlayer(playerBody).kills;
        this.context.playersEmitter.emit('player died', { player: this.context.getPlayer(garbageBody) });

        this.context.playersEmitter.emit('murder', { player: this.context.getPlayer(playerBody) });

        this.context.getPlayer(garbageBody).lose(this.context.engine,
            this.context.players, this.context.garbage, playerBody);
        var exPlayer = this.context.getMainObject(garbageBody).reverseFWD();

        if (exPlayer && !exPlayer.chemicalParent) {
            Util_tools.handleError("reverse failed to add parent to ex player, exPlayer id: "
                                    + exPlayer.id + exPlayer.constraint1);
        }

        if (garbageBody.chemicalChildren.indexOf(garbageBody.chemicalParent) != -1) {
            Util_tools.handleError("Reverse did not remove parent");
        }

        this.createBond(playerBody, garbageBody);
    },

    collideWithProton: function(elementBody, protonBody) {

        this.context.getMainObject(elementBody).changeCharge(1, this.context.engine, this.context.freeProtons);
        this.context.websocketservice.sendEverybody(
            Messages.changeElementGarbage(elementBody.id, elementBody.element));
        this.context.playersEmitter.emit('particle died', { id: protonBody.id,
            playersWhoSee: protonBody.playersWhoSee });
        this.context.recyclebin.prepareToDelete(protonBody);
    },

    collideWithPhoton: function(elementBody, photonBody) {
        var momentum = this.calculateMomentum(elementBody, photonBody);

        this.context.getMainObject(elementBody).
        checkDecoupling(momentum, this.context.engine);
    },

    collideWithNeutron: function(elementBody, neutronBody) {

        if (Math.sqrt(neutronBody.velocity.x * neutronBody.velocity.x +
                neutronBody.velocity.y * neutronBody.velocity.y) < 7) {
            this.context.playersEmitter.emit('particle died', { id: neutronBody.id,
                playersWhoSee: neutronBody.playersWhoSee });
            this.context.recyclebin.prepareToDelete(neutronBody);
            ++elementBody.mass;
        }
    },

    collideWithBorder: function(body) {
        if (body.inGameType == "player") {
            this.context.playersEmitter.emit('player died', { player: this.context.getPlayer(body) });
            this.context.players[body.number].die(this.context.engine);
            this.context.players[body.number].lose(this.context.engine,
                this.context.players, this.context.garbage);
            this.context.recyclebin.prepareToDelete(body);
        } else {
            this.context.recyclebin.prepareToDelete(body);
            this.context.playersEmitter.emit('particle died', { id: body.id,
                playersWhoSee: body.playersWhoSee });
        }
    },

    collideWithGarbage: function(playerBody, garbageBody) {

        let bodyToConnect = this.context.chemistry
            .findBodyToConnect(playerBody, garbageBody);

        if (bodyToConnect) {
            if (bodyToConnect.inGameType != "playerPart" &&
                bodyToConnect.inGameType != 'player') {
                var garbage = this.context.garbage.concat(
                    this.context.players.filter(player =>
                    {return player && !player.isStub && !player.isBot}));
                for (var i = 0; i < garbage.length; ++i) {
                    if (garbage[i] && garbage[i].body.chemicalChildren &&
                        garbage[i].body.chemicalChildren.indexOf(bodyToConnect) != -1) {
                        console.log("still in children of " + garbage[i].body.id);
                        if (config.noThrow)
                            Util_tools.deleteFromArray(garbage[i].body.chemicalChildren, bodyToConnect);
                    } else if (garbage[i] && garbage[i].body.chemicalParent == bodyToConnect) {
                        console.log("still parent of " + garbage[i].body.id);
                    }
                }
                Util_tools.handleError("body to connect " + bodyToConnect.inGameType);

                return;
            }

            this.connectGarbageToPlayer(bodyToConnect, garbageBody);
        } else if (playerBody.inGameType  == "playerPart") {
            var momentum = this.calculateMomentum(playerBody, garbageBody);

            this.context.getMainObject(playerBody).
            checkDecoupling(momentum, this.context.engine);
            this.context.getMainObject(garbageBody).
            checkDecoupling(momentum, this.context.engine);
        }
    },

    collidePVP: function(playerBodyA, playerBodyB) {

        if (playerBodyA.playerNumber == playerBodyB.playerNumber) return;
        if (this.context.chemistry.checkConnectingPossibility(playerBodyA, playerBodyB)) {
            this.connectPlayers(playerBodyA, playerBodyB);
        } else {
            var momentum = this.calculateMomentum(playerBodyA, playerBodyB);

            this.context.getMainObject(playerBodyA).
            checkDecoupling(momentum, this.context.engine);
            this.context.getMainObject(playerBodyB).
            checkDecoupling(momentum, this.context.engine);
        }
    },

    calculateMomentum: function(bodyA, bodyB) {
        return (bodyA.mass + bodyB.mass) * Math.sqrt((bodyA.velocity.x - bodyB.velocity.x) *
                (bodyA.velocity.x - bodyB.velocity.x) + (bodyA.velocity.y - bodyB.velocity.y) *
                (bodyA.velocity.y - bodyB.velocity.y));
    }
};

module.exports = CollisionHandler;