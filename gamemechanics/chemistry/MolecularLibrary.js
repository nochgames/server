/**
 * Created by fatman on 15/04/17.
 */

const config = require("config-node");
const readline = require('readline');
const fs = require("fs");
const Util_tools = require("../../util_tools");

class MolecularLibrary {

    constructor() {
        this.allowedElements = new Set();
        this.parseLibrary();
    }

    parseLibrary() {
        const rl = readline.createInterface({
            input: fs.createReadStream(__dirname + '/' + config.game.chemistry.libraryFile)
        });

        rl.on('line', (line) => {
            this.addMolecule(line);
        });
    }

    addMolecule(line) {
        this.allowedElements.add(this.parseMoleculeStr(line));
    }

    parseMoleculeStr(moleculeStr) {
        moleculeStr = moleculeStr.replace(/\s\s+/g, ' ');
        let chars = moleculeStr.split(' ')[0].split("");
        //console.log(chars);

        let parsedStr = [];
        let prevChar;
        let prevNumber;

        chars.forEach(char => {
            let number = parseInt(char);

            if (!isNaN(number)) {
                if (!prevChar && !prevNumber)
                    Util_tools.handleError(`Wrong molecule ${moleculeStr}`);

                if (prevNumber) {
                    prevNumber = prevNumber * 10 + number;
                } else {
                    prevNumber = number;
                }
            } else {
                if (char == char.toLowerCase()) {
                    if (!prevChar)
                        Util_tools.handleError(`Wrong molecule ${moleculeStr}`);
                    prevChar += char;
                } else {
                    if (prevChar && prevNumber) {
                        for (let i = 0; i < prevNumber; ++i) {
                            parsedStr.push(prevChar);
                        }
                        prevNumber = null;
                    } else if (prevChar) {
                        parsedStr.push(prevChar);
                    }

                    prevChar = char;
                }
            }
        });

        if (prevChar) {
            prevNumber = prevNumber ? prevNumber : 1;
            for (let i = 0; i < prevNumber; ++i) {
                parsedStr.push(prevChar);
            }
        }
        parsedStr = parsedStr.sort().join(config.game.chemistry.elementDelimiter).toLowerCase();

        console.log(parsedStr);
        return parsedStr;
    }

    has(moleculeId) {
        //console.log(moleculeId);
        return this.allowedElements.has(moleculeId.toLowerCase());
    }
}

module.exports = MolecularLibrary;