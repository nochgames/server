/**
 * Created by fatman on 01/04/16.
 */

'use strict';

let BasicBot = require("../BasicBot");
let config = require('config-node');

class Bot extends BasicBot {

    constructor(position, engine, elem, emitter,
                websocketservice, chemistry, color, name="Wanderer_") {
        //console.log(arguments);
        super(position, engine, elem, emitter,
                websocketservice, chemistry, color, name);
    }

    initBotLogic() {
        this.ticksBeforeTurnMin =
            config.game.simpleBot.sameDirSecMin *
            config.game.updatesPerSec;
        this.ticksBeforeTurnMax =
            config.game.simpleBot.sameDirSecMax *
            config.game.updatesPerSec;

        this.ticks = 0;

        this.setRandomDirectionPosition();
    }

    processBotLogic() {
        this.wander();
    }

    wander() {
        const velocity = 0.000022;
        const changeDirectionChance = 0.2;

        let dirPos = this.directionPosition;
        dirPos.x += Math.round(velocity / 2
                    - Math.random() * velocity);
        dirPos.y += Math.round(velocity / 2
                    - Math.random() * velocity);
        this.applyVelocity(dirPos.x, dirPos.y);

        ++this.ticks;

        if (this.ticks > this.ticksBeforeTurnMax ||
            this.ticks > this.ticksBeforeTurnMin &&
            Math.random() < changeDirectionChance) {
            this.setRandomDirectionPosition();
            this.ticks = 0;
        }
    }

    setRandomDirectionPosition() {
        this.directionPosition = {};
        this.directionPosition.x = Math.round(30 - Math.random() * 60);
        this.directionPosition.y = Math.round(30 - Math.random() * 60);
    }
}

module.exports = Bot;