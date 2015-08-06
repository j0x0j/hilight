(function () {
    "use strict";

    var Cmnt;

    function BGCmnt(params) {
        this.port = params.port;
        // this.url = 'https://hilight.io';
        // this.socketUrl = 'https://hilight.io';
        this.url = 'http://localhost:5000';
        this.socketUrl = 'http://localhost:5000';
        this.createContextMenu();
        this.db = window.cmntDb;
        this.currLocation = null;
        this.socket = null;
        this.open = null;
        this.online = null;
        this.loggedin = false;
        this.reconnections = 0;
        this.connections = 0;
        this.currTimeout = 0;
        this.errors = [];
        this.sid = null;
        this.notification = null;
        this.currentComments = [];
        this.currentTabId = null;
    }

    BGCmnt.prototype.connectWS = function () {
        var self = this;
        if (self.open) return;
        self.socket = new Primus(self.socketUrl, {
            backoff: {
                maxDelay: 10000,
                minDelay: 500,
                retries: Infinity,
                factor: 1
            }
        });
        self.socket.on('open', function () {
            self.connections = self.connections + 1;
            localStorage.setItem('cmnt_connection_attempts', self.connections);
            self.open = true;
            if (self.currLocation != null) {
                self.socket.write({ event: 'subscribe', data: { page: self.currLocation } });
            }
            if (self.loggedin) {
                self.socket.write({
                    event: 'notifications'
                    , data: {
                        username: localStorage.getItem('cmnt_username')
                    }
                });
            }
        });
        self.socket.on('data', function (data) {
            if (data.event === 'notification') {
                self.notify(data);
            }
            if (data.event === 'refresh') {
                self.postMessage(data);
            }
        });
        self.socket.on('reconnect', function () {
            self.open = false;
            self.reconnections = self.reconnections + 1;
            localStorage.setItem('cmnt_reconnection_attempts', self.reconnections);
        });
        self.socket.on('error', function (err) {
            self.open = false;
            self.errors.count = self.errors.count + 1;
            if (self.errors.length > 50) {
                self.errors.pop();
            }
            self.errors.push(err.message);
            localStorage.setItem('cmnt_errors', JSON.stringify(self.errors));
        });
        self.socket.on('end', function () {
            self.open = false;
        });
        self.socket.on('online', function online() {
            self.online = true;
        });
        self.socket.on('offline', function online() {
            self.online = false;
        });
        return;
    };

    BGCmnt.prototype.pollForNews = function (body, cb) {
        var self = this;
        if (self.currLocation == null || self.currLocation !== body.location) {
            if (self.socket != null) {
                if (self.currLocation != null) {
                    self.socket.write({ event: 'unsubscribe', data: { page: self.currLocation } });
                }
                if (self.open == true) {
                    self.socket.write({ event: 'subscribe', data: { page: body.location } });
                }
                self.currLocation = body.location;
            }
        }

        $.ajax({
            url: self.url + '/get/comments/' + encodeURIComponent(body.location) + '/' + body.count,
            success: function (response) {
                var user = response.user;
                if (self.online === false) {
                    self.connectWS();
                }
                self.online = true;
                if (user && localStorage.getItem('cmnt_username') === null) {
                    if (user.username) {
                        localStorage.setItem('cmnt_authed', true);
                        self.setUser({ username: user.username, email: user.email }, function () { return; }, true);
                    }
                }
                if (!user) {
                    localStorage.removeItem('cmnt_authed');
                    localStorage.removeItem('cmnt_email');
                    localStorage.removeItem('cmnt_username');
                }
                if (response.sid) {
                    self.sid = response.sid;
                }
                if (!self.open) {
                    self.socket = null;
                    self.currTimeout = window.setTimeout(function () { return; }, 0);
                    while (self.currTimeout--) {
                        window.clearTimeout(self.currTimeout);
                    }
                    self.connectWS();
                }
                if (self.port) {
                    return cb({
                        action: 'receiveComments',
                        body: { comments: response.comments, user: user, from: 'self', sid: self.sid }
                    });
                }
            },
            error: function (xhr) {
                if (xhr.readyState === 0) {
                    self.online = false;
                    //self.socket.end();
                }
            }
        });
    };

    BGCmnt.prototype.postMessage = function (data) {
        var self = this;
        data.data.from = 'socket';
        data.data.originator = data.originator;
        if (!self.port) return;
        self.port.postMessage({
            action: 'receiveComments',
            body: data.data
        });
    };

    BGCmnt.prototype.notify = function (data) {
        var self = this;
        self.notification = webkitNotifications.createNotification(data.avatar, data.title, data.comment);
        self.notification.onclick = function () {
            chrome.tabs.create({ url: data.url + '#{cmnt_' + data.hash + '}' }, null);
        };
        self.notification.show();
        self.setNotificationCount();
        self.saveNotification(data);
    };

    BGCmnt.prototype.createComment = function (body, cb) {
        var self = this;
        if (!body.text) body.text = '';
        $.post(this.url + '/comment/add/', body, function (response) {
            self.setUser(body, function () {
                return cb({
                    action: 'createComment',
                    body: response
                });
            }, true);
        });
    };

    BGCmnt.prototype.createContextMenu = function () {
        var self = this;
        chrome.contextMenus.create({
            type: 'normal',
            title: chrome.i18n.getMessage('mainCta'),
            contexts: ['all'],
            onclick: function (info) {
                console.log('info >>', info);
                //if(info.mediaType === 'image')
                if (self.port) {
                    self.port.postMessage({
                        action: 'addNewComment',
                        body: { selectionText: info.selectionText }
                    });
                }
            }
        });
    };

    BGCmnt.prototype.getUser = function (body, cb) {
        var username = localStorage.getItem('cmnt_username') || body.username,
            email = localStorage.getItem('cmnt_email') || body.email,
            loggedin = (localStorage.getItem('cmnt_authed') || body.loggedin) || false,
            firstName = (localStorage.getItem('cmnt_name') || body.firstName) || '';

        if (loggedin) {
            this.loggedin = true;
            if (!this.online) this.connectWS();
        } else {
            this.loggedin = false;
        }

        if (!localStorage.getItem('cmnt_username')
            && !localStorage.getItem('cmnt_email')
            && body.loggedin) {
            this.setUser(body, function () {
                localStorage.setItem('cmnt_authed', true);
            }, true);
        }

        return cb({
            action: 'receiveUser',
            body: {
                username: username,
                email: email,
                firstName: firstName,
                loggedin: loggedin
            }
        });


    };

    BGCmnt.prototype.setUser = function (body, cb, flag) {
        var payload;
        localStorage.setItem('cmnt_username', body.username);
        localStorage.setItem('cmnt_email', body.email);
        (body.firstName ? localStorage.setItem('cmnt_name', body.firstName) : false);

        if (flag) {
            return cb({
                username: body.username,
                email: body.email
            });
        }

        payload = {
            action: 'receiveSetUser',
            body: {
                username: body.username,
                email: body.email,
                loggedin: body.loggedin
            }
        }

        if (body.firstName) {
            payload.body.firstName = body.firstName;
        }

        return cb(payload);
    };

    BGCmnt.prototype.getLangs = function (body, cb) {
        chrome.i18n.getAcceptLanguages(function (languageList) {
            body.languages = languageList.join(",");
            return cb({
                action: 'receiveLangs',
                body: body.languages
            });
        });
    };

    BGCmnt.prototype.autosuggest = function (body, cb) {
        var self = this;
        $.get(self.url + '/get/users/' + encodeURIComponent(body.query),
            function (response) {
                return cb({
                    action: 'receiveAutosuggest',
                    body: { response: response, query: body.query }
                });
            });
    };

    BGCmnt.prototype.login = function (body, cb) {
        var self = this;
        $.post(self.url + '/ajax-login/', { email: body.email, password: body.password }, function (data) {
            if (data.loggedin === false) {
                localStorage.removeItem('cmnt_authed');
                cb({
                    action: 'processLogin',
                    body: { err: 'login failed' }
                });
            } else {
                self.setUser(data, function () {
                    localStorage.setItem('cmnt_authed', true);
                    cb({
                        action: 'processLogin',
                        body: data
                    });
                }, true);
            }
            return self.connectWS();
        });
    };

    BGCmnt.prototype.logout = function (body, cb) {
        var self = this;
        $.get(self.url + '/ajax-logout/', function (data) {
            if (data.logged === false) {
                self.socket.write({ event: 'logout', data: { username: localStorage.getItem('cmnt_username') } });
                localStorage.removeItem('cmnt_authed');
                localStorage.removeItem('cmnt_email');
                localStorage.removeItem('cmnt_username');
                cb({
                    action: 'processLogout',
                    body: { success: 'logged out', body: body }
                });
            } else {
                cb({
                    action: 'processLogout',
                    body: { err: 'something went wrong', body: body }
                });
            }
            return self.socket.end();
        });
    };

    BGCmnt.prototype.setBrowserActions = function (body, cb) {
        var self = this;
        chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
            self.currentTabId = tabs[0].id;
            self.currentComents = body.comments;
            chrome.browserAction.setIcon({
                path: 'images/icon128_active.png'
                , tabId: tabs[0].id
            });
            return cb({ action: null, body: '' });
        });
    };

    BGCmnt.prototype.setNotificationCount = function (decrease) {
        var self = this, currCount, newCount;
        currCount = self.getNotificationCount();
        if (decrease) {
            newCount = (currCount > 0 ? currCount - 1 : 0);
        } else {
            newCount = currCount + 1;
        }
        localStorage.setItem('cmnt_notification_count', newCount);
        self.setNotificationBadge(newCount);
    };

    BGCmnt.prototype.setNotificationBadge = function (count) {
        chrome.browserAction.setBadgeText({
            text: count.toString()
        });
    };

    BGCmnt.prototype.getNotificationCount = function () {
        return parseInt(localStorage.getItem('cmnt_notification_count'), 10) || 0;
    };

    BGCmnt.prototype.saveNotification = function (data) {
        var popup = chrome.extension.getViews({ type: 'popup' })[0];
        this.db.insert(data, function () {
            if (popup) {
                popup.addNotification(data);
            }
        });
    };

    chrome.runtime.onConnect.addListener(function (port) {
        console.assert(port.name == "channel");
        if (Cmnt == null) {
            Cmnt = new BGCmnt({ port: port });
            Cmnt.db.open();
            chrome.browserAction.setBadgeBackgroundColor({ color: '#EE3D96' });
            if (Cmnt.getNotificationCount() > 0) {
                Cmnt.setNotificationBadge(Cmnt.getNotificationCount());
            }
        } else {
            Cmnt.port = port;
        }
        Cmnt.port.onMessage.addListener(function (msg) {
            Cmnt[msg.action](msg.body, function (response) {
                if (Cmnt.port) {
                    Cmnt.port.postMessage(response);
                }
                return;
            });
        });
        Cmnt.port.onDisconnect.addListener(function () {
            Cmnt.port = null;
        });
    });

}());