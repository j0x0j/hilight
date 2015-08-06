var Factory = require('factory-lady'),
    User = require('../models/User'),
    Comment = require('../models/Comment');
    
var count = 1;

Factory.define('user', User, {
    firstName: 'Test',
    lastName: 'User',
    username: function(cb) { cb('testUser'+(count++)); },
    email: function(cb) { cb('test'+(count)+'@email.com'); },
    password: 'asecurestring',
    lang: 'en'
});

Factory.define('comment', Comment, {
    url: 'http://cmnt.io',
    username: function(cb) { cb('testUser'+(count++)); },
    email: function(cb) { cb('test'+(count)+'@email.com'); },
    comment: 'Some comment for testing @testUser1',
    text: 'This is the sample anchor text for the mapping',
    lang: 'en'
});