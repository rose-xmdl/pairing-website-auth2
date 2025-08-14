const express = require('express');
const app = express();
__path = process.cwd();
const bodyParser = require("body-parser");
const PORT = process.env.PORT || 4000;

let code = require('./pair');
require('events').EventEmitter.defaultMaxListeners = 500;

// Pairing API
app.use('/code', code);

// Serve pair.html for /
app.use('/', (req, res) => {
    res.sendFile(__path + '/pair.html');
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
