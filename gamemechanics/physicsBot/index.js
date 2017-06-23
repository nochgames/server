/**
 * Created by fatman on 22/06/17.
 */

'use strict';

let BasicBot = require("../BasicBot");
let config = require('config-node');

class PhysicsBot extends BasicBot {

    constructor(position, engine, elem, emitter,
                websocketservice, chemistry, color, context) {

        super(position, engine, elem, emitter,
            websocketservice, chemistry, color, "Physics_");

        this.context = context;
    }

    initBotLogic() {

    }

    processBotLogic() {

    }

    calculateForceFromEnvironment() {

    }
}