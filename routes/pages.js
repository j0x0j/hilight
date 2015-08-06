//GET /
exports.home = function (req, res) {
    res.render('index', { title: 'hilight.io | Tag the web' })
};