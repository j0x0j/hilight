var User = require('../models/User')
    , LocalStrategy = require('passport-local').Strategy
    , TwitterStrategy = require('passport-twitter').Strategy;

module.exports = function (passport) {

    passport.use(new LocalStrategy({
            usernameField: 'email'
        },
        function (email, password, done) {
            User.authenticate(email, password, function(err, user) {
                return done(err, user);
            });
        }
    ));

    passport.use(new TwitterStrategy({
            consumerKey: require('../config').TWITTER_CONSUMER_KEY,
            consumerSecret: require('../config').TWITTER_CONSUMER_SECRET,
            callbackURL: require('../config').TWITTER_AUTH_CALLBACK
        },
        function (token, tokenSecret, profile, done) {
            User.findOne({uid: profile.id}, function (err, user) {
                if (user) {
                    return done(null, {
                        _id: user._id,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        thumb: user.thumb,
                        username: user.username,
                        email: user.email
                    });
                }
                var user = new User();
                user.uid = profile.id;
                user.firstName = profile.displayName.split(' ')[0];
                user.lastName = profile.displayName.split(' ')[1];
                user.username = profile.username;
                user.thumb = profile.photos[0].value.replace('normal', 'bigger') || '';
                user.token = token;
                user.password = token;
                user.save(function (err, user) {
                    console.log('--- saved the user', err, user);
                    return done(null, {
                        _id: user._id,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        thumb: user.thumb,
                        username: user.username
                    });
                });
            });
        }
    ));

    passport.serializeUser(function (user, done) {
        done(null, user);
    });

    passport.deserializeUser(function (user, done) {
        done(null, user);
    });

};