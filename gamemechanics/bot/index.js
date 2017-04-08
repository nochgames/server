/**
 * Created by fatman on 01/04/16.
 */

'use strict';

let ActiveElement = require("../ActiveElement");
let config = require('config-node');

class Bot extends ActiveElement {

    constructor(position, engine, elem, emitter,
                websocketservice, chemistry, color) {
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
        this.move();
    }

    move() {
        let dirPos = this.directionPosition;
        dirPos.x += Math.round(3 - Math.random() * 6);
        dirPos.y += Math.round(3 - Math.random() * 6);
        this.applyVelocity(dirPos.x, dirPos.y);

        ++this.ticks;

        if (this.ticks > this.ticksBeforeTurnMax ||
            this.ticks > this.ticksBeforeTurnMin &&
            Math.random() < 0.2) {
            this.setDirectionPosition();
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

        this.setDirectionPosition();
    }

    setDirectionPosition() {
        this.directionPosition = {};
        this.directionPosition.x = Math.round(30 - Math.random() * 60);
        this.directionPosition.y = Math.round(30 - Math.random() * 60);
    }

    checkResizeGrow() {

    }

    checkResizeShrink() {

    }
}

module.exports = Bot;