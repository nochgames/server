/**
 * Created by fatman on 09/02/16.
 */

Util_tools = {
    parseCoordinates: function(array) {
        var parsedArray = [];
        for (var i = 0; i < array.length; ++i) {
            for (var key in array[i]) {
                parsedArray.push(array[i][key]);
            }
        }
        return parsedArray;
    },

    isEmpty: function(obj) {

        for (var key in obj) {
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
        this.resolution.width / this.body.coefficient / 2 + tolerance &&
        object.body.position.x + object.body.circleRadius > this.body.position.x -
        this.resolution.width / this.body.coefficient / 2 - tolerance &&
        object.body.position.y - object.body.circleRadius < this.body.position.y +
        this.resolution.height / this.body.coefficient / 2 + tolerance &&
        object.body.position.y + object.body.circleRadius > this.body.position.y -
        this.resolution.height / this.body.coefficient / 2 - tolerance);
    },

    deleteFromArray: function(array, element) {
        var index = array.indexOf(element);
        if (index > -1) {
            array.splice(index, 1);
        }
    }

};

module.exports = Util_tools;