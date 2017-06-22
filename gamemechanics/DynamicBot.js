/**
 * Created by fatman on 20/04/17.
 */

var Wanderer = require('./bot');

let Bots = {
    Wanderer
};

class DynamicBot {
    constructor (className) {
        //[].shift.call(arguments);
        console.log(arguments);
        return new (
            Function.prototype.bind.apply(Bots[className],
                arguments));
    }
}

module.exports = DynamicBot;