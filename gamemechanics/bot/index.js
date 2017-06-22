/**
 * Created by fatman on 01/04/16.
 */

'use strict';

let ActiveElement = require("../ActiveElement");
let config = require('config-node');

class Bot extends ActiveElement {

    constructor(position, engine, elem, emitter,
                websocketservice, chemistry, color) {
        console.log(arguments);
        super(websocketservice, position, engine, elem,
                emitter, chemistry, color);

        this.name = Math.random().toString(36).substr(2, 5);

        this.body.inGameType = "player";
        this.isBot = true;

        this.initBotLogic();
    }

    update() {
        super.update();
        this.processBotLogic();
    }

    processBotLogic() {
        this.wonder();
    }

    wonder() {
        const velocity = 6;
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

    setNumber(number) {
        this.body.number = this.body.playerNumber = number;
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

    setRandomDirectionPosition() {
        this.directionPosition = {};
        this.directionPosition.x = Math.round(30 - Math.random() * 60);
        this.directionPosition.y = Math.round(30 - Math.random() * 60);
    }

    checkResizeGrow() {
        // do nothing
    }

    checkResizeShrink() {
        // do nothing
    }
}

module.exports = Bot;