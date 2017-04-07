/**
 * Created by fatman on 01/04/16.
 */

let ActiveElement = require("../ActiveElement");

class Bot extends ActiveElement {
    constructor(ws, name, position, engine, elem,
                emitter, websocketservice, chemistry) {
        super(websocketservice, position, engine, elem,
            emitter,  chemistry);

        this.body.inGameType = "player";
    }

}