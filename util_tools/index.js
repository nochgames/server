/**
 * Created by fatman on 09/02/16.
 */

'use strict';

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

  isEmpty: function(obj) {

     for (let key in obj) {
      if (obj.hasOwnProperty(key)) return false;
    }

    return true;
  },

  ceilPosition: function(position) {
    return { x: Math.ceil(position.x), y: Math.ceil(position.y)}
  },

  //TODO: add longDimension to player class
  standardRes: 1366,

  inScreen: function(object, tolerance) {
    if (!tolerance) tolerance = 0;
    return (object.body.position.x - object.body.circleRadius < this.body.position.x +
    this.resolution.width / this.body.coefficient / 2 *
    this.standardRes / this.resolution.width *  + tolerance &&
    object.body.position.x + object.body.circleRadius > this.body.position.x -
    this.resolution.width / this.body.coefficient / 2 *
    this.standardRes / this.resolution.width - tolerance &&
    object.body.position.y - object.body.circleRadius < this.body.position.y +
    this.resolution.height / this.body.coefficient / 2 *
    this.standardRes / this.resolution.width + tolerance &&
    object.body.position.y + object.body.circleRadius > this.body.position.y -
    this.resolution.height / this.body.coefficient / 2 *
    this.standardRes / this.resolution.width - tolerance);
  },

  deleteFromArray: function(array, element) {
    var index = array.indexOf(element);
    if (index > -1) {
      array.splice(index, 1);
    }
  }

};

module.exports = Util_tools;