module.exports = {

    allowCrossDomain: function (req, res, next) {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET,POST');
        res.header('Access-Control-Allow-Headers', 'Content-Type');
        next();
    },

    ensureAuthenticated: function (req, res, next) {
        if (req.isAuthenticated()) { return next(); }
        res.redirect('/login/');
    },

    slugify: function (s) {
        var slug,
            _slugify_strip_re = /[^\w\s-]/g,
            _slugify_hyphenate_re = /[-\s]+/g;

        s = s.replace(_slugify_strip_re, '').trim().toLowerCase();
        s = s.replace(_slugify_hyphenate_re, '-');
        slug = s;
        return slug;
    }

}