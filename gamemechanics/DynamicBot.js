/**
 * Created by fatman on 20/04/17.
 */

let Wanderer = require('./bot');
let PhysicsBot = require('./physicsBot');

let Bots = {
    Wanderer,
    PhysicsBot
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