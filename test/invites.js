var Factory = require('factory-lady'),
    helper = require('./helper'),
    should = require('should'),
    http = require('request'),
    app = require('../app'),
    url = 'http://localhost:5000';

describe('Invite', function () {

    beforeEach(function (done) {
        helper.cleanDB(function () {
            done();
        });
    });

    describe('add', function () {

        it('creates a new invitation and queues it for sending', function (done) {
            Factory.create('user', function (user) {
                var invite = {
                    sender: {
                        email: user.email,
                        name: user.firstName
                    },
                    recipients: ['jmgalanes@gmail.com'],
                    location: 'http://example.com/somepage',
                    lang: 'en'
                };
                http({
                    method: 'POST',
                    url: url + '/invite/add/',
                    json: true,
                    body: invite
                },
                function (err, res, body) {
                    res.statusCode.should.be.equal(201);
                    body.should.have.property('message');
                    body.message.should.equal('invites queued');
                    done();
                });  
            });
        });

        it('returns validation error for invalid or empty properties', function (done) {
            Factory.create('user', function (user) {
                var invite = {
                    sender: {
                        email: user.email,
                        name: ''
                    },
                    recipients: '',
                    location: '',
                    lang: '',
                };
                http({
                    method: 'POST',
                    url: url + '/invite/add/',
                    json: true,
                    body: invite
                },
                function (err, res, body) {
                    res.statusCode.should.be.equal(200);
                    body.should.have.property('errors');
                    body.errors.should.a('object');
                    done();
                });  
            });
        });

    });

});