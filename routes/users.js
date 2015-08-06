var User = require('../models/User'),
    Comment = require('../models/Comment'),
    helper = require('./helper'),
    redis = require('../config').redis,
    i18n = require('i18n');

var checkForDuplicate = function (email, cb) {
    User.findOne({email: email}, function (err, doc) {
        if(err) return cb(false);
        if(doc) return cb(doc);
        cb(false);
    });
};

//POST /user/add/
exports.add = function (req, res) {
    var data, user, duplicate;

    data = req.body;

    if(data.username === '' ||
        data.email === '' ||
        data.firstName === '' ||
        data.password === '') {
        return res.json({ err: 'Missing Properties' });
    }

    checkForDuplicate(data.email, function (duplicate) {
        if(!duplicate) {
            user = new User();
            user.firstName = data.firstName;
            user.lastName = data.lastName;
            user.username = data.username;
            user.email = data.email;
            user.lang = data.lang || i18n.getLocale();
            user.password = data.password;

            user.save(function (err, doc) {
                if(err) res.json({err: 'duplicate'});
                req.login({
                    _id: user._id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    thumb: user.thumb,
                    username: user.username
                }, function (err) {
                    if (err) return next(err);
                    var slug = helper.slugify(user.username);
                    redis.set('user:' + user.username, user.email);
                    redis.set('user:' + slug + ':comment-count', 0);
                    redis.set('user:' + slug + ':mentions', 0);
                    return res.json('201', doc);
                });
            });
        } else {
            res.json(duplicate);
        }
    });

};

//POST /user/update/
exports.update = function (req, res) {
    var data = req.body;
    User.findOne({_id: req.session.passport.user._id}, function (err, user) {
        var prevUsername = user.username,
            prevEmail = user.email;
        user.username = data.username;
        user.email = data.email;
        user.firstName = data.firstName;
        user.lastName = data.lastName;
        user.lang = data.lang;
        user.save(function (err, doc) {
            if(err) return res.json('400', { error: err.name, path: err.errors } );
            req.session.passport.user = doc;
            if(prevEmail !== doc.email) {
                redis.set('user:' + doc.username, doc.email);
            }
            if(prevUsername !== doc.username) {
                var slug = helper.slugify(prevUsername),
                    newslug = helper.slugify(doc.username);
                redis.del('user:' + prevUsername);
                redis.set('user:' + doc.username, doc.email);
                redis.multi()
                    .get('user:' + slug + ':comment-count')
                    .get('user:' + slug + ':mentions')
                    .lrange('user:' + slug + ':mentioned', 0, -1)
                    .exec(function (err, replies) {
                        redis.set('user:' + newslug + ':comment-count', replies[0]);
                        redis.set('user:' + newslug + ':mentions', replies[1]);
                        replies[2].forEach(function (v, k) {
                            redis.lpush('user:' + newslug + ':mentioned', v);
                        });
                        redis.del('user:' + slug + ':comment-count');
                        redis.del('user:' + slug + ':mentions');
                        redis.del('user:' + slug + ':mentioned');
                        res.json(doc);
                    });
            } else {
                res.json(doc);
            }
        });
    });
};

//GET /:user/
exports.get = function (req, res) {
    User.findOne({ username: req.params.user }, function (err, doc) {
        if (!doc) return res.redirect('/me/');
        var user = {
            thumb: doc.thumb,
            lang: doc.lang,
            username: doc.username
        }
        res.json(user);
    });
};

//GET /me/
exports.me = function (req, res) {
    var user = req.session.passport.user, lastest;
    if (!user.email) return res.redirect('/me/edit/');
    Comment.find({email:user.email})
        .limit(5)
        .sort({timestamp: 'desc'})
        .exec(function (err, docs) {
            var slug = helper.slugify(user.username);
            redis.multi()
                .get('user:' + slug + ':comment-count')
                .get('user:' + slug + ':mentions')
                .exec(function (err, replies) {
                    var commentCount = replies[0] || 0;
                    var mentionCount = replies[1] || 0;
                    latest = docs;
                    res.render('profile', { title: 'Profile', user: user, latest: latest, count: commentCount, mentions: mentionCount });
                });
    });
};

//GET /get/user/comments/:skip
exports.comments = function (req, res) {
    var user = req.session.passport.user,
        skip = req.params.skip || 0;

    Comment.find({email:user.email})
        .skip(skip)
        .limit(5)
        .sort({timestamp: 'desc'})
        .lean()
        .exec(function (err, docs) {
            res.json(docs);
        });
};

//GET /get/user/mentions/:offset
exports.getMentions = function (req, res) {
    var user = req.session.passport.user,
        slug = helper.slugify(user.username),
        offset = parseInt(req.params.offset, 10) || 0,
        limit = 4 + offset;

    redis.lrange('user:' + slug + ':mentioned', offset, limit, function (err, replies) {
        if(replies.length > 0) {
            Comment.find({_id: { $in: replies } })
                .sort({timestamp: 'desc'})
                .lean()
                .exec(function (err, docs) {
                    res.json(docs);
                });
        } else {
            res.json([]);
        }
    });
};

//GET /me/mentions/
exports.mentions = function (req, res) {
    var user = req.session.passport.user,
        slug = helper.slugify(user.username);

    redis.lrange('user:' + slug + ':mentioned', 0, 4, function (err, replies) {
        if(replies) {
            Comment.find({_id: { $in: replies } })
                .sort({timestamp: 'desc'})
                .exec(function (err, docs) {
                    redis.llen('user:' + slug + ':mentioned', function (err, count) {
                        res.render('mentions', { title: 'Mentions', user: user, mentions: docs, total: count });
                    });
                });
        } else {
            res.render('mentions', { title: 'Mentions', user: user, mentions: [], total: 0 });
        }
    });
};

//GET /me/edit/
exports.edit = function (req, res) {
    var user = req.session.passport.user;
    res.render('editProfile', { title: 'Edit Profile', user: user });
};

//GET /signup/
exports.signup = function (req, res) {
    res.render('signup', { title: 'Signup' });
};

//GET /login/
exports.loginPage = function (req, res) {
    res.render('login', { title: 'Login' });
};

//GET /help/
exports.help = function (req, res) {
    var user = req.session.passport.user || null;
    res.render('help', { title: 'Help', user: user });
};

//GET /get/users/:query
exports.query = function (req, res) {
    var query = req.params.query;
    redis.keys('user:' + query + '*', function (err, reply) {
        if(reply.length > 0) {
            var users = [];
            reply.forEach(function (v, k) {
                if(v.split(':').length < 3)
                    if(k < 10) users.push(v.replace(/user:/, ''));
            });
            res.json({ users: users });
        } else {
            res.json({ users: [''] });
        }
    });
};
