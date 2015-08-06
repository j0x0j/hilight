var helper = require('./helper'),
    util = require('util'),
    redis = require('../config').redis;

function validate (obj, cb) {
    var err = [];
    if(!util.isArray(obj.recipients)) {
        err.push('not array');
    }
    if(!obj.sender.email 
        || !obj.sender.name
        || !obj.location) {
        err.push('undefined fields');
    }
    if(obj.sender.email === ''
        || obj.sender.name === ''
        || obj.location === '') {
        err.push('empty fields');
    }
    return cb(err);
};

// POST /invite/add/
exports.add = function (req, res) {
    var sender = req.body.sender,
        recipients = req.body.recipients,
        location = req.body.location,
        lang = req.body.lang || 'en';
    validate(req.body, function (err) {
        if (err.length > 0) { return res.json({ errors: err }); }
        recipients.forEach(function (email, k) {
            redis.lpush('invites:email', email);
        });
        res.json(201, { message: 'invites queued' });
    });
};