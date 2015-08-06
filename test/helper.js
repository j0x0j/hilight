var mongoose  = require('mongoose'),
    factories = require('./factories'),
    Factory = require('factory-lady'),
    User = require('../models/User'),
    Comment = require('../models/Comment'),
    redis = require('../config').redis,
    http = require('request'),
    url = 'http://localhost:5000'

var slugify = function (s) {
    var slug,
        _slugify_strip_re = /[^\w\s-]/g,
        _slugify_hyphenate_re = /[-\s]+/g;

    s = s.replace(_slugify_strip_re, '').trim().toLowerCase();
    s = s.replace(_slugify_hyphenate_re, '-');
    slug = s;
    return slug;
};

var setUserKeys = function (err, res, body, user, done) {
    redis.set('user:' + body.username, body.email);
    redis.set('user:' + slugify(body.username) + ':comment-count', 1);
    redis.set('user:' + slugify(body.username) + ':mentions', 1);
    redis.lpush('user:' + slugify(body.username) + ':mentioned', 'SoMeMoNgOiD');
    done(err, res, body);
};

module.exports = {
    
    slugify: slugify,

    setUserKeys: setUserKeys,

    cleanDB: function(done) {
        User.collection.drop(function(err) {
            Comment.collection.drop(function(err){
                redis.flushall();
                done(err);
            });
        });
    },

    signup: function(params, done) {
        http({
            method: 'POST',
            url: url + '/user/add/',
            json: true,
            body: {
                firstName: params.user.firstName,
                lastName: params.user.lastName,
                username: params.user.username,
                email: params.user.email,
                password: params.user.password,
                lang: params.user.lang
            }
        },
        function (err, res, body) {
            done(err, res, body);
        });
    },

    signedInUser: function (done) {
        Factory.create('user', function (user) {
            http({
                method: 'POST',
                url: url + '/ajax-login/',
                json: true,
                body: {
                    email: user.email,
                    password: user.password
                }
            },
            function (err, res, body) {
                setUserKeys(err, res, body, user, done);
            });
        });
    },

    updateUser: function (user, done) {
        http({
            method: 'POST',
            url: url + '/user/update/',
            json: true,
            body: {
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                username: user.username,
                email: user.email
            }
        },
        function (err, res, body, user) {
            done(err, res, body);
        });
    },
 
    comment: function(params, done) {
        http({
            method: 'POST',
            url: url + '/comment/add/',
            json: true,
            body: params.data
        },
        function (err, res, body) {
            done(err, res, body);
        });
    },

    getComments: function (params, done) {
        http({
            method: 'GET',
            url: url + '/get/comments/' + encodeURIComponent(params.url) + '/',
            json: true,
            body: {}
        },
        function (err, res, body) {
            done(err, res, body);
        });
    },

    editComment: function(params, done) {
        http({
            method: 'POST',
            url: url + '/comment/edit/',
            json: true,
            body: params.data
        },
        function (err, res, body) {
            done(err, res, body);
        });
    },

    verifyPageCache: function (url, done) {
        redis.multi()
            .get('page:' + url + ':cache')
            .get('page:' + url + ':comment-count')
            .exec(function (err, replies) {
                done({
                    cache: JSON.parse(replies[0]),
                    count: replies[1]
                });
            });
    },

    newComment: function (user, done) {
        this.comment({
            data: {
                location: 'http://www.google.com',
                username: user.username,
                email: user.email,
                comment: 'Some comment for testing @' + user.username,
                text: 'This is the sample text',
                lang: 'en',
                invites: []
            }
        }, done);
    },

    deleteComment: function (params, done) {
        redis.multi()
                .set('user:' + slugify(params.data.username) + ':comment-count', 1)
                .set('page:' + params.data.url + ':comment-count', 1)
                .set('user:' + slugify(params.data.username) + ':mentions', 1)
            .exec(function (e, replies) {
                http({
                    method: 'POST',
                    url: url + '/comment/delete/',
                    json: true,
                    body: params.data
                },
                function (err, res, body) {
                    done(err, res, body);
                });
        });
    },

    verifyCommentKeys: function (comment, done) {
        var errs = [];
        redis.multi()
            .get('user:' + slugify(comment.username) + ':comment-count')
            .get('page:' + comment.url + ':comment-count')
            .get('user:' + slugify(comment.username) + ':mentions')
            .exec(function (err, replies) {
                if (err) done(err);
                replies.forEach(function (v, k) {
                    if (parseInt(v, 10) !== 0) errs.push(1);
                });
                done(errs);                
        });
    }

}