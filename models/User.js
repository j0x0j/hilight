var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    bcrypt = require('bcrypt'),
    crypto = require('crypto'),
    Validations = require('./validations');

var UserSchema = new Schema({
    id        : Schema.ObjectId,
    firstName : { type: String, trim: true },
    lastName  : { type: String, trim: true },
    username  : { type: String, required: true, index: { unique: true, sparse: true }},
    email     : { type: String, index: { unique: true, sparse: true }},
    uid       : { type: String, index: { unique: true, sparse: true }},
    token     : { type: String },
    thumb     : { type: String },
    lang      : { type: String },
    salt      : { type: String },
    hash      : { type: String },
    date      : Date
});

UserSchema.path('username').validate(Validations.uniqueFieldInsensitive('User', 'username'), 'unique');

UserSchema.path('date')
.default(function(){
    return new Date()
})
.set(function(v){
    return v == 'now' ? new Date() : v;
});

UserSchema
    .virtual('fullName')
    .get(function () {
        var name = this.firstName + ' ' + this.lastName;
        return name;
    });

UserSchema.pre('save', function (next) {
  if (!this.email || this.token) return next();
  var hash = crypto.createHash('md5').update(this.email.toLowerCase()).digest("hex");
  this.thumb = 'http://www.gravatar.com/avatar/' + hash;
  next();
});

UserSchema
    .virtual('password')
    .get(function () {
        return this._password;
    })
    .set(function (password) {
        this._password = password;
        var salt = this.salt = bcrypt.genSaltSync(10);
        this.hash = bcrypt.hashSync(password, salt);
    });

UserSchema.method('verifyPassword', function (password, callback) {
  bcrypt.compare(password, this.hash, callback);
});

UserSchema.static('authenticate', function (email, password, callback) {
  this.findOne({ email: email }, function(err, user) {
      if (err) { return callback(err); }
      if (!user) { return callback(null, false); }
      user.verifyPassword(password, function(err, passwordCorrect) {
          if (err) { return callback(err); }
          if (!passwordCorrect) { return callback(null, false); }
          return callback(null, user);
      });
    });
});

module.exports = mongoose.model('User', UserSchema);