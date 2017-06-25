/**
 * Created by fatman on 24/06/17.
 */

let ServerManager = require('../server_manager');
let express = require('express');

let admin = express();
let serverManager = new ServerManager();

admin.set('port', process.env.PORT || 3000);

admin.get('/api/ports', (req, res) => {
    res.send(`${serverManager.getServerPort()}`);
});

admin.listen(admin.get('port'), () => {
    console.log(`admin started on ${admin.get('port')}`);
});