var i18n = require('i18n')
    , assets = require('connect-assets')
    , utils = require('../lib/utils');

i18n.configure({
    locales:['cs', 'de', 'el', 'en', 'es', 'fr', 'ja', 'pt', 'ru', 'tr'],
    cookie: 'cmnt-locale',
    defaultLocale: 'en',
    directory: __dirname + '/../locales',
    extension: '.js',
});

module.exports = function (express, app, passport) {

    app.configure(function(){
        app.enable('trust proxy');
        app.use(express.cookieParser(process.env.REDIS_STORE_SECRET || 'somestring'));

        var RedisStore = require('connect-redis')(express);

        if (process.env.REDISTOGO_SESSION_STORE) {
            var redistogo = require('url').parse(process.env.REDISTOGO_SESSION_STORE),
                auth = redistogo.auth.split(':')[1];
            app.use(express.session({
                store: new RedisStore({
                    host: redistogo.hostname,
                    port: redistogo.port,
                    pass: auth
                }),
                secret: (process.env.REDIS_STORE_SECRET || 'somestring')
            }));
        } else {
            app.use(express.session({
                store: new RedisStore(),
                secret: (process.env.REDIS_STORE_SECRET || 'somestring')
            }));
        }

        if (process.env.DO_LOG) {
            app.use(express.logger());
        }

        app.use(passport.initialize());
        app.use(passport.session());
        app.set('views', __dirname + '/../views');
        app.set('view engine', 'jade');
        app.use(express.static(__dirname + '/../public'));
        app.use(assets());
        app.use(express.bodyParser());
        app.use(utils.allowCrossDomain);
        app.use(i18n.init);
        app.use(app.router);
    });

    app.configure('development', function(){
        app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
    });

    app.configure('production', function(){
        app.use(express.errorHandler());
    });

};