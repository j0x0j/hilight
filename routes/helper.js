var sgcreds = require('../config').SENDGRID,
    baseUrl = require('../config').CONSTANTS.BASEURL(),
    SG = require('sendgrid').SendGrid,
    sendgrid = new SG(sgcreds.USER, sgcreds.PASS),
    moment = require('moment'),
    redis = require('../config').newRedisClient(),
    bitly = require('../config').bitly,
    i18n = require('i18n');

var slugify = function (s) {
    var slug,
        _slugify_strip_re = /[^\w\s-]/g,
        _slugify_hyphenate_re = /[-\s]+/g;

    s = s.replace(_slugify_strip_re, '').trim().toLowerCase();
    s = s.replace(_slugify_hyphenate_re, '-');
    slug = s;
    return slug;
};

module.exports = {

    validate: function (data) {
        if(data.location === '' ||
            data.username === '' ||
            data.email === '' ||
            data.text === '' ||
            data.lang === '' ||
            data.comment === '') {
            return 'error';
        } else {
            return false;
        }
    },

    checkForDuplicateUser: function (passport, body, cb) {
        var authedUser = passport.user;

        if(authedUser)
            if(authedUser.username === body.username) return cb(false);

        redis.exists('user:' + body.username, function (err, reply) {
            if(reply === 1) {
                cb('error');
            } else {
                cb(false);
            }
        });
    },

    sendEmail: function (message, recipient, cb) {
        var sender = message.username,
            lang = message.lang;
        
        i18n.setLocale(lang);

        if (typeof recipient.email === 'undefined') {
            var toEmail = recipient,
                tmpUrl,
                inviteUrl;
            recipient = {
                email: toEmail,
                username: toEmail.split('@')[0]
            }
            tmpUrl = message.url;
            message.url = baseUrl + '/thread/' + message._id + '/';
        }

        sendgrid.send({
            to: recipient.email,
            from: 'notifications@cmnt.io',
            fromname: 'Cmnt.io',
            subject: i18n.__('Notification') + ' - ' + i18n.__('You were mentioned'),
            html: '<p>' + i18n.__('%s mentioned you:', sender) + '</p> \
                   <p style="font-style:italic;font-size:16px">' + message.comment + '</p> \
                   <p>' + i18n.__('you can reply here:') +
                   ' <a href="' + message.url + '#{cmnt_' + (message.hash || '') + '}">' + message.url + '</a></p>',
            text: i18n.__('%s mentioned you:', sender) + 
                  ' ' + message.comment + '-- ' + 
                  i18n.__('you can reply here:') + ' ' + message.url,
        }, function (success, message) {
            if(!success) redis.lpush('errors:notification:email', JSON.stringify({ error: 'sendgrid error', email: recipient.email, message: message }));
            var timestamp = moment().unix();
            redis.sadd('notification:sent', sender + ':' + recipient.username + ':to-' + recipient.email +  ':' + timestamp + ':email');
            if(cb) cb(timestamp);
            return;
        });
    },

    urlPattern: /(http|ftp|https):\/\/[\w-]+(\.[\w-]+)+([\w.,@?^=%&amp;:\/~+#-]*[\w@?^=%&amp;\/~+#-])?/,

    shortenUrl: function (url, cb) {
        bitly.shorten(url, function (err, response) {
            if (err) throw err;
            var short_url = response.data.url
            cb(short_url);
        });
    },

    slugify: slugify,

    sendNotification: function (recipient, comment, cb) {
        var notification, channel = 'notifications:' + recipient.username;
        notification = { 
            event: 'notification'
            , title: i18n.__('%s mentioned you:', comment.username)
            , body: i18n.__('you can reply here:') + ' ' +  comment.url
            , comment: comment.comment
            , user: comment.username
            , avatar: comment.avatar
            , timestamp: comment.timestamp
            , url: comment.url
            , hash: comment.hash
        };
        return cb(channel, JSON.stringify(notification));
    }

};
