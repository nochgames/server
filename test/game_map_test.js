var assert = require('chai').assert;
var GameMap = require('../gamemechanics/game_map');
var Matter = require('matter-js/build/matter.js');
var Engine = Matter.Engine,
    World = Matter.World,
    Bodies = Matter.Bodies,
    Body = Matter.Body,
    Composite = Matter.Composite;
var params = require("db_noch");
params.connect();

describe('game_map', function() {
    var radius = params.getParameter("gameDiameter") / 2;

    describe('#createFullBorder', function() {
        var engine = Engine.create();
        var game_map = new GameMap(engine);
        game_map.createFullBorder();
        var allBodies = Composite.allBodies(engine.world);

        describe('should create a semi-circle out o physical bodies', function() {

            it('should add bodies to given engine world', function() {
                assert.isAbove(allBodies.length, 0);
            });

            it('should add enough bodies to create a semi-circle', function() {

                var BORDER_PART_LENGTH = params.getParameter("borderPartLength");
                var circleLength = allBodies.length * BORDER_PART_LENGTH;
                var circleRealLength = 2 * Math.PI * radius;
                assert.isAtMost(Math.abs(circleRealLength - circleLength) / circleLength, 0.01,
                                'Difference between border length and real circle length should be less than 1%\n');
            })
        });

        it('should make an array of all border parts', function() {
            assert(game_map.border.length == allBodies.length) &&
            game_map.border.every(function(element, index) {
                return element === allBodies[index]
            })
        })
    });

    describe('#getRandomPositionInside', function() {
        var engine = Engine.create();
        var game_map = new GameMap(engine);
        it('should always return position that is inside border', function() {
            for (var i = 0; i < 10e4; ++i) {
                var pos = game_map.getRandomPositionInside();
                var posRadius = Math.sqrt((pos.x - game_map.radius) * (pos.x - game_map.radius)
                                            + (pos.y - game_map.radius) * (pos.y - game_map.radius));
                assert.isAtMost(posRadius, radius);
            }
        })
    })
});