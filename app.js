if (process.env.NODE_ENV === 'production') {
    require('nodetime').profile({
        accountKey: process.env.NODETIME_APPLICATION_KEY,
        appName: 'hilight.io'
    });
} else {
    //require('look').start();
};

var express = require('express')
    , http = require('http')
    , passport = require('passport')
    , Primus = require('primus');

var app = module.exports = express()
    , port
    , server = http.createServer(app)
    , primus = new Primus(server, { transformer: 'websockets' });

// IO
require('./lib/messager')(primus);

// Config
require('./config/app')(express, app, passport);

// Auth
require('./config/passport')(passport);

// Routes
require('./routes')(app, passport);

// Init
server.listen(port = process.env.PORT || 5000);
console.log("Now listening on port #"+port+"...");