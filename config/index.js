var R = require('redis');

if (process.env.REDISTOGO_URL) {
    // redistogo
    var redistogo = require("url").parse(process.env.REDISTOGO_URL),
        redis = R.createClient(redistogo.port, redistogo.hostname),
        auth = redistogo.auth.split(":")[1];
    redis.auth(auth);
} else {
    var redis = R.createClient();
}

exports.SENDGRID = {
    USER: '',
    PASS: ''
};

var Bitly = require('bitly');
var bitly = new Bitly('', '');

exports.CONSTANTS = {
    BASEURL: function () {
        if (process.env.NODE_ENV === 'production') {
            return 'https://cmnt.io';
        } else {
            return 'http://localhost:5000';
        }
    }
};

exports.newRedisClient = function () {
    if (process.env.REDISTOGO_URL) {
        var r = R.createClient(redistogo.port, redistogo.hostname);
        r.auth(auth);
        return r;
    } else {
        return R.createClient();
    }
};

exports.redisSessionStore = function () {
    if (process.env.REDISTOGO_SESSION_STORE) {
        // redistogo
        var sessionstore = require("url").parse(process.env.REDISTOGO_SESSION_STORE),
            sessredis = R.createClient(sessionstore.port, sessionstore.hostname),
            sessauth = sessionstore.auth.split(":")[1];
        sessredis.auth(sessauth);
        return sessredis;
    } else {
        return redis;
    }
};

exports.TWITTER_CONSUMER_KEY = process.env.TWITTER_CONSUMER_KEY || '';
exports.TWITTER_CONSUMER_SECRET = process.env.TWITTER_CONSUMER_SECRET || '';
exports.TWITTER_AUTH_CALLBACK = process.env.TWITTER_AUTH_CALLBACK || 'http://localhost:5000/auth/twitter/callback';

module.exports.bitly = bitly;
module.exports.redis = redis;
