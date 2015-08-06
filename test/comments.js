var Factory = require('factory-lady'),
    helper = require('./helper'),
    should = require('should'),
    http = require('request'),
    app = require('../app'),
    routes = require('../routes/comments'),
    url = 'http://localhost:5000';

describe('Comment', function () {

    beforeEach(function (done) {
        helper.cleanDB(function () {
            done();
        });
    });

    describe('add', function () {

        it('creates a new comment given valid attributes and returns it', function (done) {
            helper.signedInUser(function (err, res, user) {
                helper.comment({
                    data: {
                        location: 'http://www.google.com',
                        username: user.username,
                        email: user.email,
                        comment: 'Some comment for testing',
                        text: 'This is the sample anchor text for the mapping',
                        lang: 'en'
                    }
                }, 
                function (err, res, body) {
                    res.statusCode.should.be.equal(201);
                    body.should.have.property('_id');
                    body.should.have.property('hash');
                    body.username.should.equal(user.username);
                    done();
                });
            });  
        });

        it('returns validation failure for invalid attributes', function (done) {
            helper.signedInUser(function (err, res, user) {
                helper.comment({
                    data: {
                        location: '',
                        username: '',
                        email: '',
                        comment: '',
                        text: '',
                        lang: ''
                    }
                }, 
                function (err, res, body) {
                    res.statusCode.should.be.equal(200);
                    body.should.have.property('err');
                    body.err.should.equal('Missing properties');
                    done();
                });
            });
        });

        it('verifies that a cache and comment-count keys are set for a page', function (done) {
            helper.signedInUser(function (err, res, user) {
                helper.comment({
                    data: {
                        location: 'http://cmnt.io',
                        username: user.username,
                        email: user.email,
                        comment: 'Some comment for testing',
                        text: 'This is the sample anchor text for the mapping',
                        lang: 'en'
                    }
                }, 
                function (err, res, body) {
                    res.statusCode.should.be.equal(201);
                    helper.getComments({ url: body.url }, function (comments) {
                        helper.verifyPageCache(body.url, function (result) {
                            result.should.have.property('cache');
                            result.should.have.property('count');
                            result.cache[0]._id.should.equal(body._id);
                            result.count.should.equal('1');
                            done();
                        });
                    });
                });
            });  
        });

    });

    describe('edit', function () {

        it('finds a comment by its id changes a property and returns it', function (done) {
            
            helper.signedInUser(function (err, res, user) {
                helper.comment({
                    data: {
                        location: 'http://www.google.com',
                        username: user.username,
                        email: user.email,
                        comment: 'Some comment for testing',
                        text: 'This is the sample anchor text for the mapping',
                        lang: 'en'
                    }
                }, 
                function (err, res, comment) {
                    helper.editComment({
                        data: {
                            _id: comment._id,
                            comment: 'Some comment for testing (that has been edited)',
                        }
                    }, 
                    function (err, res, body) {
                        res.statusCode.should.be.equal(200);
                        body.should.have.property('_id');
                        body._id.should.equal(comment._id);
                        body.comment.should.equal('Some comment for testing (that has been edited)')
                        done();
                    });
                });
            });
            
        });

        it('returns validation failure for un-authorized request', function (done) {
            
            helper.signedInUser(function (err, res, user) {
                helper.comment({
                    data: {
                        location: 'http://www.google.com',
                        username: 'tester1',
                        email: 'tester1@email.com',
                        comment: 'Some comment for testing',
                        text: 'This is the sample anchor text for the mapping',
                        lang: 'en'
                    }
                }, 
                function (err, res, comment) {
                    helper.editComment({
                        data: {
                            _id: comment._id,
                            comment: 'Some comment for testing (that has been edited)',
                        }
                    }, 
                    function (err, res, body) {
                        res.statusCode.should.be.equal(200);
                        body.should.have.property('err');
                        done();
                    });
                });
            });

        });

    });

    describe('delete', function () {

        it('destroys object and decreases associated redis keys', function (done) {
            helper.signedInUser(function (err, res, user) {
                helper.newComment(user, function (err, res, comment) {
                    helper.deleteComment({ 
                        data: comment
                    }, function (err, res, body) {
                        res.statusCode.should.be.equal(200);
                        body.should.have.property('message');
                        body.message.should.equal('success');
                        helper.verifyCommentKeys(comment, function (errs) {
                            errs.length.should.be.equal(0);
                            done();
                        });
                    });
                });
            });
        });

        it('returns empty object for invalid id', function (done) {
            Factory.create('comment', function (comment) {
                helper.signedInUser(function (err, res, user) {
                    helper.newComment(user, function (err, res, comment) {
                        comment._id = 'SomeOtherString';
                        helper.deleteComment({ 
                            data: comment
                        }, function (err, res, body) {
                            res.statusCode.should.be.equal(200);
                            body.should.have.property('err');
                            body.err.should.equal('no comment found');
                            done();
                        });
                    });
                });
            });
        });

    });

    describe('mention', function () {

        it('searches for mentioned user and sends email with details', function (done) {
            Factory.create('comment', function (comment) {
                routes.mentions(comment, function (matches) {
                    var matched = matches[0].trim();
                    matched.should.be.a('string');
                    matched.should.equal('testUser1');
                    done();
                });
            });
        });

    });

    describe('invites', function () {

        it('dispatches email invites to added users', function (done) {
            helper.signedInUser(function (err, res, user) {
                helper.comment({
                    data: {
                        location: 'http://www.google.com',
                        username: user.username,
                        email: user.email,
                        comment: 'Some comment for testing',
                        text: 'This is the sample anchor text for the mapping',
                        lang: 'en',
                        invites: ['jmgalanes@gmail.com', 'jo@cmnt.io']
                    }
                }, 
                function (err, res, body) {
                    res.statusCode.should.be.equal(201);
                    body.should.have.property('_id');
                    body.username.should.equal(user.username);
                    body.should.have.property('invites').and.be.a('object');
                    body.invites.length.should.equal(2);
                    done();
                });
            });
        });

    });

});