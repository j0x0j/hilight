var mongoose = require('mongoose'),
    mongoURI = process.env.MONGOHQ_URL || 'mongodb://localhost/cmnt',
    db = mongoose.connect(mongoURI),
    comments = require('./comments'),
    users = require('./users'),
    pages = require('./pages'),
    invites = require('./invites')
    utils = require('../lib/utils');

module.exports = function (app, passport) {

    app.get('/get/comments/:url/:count?', utils.ensureAuthenticated, comments.get);
    app.post('/comment/add/', utils.ensureAuthenticated, comments.add);
    app.post('/comment/edit/', utils.ensureAuthenticated, comments.edit);
    app.post('/comment/delete/', utils.ensureAuthenticated, comments.delete);
    app.post('/user/add/', users.add);
    app.get('/get/user/:id/', utils.ensureAuthenticated, users.get);
    app.get('/get/users/:query?', users.query);

    app.get('/me/', utils.ensureAuthenticated, users.me);
    app.get('/me/mentions/', utils.ensureAuthenticated, users.mentions);
    app.get('/me/edit/', utils.ensureAuthenticated, users.edit);
    app.post('/user/update/', utils.ensureAuthenticated, users.update);
    app.get('/get/user/comments/:skip', utils.ensureAuthenticated, users.comments);
    app.get('/get/user/mentions/:offset', utils.ensureAuthenticated, users.getMentions);

    app.get('/login/', users.loginPage);
    app.get('/signup/', users.signup);
    app.get('/help/', users.help);
    app.get('/thread/:id/', comments.thread);

    app.post('/invite/add/', invites.add);

    // Auth

    app.post('/login/', passport.authenticate('local',
        {
            successRedirect: '/me/',
            failureRedirect: '/login/'
        })
    );

    app.get('/logout/', function (req, res){
        req.logout();
        res.redirect('/login/');
    });

    app.post('/ajax-login/', function (req, res, next) {
        passport.authenticate('local', function(err, user, info) {
            if (err) { return next(err); }
            if (!user) { return res.json({loggedin: false}); }
            req.login(user, function(err) {
                if (err) { return next(err); }
                return res.json(user);
            });
        })(req, res, next);
    });

    app.get('/ajax-logout/', function (req, res) {
        req.logout();
        res.json({logged: false});
    });

    app.get('/auth/twitter',
        passport.authenticate('twitter'),
        function (req, res) {
            return null;
        });

    app.get('/auth/twitter/callback',
        passport.authenticate('twitter', { failureRedirect: '/login/' }),
        function (req, res) {
            if (!req.session.passport.user.email)
                res.redirect('/me/edit/');
            else
                res.redirect('/me/');
        });

    // Public user profiles

    app.get('/', pages.home);
    app.get('/:user', users.get);

};