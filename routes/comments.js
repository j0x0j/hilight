var crypto = require('crypto'),
    Comment = require('../models/Comment'),
    helper = require('./helper'),
    publisher = require('../config').newRedisClient(),
    redis = require('../config').newRedisClient(),
    sessStore = require('../config').redisSessionStore(),
    mentions;

// GET /get/comments/:url/:count?
exports.get = function (req, res) {
    var currCount = req.params.count,
        cacheKey = 'page:' + req.params.url + ':cache',
        user = {};

    if (req.session.passport.user) {
        user = {
            _id: req.session.passport.user._id,
            username: req.session.passport.user.username,
            firstName: req.session.passport.user.firstName,
            lastName: req.session.passport.user.lastName,
            thumb: req.session.passport.user.thumb,
        };
    }

    redis.get('page:' + req.params.url + ':comment-count', function (err, count) {
        if (err) { throw err; }
        if (!count) { count = 0; }
        if (currCount < count || !currCount) {
            res.sid = req.sessionID;
            getFreshComments(req.params.url, count, user, res);
        } else {
            redis.get(cacheKey, function (err, reply) {
                if (err) { throw err; }
                var comments = JSON.parse(reply);
                res.json({ 
                    user: user, 
                    comments: comments || [], 
                    comment_count: count, 
                    sid: (res.sid ? crypto.createHash('sha1').update(res.sid).digest('hex') : false)
                });
            });
        }
    });
};

// POST /comment/add/
exports.add = function (req, res) {
    var comment, 
        email, 
        gravatarurl, 
        hash, 
        text, 
        thecomment, 
        url, 
        lang,
        username,
        invites,
        mentions = exports.mentions;

    if(helper.validate(req.body)) {
        return res.json({ err: 'Missing properties' });
    }

    helper.checkForDuplicateUser(req.session.passport, req.body, function (error) {
        if(error) {
            return res.json({ err: 'Duplicate user' });
        }
        set();
    });

    function set () {
        url = req.body.location;
        username = req.body.username;
        email = req.body.email;
        text = req.body.text;
        lang = req.body.lang;
        hash = crypto.createHash('md5').update(email).digest("hex");
        gravatarurl = 'http://www.gravatar.com/avatar/' + hash;
        thecomment = req.body.comment;
        invites = req.body.invites || [],
        user = req.session.passport.user;

        comment = new Comment();
        comment.url = url;
        comment.comment = thecomment;
        comment.avatar = user.thumb || gravatarurl;
        comment.username = username;
        comment.email = email;
        comment.text = text;
        comment.hash = crypto.createHash('sha1').update(text).digest('hex');
        comment.lang = lang;
        comment.timestamp = new Date().getTime();
        comment.invites = invites;

        var matchUrl = thecomment.match(helper.urlPattern) || [];
        if(matchUrl.length > 0) {
            helper.shortenUrl(matchUrl[0], function (short_url) {
                comment.comment = thecomment.replace(matchUrl[0], '<a href="'+short_url+'" target="_blank">'+short_url+'</a>');
                save();
            });
        } else {
            save();
        }
    }

    function save () {
        comment.save(function (err) {
            invites.forEach(function (invite, k) {
                helper.sendEmail(comment, invite);
            });
            mentions(comment, function () {
                redis.multi()
                    .incr('user:' + helper.slugify(username) + ':comment-count')
                    .incr('page:' + req.body.location + ':comment-count')
                    .exec(function (err, reply) {
                        emitComment(comment, parseInt(reply[1], 10), req.sessionID);
                        return res.json('201', comment);
                    });
            });
        });
    }

};

// POST /comment/edit/
exports.edit = function (req, res) {
    var _id = req.body._id,
        comment = req.body.comment,
        user = req.session.passport.user;
    Comment
        .findOne({ _id: _id, email: user.email }, function (err, doc) {
            if(doc) {
                // @TODO check for non shortened urls and shorten
                // @TODO check for mentions (not sent) and send notification
                doc.comment = comment;
                doc.save(function (err) {
                    if (err) { throw err; }
                    return res.json(doc);
                });
            } else {
                return res.json({ err: 'no comment found' });
            }
        });
};

// POST /comment/delete/
exports.delete = function (req, res) {
    var _id = req.body._id,
        user = req.session.passport.user,
        comment;
    Comment
        .findOne({ _id: _id, email: user.email }, function (err, doc) {
            if(doc) {
                comment = doc;
                doc.remove(function (err) {
                    redis.multi()
                        .decr('user:' + helper.slugify(user.username) + ':comment-count')
                        .decr('page:' + comment.url + ':comment-count')
                        .exec(function (err, reply) {
                            var matches = comment.comment.match(/(^|\W)@\w+/g);
                            if (matches.length > 0) {
                                for (var i=0; i<matches.length; i++) {
                                    matches[i] = matches[i].replace(/@/, "");
                                }
                                matches.forEach(function (v, k) {
                                    redis.decr('user:' + helper.slugify(v.trim()) + ':mentions');
                                });
                            }
                            return res.json({ message: 'success' });
                        });
                });
            } else {
                return res.json({ err: 'no comment found' });
            }
        });
};

// GET /thread/:id/
exports.thread = function (req, res) {
    var user,
        id = req.params.id;
    if (req.session.passport.user) {
        user = req.session.passport.user;
    }
    Comment
        .findOne({ _id: id }, function (err, comment) {
            Comment
                .find({ text: comment.text })
                .sort({ timestamp: -1 })
                .limit(20)
                .exec(function (err, comments) {
                    res.render('thread', { title: 'Thread', originator: comment, user: user, comments: comments });
                });
        });
};

// Mentions
exports.mentions = function (comment, cb) {
    var message = comment.comment,
        matches = message.match(/(^|\W)@\w+/g) || [''];

    if(matches.length < 1) { return cb(); }

    for (var i=0; i<matches.length; i++) {
        matches[i] = matches[i].replace(/@/, "");
    }

    matches.forEach(function (v, k) {
        var key = 'user:' + v.trim();
        redis.get(key, function (err, reply) {
            if(reply) {
                var recipient = {
                    username: v.trim(),
                    email: reply
                }
                helper.sendNotification(recipient, comment, function (channel, notification) { 
                    console.log('publishing notification', channel);
                    if (publisher != null) {
                        publisher.publish(channel, notification);
                    } 
                    helper.sendEmail(comment, recipient);
                });
            }
        });
        redis.lpush('user:' + helper.slugify(v.trim()) + ':mentioned', comment._id);
        redis.incr('user:' + helper.slugify(v.trim()) + ':mentions');
    });
    return cb(matches);
};

var emitComment = function (comment, count, sid) {
    getFreshComments(comment.url, count, null, { sid: sid }, function (data) {
        if (publisher != null) {
            console.log('payload', comment.url, comment.comment);
            publisher.publish(
                crypto.createHash('sha1').update(comment.url).digest('hex'), 
                JSON.stringify({ event: 'refresh', data: data, originator: comment }));
        } else {
            console.log('publisher not set');
        }
    });
}

var getFreshComments = function (url, count, user, res, cb) {
    var data, 
        cacheKey = 'page:' + url + ':cache';
    if (!user) {
        // need to get from session store
        sessStore.get('sess:' + res.sid, function (err, reply) {
            user = {};
            if (reply) { 
                try {
                    user = JSON.parse(reply).passport.user;
                } catch (err) {
                    console.log(err);
                }
            }
            save();
        });
    } else {
        save();
    }
    function save () {
        Comment
            .find({ url: url })
            .select('timestamp lang text username avatar comment url hash')
            .sort({ text: 'asc' })
            .limit(500)
            .lean()
            .exec(function (err, comments) {
                if (err) { throw err; }
                if (comments.length > 0) {
                    redis.multi()
                        .set(cacheKey, JSON.stringify(comments))
                        .set('page:' + url + ':comment-count', comments.length).
                        exec(function (err, reply) { return; });
                }
                data = { 
                    user: user, 
                    comments: comments, 
                    comment_count: count, 
                    sid: (res.sid ? crypto.createHash('sha1').update(res.sid).digest('hex') : false) 
                };
                if (cb) { cb(data); } else { res.json(data); };
            });
    }
}
