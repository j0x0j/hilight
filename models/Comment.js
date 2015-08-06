var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    moment = require('moment'),
    crypto = require('crypto');

var CommentSchema = new Schema({
    id        : Schema.ObjectId,
    url       : { type: String, index: true },
    avatar    : { type: String },
    username  : { type: String },
    email     : { type: String, index: true },
    comment   : { type: String },
    text      : { type: String, index: true },
    hash      : { type: String, index: true },
    lang      : { type: String },
    timestamp : { type: String },
    invites   : { type: Array }
});

CommentSchema
    .virtual('ago')
    .get(function () {
        return moment(new Date(parseInt(this.timestamp,10))).fromNow();
    });

module.exports = mongoose.model('Comments', CommentSchema);