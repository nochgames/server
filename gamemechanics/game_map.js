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
var params = require("db_noch");
params.connect();

var Map = function(engine) {
    this.engine = engine;
    this.border = [];
    this.radius = params.getParameter("gameDiameter") / 2;
};

Map.prototype = {
    createFullBorder: function() {
        const BORDER_PART_LENGTH = params.getParameter("borderPartLength");
        const BORDER_PART_HEIGHT = params.getParameter("borderPartHeight");

        var center = { x: this.radius, y: this.radius };

        var step = Math.asin(BORDER_PART_LENGTH / 2 / this.radius) * 2;

        for (let i = step / 2; i <= Math.PI * 2; i += step) {
            var borderBody =
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
    },

    getRandomPositionInside: function(areaRadiusMin, areaRadiusMax) {
        if (!areaRadiusMin) areaRadiusMin = 0;
        if (!areaRadiusMin) areaRadiusMax = this.radius;

        var angle = Math.random() * 2 * Math.PI;

        var radius = Math.random() * (areaRadiusMax - areaRadiusMin) + areaRadiusMin;
        return { x: this.radius + radius * Math.sin(angle),
            y: this.radius + radius * Math.cos(angle)
        };
    }
};

module.exports = Map;