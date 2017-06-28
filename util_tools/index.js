/**
 * Created by fatman on 09/02/16.
 */

'use strict';

var config = require('config-node');

var Util_tools = {

    parseCoordinates: function(array) {
        var parsedArray = [];
       for (let i = 0; i < array.length; ++i) {
           for (let key in array[i]) {
                parsedArray.push(array[i][key]);
            }
        }
        return parsedArray;
    },

    addToArray: function(array, obj) {
        var i = 0;
        while(array[i]) ++i;
        array[i] = obj;
        return i;
    },

    isEmpty: function(obj) {

       for (let key in obj) {
            if (obj.hasOwnProperty(key)) return false;
        }

        return true;
    },

    ceilPosition: function(position) {
        return { x: Math.ceil(position.x), y: Math.ceil(position.y)}
    },

    inScreen: function(object, tolerance) {
        if (!tolerance) tolerance = 0;
        return (object.body.position.x - object.body.circleRadius < this.body.position.x +
        this.resolution.width / this.body.coefficient / 2 *
        1366 / this.resolution.width *  + tolerance &&
        object.body.position.x + object.body.circleRadius > this.body.position.x -
        this.resolution.width / this.body.coefficient / 2 *
        1366 / this.resolution.width - tolerance &&
        object.body.position.y - object.body.circleRadius < this.body.position.y +
        this.resolution.height / this.body.coefficient / 2 *
        1366 / this.resolution.width + tolerance &&
        object.body.position.y + object.body.circleRadius > this.body.position.y -
        this.resolution.height / this.body.coefficient / 2 *
        1366 / this.resolution.width - tolerance);
    },

    deleteFromArray: function(array, element) {
        var index = array.indexOf(element);
        if (index > -1) {
            array.splice(index, 1);
            return true;
        }
        return false;
    },

    reduceAngle: function (angle) {
        while (angle < 0) angle += Math.PI * 2;

        return angle % (2 * Math.PI);
    },

    isCollidingRectCircle(rect, circle) {
        let critDistX = rect.x + circle.radius;
        let critDistY = rect.y + circle.radius;

        let distX = Math.abs(rect.x - circle.x);
        let distY = Math.abs(rect.y - circle.y);

        if (distX > critDistX || distY > critDistY) return false;
        if (distY < rect.height || distX < rect.width) return true;

        let distCircleX = distX - rect.width;
        let distCircleY = distY - rect.height;

        return Math.pow(distCircleX, 2) + Math.pow(distCircleY, 2)
                < Math.pow(circle.radius, 2);
    },

    handleError: function (message, doThrow = true) {
        if (!config.noThrow && doThrow) {
            throw new Error(message);
        } else  {
            console.log(message);
        }
    }
};

module.exports = Util_tools;