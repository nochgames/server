/**
 * Created by fatman on 22/06/17.
 */

let ActiveElement = require("../ActiveElement");

class BasicBot extends ActiveElement {

    constructor(position, engine, elem, emitter,
                websocketservice, chemistry, color, name) {
        //console.log(arguments);
        super(websocketservice, position, engine, elem,
            emitter, chemistry, color);

        this.name = name + Math.random().toString(36).substr(2, 5);

        this.body.inGameType = "player";
        this.isBot = true;

        this.initBotLogic();
    }

    update() {
        super.update();
        this.processBotLogic();
    }

    checkResizeGrow() {
        // do nothing
    }

    checkResizeShrink() {
        // do nothing
    }
}

module.exports = BasicBot;