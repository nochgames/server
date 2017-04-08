/**
 * Created by fatman on 01/02/16.
 */

'use strict';

var Matter = require('matter-js/build/matter.js');
var Engine = Matter.Engine,
    World = Matter.World,
    Bodies = Matter.Bodies,
    Body = Matter.Body,
    Composite = Matter.Composite;

var config = require('config-node');

class Map {
    constructor(engine) {
        this.engine = engine;
        this.border = [];
        this.radius = config.game.map.gameDiameter / 2;

        this.radius = config.game.map.gameDiameter / 2;

        this.offsetBorder = this.radius * config.game.map.borderOffsetPortion;
        this.playerAreaRadius = this.radius * config.game.map.playerAreaPortion;

        this.borderPartLength = config.game.map.borderPartLength;
        this.borderPartHeight = config.game.map.borderPartHeight;
    }


    createFullBorder() {
        const BORDER_PART_LENGTH = this.borderPartLength;
        const BORDER_PART_HEIGHT = this.borderPartHeight;

        const center = { x: this.radius, y: this.radius };

        var step = Math.asin(BORDER_PART_LENGTH / 2 / this.radius) * 2;

        for (let i = step / 2; i <= Math.PI * 2; i += step) {
            let borderBody =
                Bodies.rectangle(center.x - this.radius * Math.cos(i),
                    center.y - this.radius * Math.sin(i),
                    BORDER_PART_HEIGHT, BORDER_PART_LENGTH, { isStatic: true,
                        angle: i });

            var borderPart = { body: borderBody };
            borderBody.circleRadius = BORDER_PART_LENGTH * 2;
            borderBody.inGameType = "Border";
            borderBody.playersWhoSee = [];

            World.addBody(this.engine.world, borderBody);
            this.border.push(borderPart);
        }
    }

    getRandomPositionInside(areaRadiusMin, areaRadiusMax) {
        if (!areaRadiusMin) areaRadiusMin = 0;
        if (!areaRadiusMax) areaRadiusMax = this.radius;

        var angle = Math.random() * 2 * Math.PI;

        var radius = Math.random() * (areaRadiusMax - areaRadiusMin) + areaRadiusMin;
        return { x: this.radius + radius * Math.sin(angle),
            y: this.radius + radius * Math.cos(angle)
        };
    }

    getRandomPositionOuter() {
        return this.getRandomPositionInside(this.playerAreaRadius,
            this.radius - this.offsetBorder);
    }

    getRandomPositionInner() {
        return this.getRandomPositionInside(0, this.playerAreaRadius);
    }
}

module.exports = Map;