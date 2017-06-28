/**
 * Created by fatman on 01/02/16.
 */

'use strict';

const Matter = require('matter-js/build/matter.js');
const Util_tools = require("../util_tools");
const Engine = Matter.Engine,
    World = Matter.World,
    Bodies = Matter.Bodies,
    Body = Matter.Body,
    Composite = Matter.Composite;

const config = require('config-node');

class Map {
    constructor(engine, context) {
        this.engine = engine;
        this.context = context;

        this.border = [];

        this.radius = config.game.map.gameDiameter / 2;
        this.center = { x: this.radius, y: this.radius };

        this.offsetBorder = this.radius * config.game.map.borderOffsetPortion;
        this.playerAreaRadius = this.radius * config.game.map.playerAreaPortion;

        this.borderPartLength = config.game.map.borderPartLength;
        this.borderPartHeight = config.game.map.borderPartHeight;

        this.inscribedCircleSide = Math.sqrt(Math.pow(2 * this.radius, 2) / 2);
    }

    createFullBorder() {
        const BORDER_PART_LENGTH = this.borderPartLength;
        const BORDER_PART_HEIGHT = this.borderPartHeight;

        var step = Math.asin(BORDER_PART_LENGTH / 2 / this.radius) * 2;

        for (let i = step / 2; i <= Math.PI * 2; i += step) {
            let borderBody =
                Bodies.rectangle(this.center.x - this.radius * Math.cos(i),
                    this.center.y - this.radius * Math.sin(i),
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

    createGrid(sideSize) {

        let startPoint =
            { x: this.center.x - this.inscribedCircleSide / 2,
                y: this.center.y - this.inscribedCircleSide / 2 };

        let grid = [];

        for (let i = 0; i < sideSize; ++i) {
            grid[i] = [];
            for (let j = 0; j < sideSize; ++j) {
                grid[i][j] = false;
            }
        }

        let cellSide = this.inscribedCircleSide / sideSize;

        let garbage = this.context.garbage.filter(garbage => {return garbage});
        for (let i = 0; i < garbage.length; ++i) {
            let currentGarbage = garbage[i];
            let positionInSquare =
                { x: currentGarbage.body.position.x - startPoint.x,
                    y: currentGarbage.body.position.y - startPoint.y };
            if (positionInSquare.x < 0 || positionInSquare.y < 0) continue;

            let rowPos = Math.floor(positionInSquare.y / cellSide);
            let columnPos = Math.floor(positionInSquare.x / cellSide);

            let positions = [
                { x: columnPos, y: rowPos },
                { x: columnPos, y: rowPos - 1 },
                { x: columnPos, y: rowPos + 1 },
                { x: columnPos + 1, y: rowPos },
                { x: columnPos + 1, y: rowPos - 1},
                { x: columnPos + 1, y: rowPos + 1},
                { x: columnPos - 1, y: rowPos },
                { x: columnPos - 1, y: rowPos - 1 },
                { x: columnPos - 1, y: rowPos + 1 }
            ];

            let checkAndSetCell = (i, j, pos, body) => {
                if (grid[i][j]) return;

                let rect = { width: cellSide, height: cellSide,
                    x: (j + 0.5) * cellSide, y: (i + 0.5) * cellSide };


                pos.radius = body.radius;

                if (Util_tools.isCollidingRectCircle(rect, pos)) {
                    grid[i][j] = true;
                }
            };

            for (let i = 0; i < positions.length; ++i) {
                if (positions[i].x < sideSize && positions[i].y < sideSize &&
                    positions[i].x >= 0 && positions[i].y >= 0) {
                    checkAndSetCell(positions[i].y, positions[i].x, positionInSquare, currentGarbage.body);
                }
            }
        }

        if (config.game.map.outputGrid) {
            for (let i = 0; i < sideSize; ++i) {
                let row = '';
                for (let j = 0; j < sideSize; ++j) {
                    row += (grid[i][j] ? 'x' : ' ');
                }
                console.log(row);
            }
        }
    }
}

module.exports = Map;
