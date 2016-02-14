/**
 * Created by fatman on 09/02/16.
 */
var api = require("./apiCode");

API_NOCH = {
    getCode: function(name) {
        if (!api[name]) {
            throw new Error(name + " is not in API");
        }
        return api[name];
    }
};

module.exports = API_NOCH;