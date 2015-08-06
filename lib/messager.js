var crypto = require('crypto')
    , client = {};

module.exports = function (primus) {

    primus.on('connection', function (socket) {

        client[socket.id] = (client[socket.id] ? client[socket.id] : require('../config').newRedisClient());

        socket.on('data', function (message) {
            var shasum = crypto.createHash('sha1').update(message.data.page || '').digest('hex');
            if (message.event === 'subscribe') {
                client[socket.id].subscribe(shasum);
            }
            if (message.event === 'unsubscribe') {
                client[socket.id].unsubscribe(shasum);
            }
            if (message.event === 'notifications') {
                client[socket.id].subscribe('notifications:' + message.data.username);
            }
            if (message.event === 'logout') {
                client[socket.id].unsubscribe('notifications:' + message.data.username);
            }
        });

        client[socket.id].on('ready', function (e) {
           console.log('starting redis connection', socket.id);
        });

        client[socket.id].on('message', function (channel, message) {
            console.log(Object.keys(client).length);
            var data = JSON.parse(message);
            console.log('< client on message >', channel);
            socket.write(data);
        });

        client[socket.id].on('end', function () {
            console.log('ending redis connection', socket.id);
            socket.end();
        });

        client[socket.id].on('reconnecting', function (e) {
           console.log('reconnecting redis client', socket.id, e);
        });

        client[socket.id].on('error', function (e) {
           console.log('subscriber', e.stack);
        });

        client[socket.id].on('subscribe', function (channel, count) {
            console.log('SUB >', channel, count);
        });

        client[socket.id].on('unsubscribe', function (channel, count) {
            console.log('UNSUB >', channel, count);
        });

    });

    primus.on('disconnection', function (socket) {
        console.log('socket disconnect', socket.id);
        client[socket.id].unsubscribe();
        client[socket.id].quit();
        delete client[socket.id];
        console.log('');
    });

};