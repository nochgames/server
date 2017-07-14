/**
 * Created by fatman on 22/06/17.
 */

'use strict';

let Wanderer = require("../bot");
let config = require('config-node');

class PhysicsBot extends Wanderer {

    constructor(position, engine, elem, emitter,
                websocketservice, chemistry, color, context, name="Physics_") {

        super(position, engine, elem, emitter,
            websocketservice, chemistry, color, name);

        this.coefficients = {
            "Border": -6,
            "Bigger player": -5,
            "Smaller player that can be connected": 5,
            "Element that can be connected": 2,
            "Element that can't be connected": -1
        };

        this.resolution = {
            width: 1366,
            height: 720
        };

        this.context = context;
    }

    initBotLogic() {
        super.initBotLogic();
    }

    processBotLogic() {
        this.move();
        this.considerShooting();
    }

    move() {
        let force = this.calculateForceFromEnvironment();
        if (force.x != 0 && force.y != 0) {
            this.applyVelocity(force.x, force.y);
        }
        else
        {
            super.wander();
        }
    }

    considerShooting() {
        const particle = 'ph';
        if (!super.canShoot(particle)) return;

        let targets = this.context.players.filter(
            player => {return player && !player.isStub && player.body.id != this.body.id
                        && this.context.inScreen(player, this, 500)});

        if (targets.length == 0) return;

        targets.sort((plA, plB) => { return plA.body.realMass > plB.body.realMass;});

        let shotPos = { x: targets[0].body.position.x - this.body.position.x,
                        y: targets[0].body.position.y - this.body.position.y };

        super.shoot(particle, shotPos, this.context.freeProtons, this.context.engine);
    }

    calculateForceFromEnvironment() {
        let resultForce = {x:0, y:0};

        let addToResultForce = (objects, conditionsNames) => {
            for (let i = 0; i < objects.length; ++i) {
                for (let j = 0; j < conditionsNames.length; ++j) {
                    if (!conditionsNames[j].condition || conditionsNames[j].condition(objects[i])) {
                        let vec = new Vec(objects[i], this);
                        //console.log(conditionsNames[j].name);

                        let force = {};

                        let forceAbs = 1 / Math.pow(vec.length * 1000, 2);
                        force.x = vec.x * forceAbs * this.coefficients[conditionsNames[j].name];
                        force.y = vec.y * forceAbs * this.coefficients[conditionsNames[j].name];

                        resultForce.x += force.x;
                        resultForce.y += force.y;

                        //console.log(`${name} ${borderNearby[i].body.id} local pos x ${vec.x / vec.length} y ${vec.y / vec.length}
//force generated: x ${force.x} y ${force.y}`);
                    }
                }
            }
        };

        let borderNearby = this.context.border.filter(borderPart => {
            let vec = new Vec(this, borderPart);
            let length = vec.length;
            let radius = this.body.realRadius * 2 * this.body.speed;
            //console.log(`length ${length} distance ${radius}`);
            return this.context.inScreen(borderPart, this, 500) && length < radius;
        });

        addToResultForce(borderNearby, [{name:"Border"}]);

        let playersInScreen = this.context.players.filter(player => {
            return !player.isStub && this.context.inScreen(player, this, 500);
        });

        addToResultForce(playersInScreen, [
            {name:"Bigger player",
            condition: obj => {return obj.body.realMass > this.body.realMass}},
            {name: "Smaller player that can be connected",
            condition: obj => {return obj.body.realMass < this.body.realMass &&
                this.context.chemistry.checkConnectingPossibility(this.body, obj.body)}}]);

        let garbageInScreen = this.context.garbage.filter(singleGarbage => {
            return singleGarbage.body.inGameType == 'garbage' && this.context.inScreen(singleGarbage, this, 500);
        });

        let garbageThatCanBeConnected = garbageInScreen.filter(obj =>
            { return this.context.chemistry.findBodyToConnect(this.body, obj.body); });

        if (garbageThatCanBeConnected.length) {
            addToResultForce(garbageInScreen, [
                {
                    name: "Element that can be connected",
                    condition: obj => {
                        return this.context.chemistry.findBodyToConnect(this.body, obj.body)
                    }
                },
                {
                    name: "Element that can't be connected",
                    condition: obj => {
                        return !this.context.chemistry.findBodyToConnect(this.body, obj.body)
                    }
                }]);
        }

        let biggerDim = Math.abs(resultForce.y > resultForce.x ? resultForce.y : resultForce.x);

        if (biggerDim) {
            resultForce.x /= biggerDim;
            resultForce.y /= biggerDim;
        }

        let force = 22;

        resultForce.x *= force;
        resultForce.y *= force;

        return resultForce;
    }
}

class Vec {
    constructor(GameObjectLocal, GameObjectMain) {
        this.x = GameObjectLocal.body.position.x - GameObjectMain.body.position.x;
        this.y = GameObjectLocal.body.position.y - GameObjectMain.body.position.y;
        this.length = Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2));
    }
}

module.exports = PhysicsBot;