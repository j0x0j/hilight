var Factory = require('factory-lady'),
    helper = require('./helper'),
    should = require('should'),
    http = require('request'),
    app = require('../app'),
    redis = require('../config').redis,
    url = 'http://localhost:5000';

describe('User', function () {

    beforeEach(function (done) {
        helper.cleanDB(function () {
            done();
        });
    });

    describe('add', function () {

        it('creates a new user given valid attributes and returns it', function (done) {
            helper.signup({
                user: {
                    username: 'testuser',
                    firstName: 'Joe',
                    email: 'test@sample.com',
                    password: 'securestring',
                    lang: 'en'
                }
            }, 
            function (err, res, body) {
                res.statusCode.should.be.equal(201);
                body.should.have.property('_id');
                body.username.should.equal('testuser');
                done();
            });
        });

        it('returns validation failure for invalid attributes', function (done) {
            helper.signup({
                user: {
                    username: '',
                    email: 'somestring'
                }
            },
            function (err, res, body) {
                res.statusCode.should.be.equal(200);
                body.should.have.property('err');
                body.err.should.equal('Missing Properties');
                done();
            });
        });

        it('returns validation failure errors for duplicate usernames', function (done) {
            Factory.create('user', function (user) {
                helper.signup({
                    user: {
                        username: user.username,
                        email: user.email
                    }
                },
                function (err, res, body) {
                    res.statusCode.should.be.equal(200);
                    body.should.have.property('_id');
                    body._id.should.equal(user._id.toString());
                    done();
                });
            });
        });

    });

    describe('update', function () {

        it('logs in user, updates properties and returns it', function (done) {

            helper.signedInUser(function (err, res, user) {
                user.should.have.property('_id');
                helper.updateUser({
                    _id: user._id,
                    firstName: 'User',
                    lastName: 'Test',
                    username: 'someother',
                    email: 'sample@email.com'
                }, function (err, res, body, prevuser) {
                    body.should.have.property('_id');
                    body._id.should.equal(user._id.toString());
                    body.username.should.equal('someother');
                    body.email.should.equal('sample@email.com');
                    body.firstName.should.equal('User');
                    body.lastName.should.equal('Test');
                    var newslug = helper.slugify(body.username);
                    redis.multi()
                        .get('user:' + body.username)
                        .get('user:' + newslug + ':comment-count')
                        .get('user:' + newslug + ':mentions')
                        .exists('user:' + newslug + ':mentioned')
                        .exec(function (err, replies) {
                            replies[0].should.be.a('string');
                            replies[1].should.be.a('string');
                            replies[2].should.be.a('string');
                            replies[3].should.equal(1);
                            done();
                        });
                });
            });

        });

        it('does not update for dulicate username', function (done) {

            Factory.create('user', function (user1) {
                helper.signedInUser(function (err, res, user2) {
                    user2.should.have.property('_id');
                    helper.updateUser({
                        _id: user2._id,
                        firstName: user2.firstName,
                        lastName: user2.lastName,
                        username: user1.username,
                        email: 'sample@email.com'
                    }, function (err, res, body) {
                        res.statusCode.should.be.equal(400);
                        body.should.have.property('error');
                        body.should.have.property('path');
                        body.error.should.equal('ValidationError');
                        done();
                    });
                });
            });

        });

    });

});