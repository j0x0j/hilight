function FGCmnt(params) {
    this.init = true;
    this.port = params.port;
    this.active = true;
    this.timer = null;
    this.pollInterval = null;
    this.username = null;
    this.email = null;
    this.authed = params.authed || null;
    this.lang = null;
    this.commentMap = [];
    this.totalComments = 0;
    this.currSelection = null;
    this.allowedTags = ['P', 'DIV', 'Q'];
    this.scrolledTo = false;
    this.bookmarkRegex = new RegExp('({|%7B)+cmnt_+[a-zA-Z0-9]+(}|%7D)');
    //this.baseUrl = 'https://hilight.io';
    this.baseUrl = 'http://localhost:5000';
    this.getLangs();
}

FGCmnt.prototype.pollForNews = function () {
    var _this = this, location;
    _this.init = null;
    if (_this.active && _this.authed) {
        location = getCanonical();
        return _this.port.postMessage({
            action: 'pollForNews',
            body: { location: location, count: _this.totalComments }
        });
    } else {
        // Check if logged in
        _this.getUser();
    }
};

FGCmnt.prototype.receiveComments = function (results, cb) {
    var _this = this;
    if (results.from === 'self') {
        if (!results.user) { results.user = {}; }
        if (!results.user.username
            && _this.username == null
            && _this.email == null) {
                _this.setAuthedUser(results.user);
        }
        if (!results.user.username && !results.sid) {
            if ($('#cmnt-global-mask').find('.cmnt-login-box').length === 0) {
                _this.authed = false;
                _this.username = null;
                _this.email = null;
                _this.showNotAuthedMenu();
            }
        }
    }
    if (results.from === 'socket') {
        if (results.originator.text === _this.currSelection
            && _this.username !== results.originator.username)
            _this.pushSingleComment(results.originator);
    }
    if (_this.totalComments < results.comments.length) {
        _this.updateComments(results);
    }
};

FGCmnt.prototype.getLangs = function () {
    var _this = this;
    _this.port.postMessage({
        action: 'getLangs',
        body: {}
    });
};

FGCmnt.prototype.receiveLangs = function (results) {
    var _this = this;
    var langs = results.split(',');
    _this.lang = langs[0];
    moment.lang(_this.lang.substring(0,2));
};

FGCmnt.prototype.getUser = function (data) {
    var _this = this;
    _this.port.postMessage({
        action: 'getUser',
        body: data || {}
    });
};

FGCmnt.prototype.receiveUser = function (results) {

    var _this = this;
    _this.username = results.username || null;
    _this.email = results.email || null;

    if (!_this.authed && results.loggedin) {
        $('#cmnt-modal-menu').show();
        $('#add-news-hound-comment').remove();
        $('.cmnt-content-block.cmnt-login-box').remove();
        $('#cmnt-modal-menu-expanded').after(_this.buildCommentForm(_this.username, _this.email));
        if (_this.currSelection) {
            $('#cmnt_add_comment').data('text', _this.currSelection);
        }
        _this.authed = true;
        _this.attachEvents();
        _this.setAuthedUser(results);
        _this.pollForNews();
    }

    return _this.authed = results.loggedin || null;

};

FGCmnt.prototype.setUser = function (username, email, loggedin) {
    var _this = this;
    _this.port.postMessage({
        action: 'setUser',
        body: { username: username, email: email, loggedin: loggedin || false }
    });
};

FGCmnt.prototype.receiveSetUser = function (results) {
    var _this = this;
    _this.username = results.username || null;
    _this.email = results.email || null;
};

FGCmnt.prototype.addNewComment = function (body, cb) {
    var _this = this;

    $('body').each(function () {

        console.log('Common Ancestor', body.commonAncestor);

        var comment = { text: body.selectionText },
            smallestElement =  $(body.commonAncestor) || _this.parseBody(comment);

        if (smallestElement) {
            _this.displayComment(smallestElement);
            window.requestAnimationFrame(function () {
                $('#cmnt-global-mask').find('.btn-primary').data('text', body.selectionText);
            });
        }
    });
};

FGCmnt.prototype.updateComments = function (body, cb) {
    var _this = this
        , smallestElement
        , hash
        , regex = _this.bookmarkRegex
        , elem
        , keys = [];

    _this.totalComments = body.comments.length;
    _this.commentMap = {};

    body.comments.forEach(function (comment, k) {
        if (_this.commentMap[comment.text]) {
            smallestElement = _this.commentMap[comment.text].element;
        } else {
            smallestElement = _this.parseBody(comment);
        }
        _this.mapComment(smallestElement, comment);
    });

    for (var key in _this.commentMap) {
        if (_this.commentMap.hasOwnProperty(key)) {
            _this.commentMap[key].element.data('comments', _this.commentMap[key].comments)
        }
    }

    if (_this.totalComments > 0) {
        for (key in _this.commentMap) {
            keys.push(key);
        }
        _this.port.postMessage({
            action: 'setBrowserActions'
            , body: {
                location: location
                , comments: keys
                , count: _this.totalComments
            }
        });
    }

    if (window.location.hash.match(/cmnt/) && !_this.scrolledTo) {
        hash = window.location.hash.match(regex)[0];
        if (hash) hash = decodeURIComponent(hash);
        elem = document.getElementById(hash.substring(1, hash.length - 1));
        if (elem) elem.scrollIntoView(true);
        _this.scrolledTo = true;
    }

};

FGCmnt.prototype.setInView = function (hash) {
    var id = 'cmnt_' + hash.trim();
    if (document.getElementById(id))
        document.getElementById(id).scrollIntoView(true);
};

FGCmnt.prototype.parseBody = function (comment) {
    var smallestElement = null
        , smallestCount = 99999999;

    var startElem = document.querySelector('body')
        , items = startElem.querySelectorAll('p, div, q, section, article, blockquote, span, h1, h2, h3, h4, li')
        , text
        , regex = /(\r\n|\n|\r| )/gm;

    for (var i = items.length; i--;) {
        text = items[i].textContent.replace(regex,'');
        if (text.indexOf(comment.text.replace(regex,'')) > -1) {
            var html = $(items[i]).html();
            if (html.length < smallestCount) {
                smallestCount = html.length;
                smallestElement = $(items[i]);
            }
        }
    }

    return smallestElement;
};

FGCmnt.prototype.mapComment = function (smallestElement, comment, action) {
    var _this = this, length = 0, key;
    if (smallestElement) {
        if (!smallestElement.hasClass('nh-highlighted') && !smallestElement.data('comments')) {
            smallestElement.contents().wrapAll('<span id="cmnt_' + (comment.hash || Date.now()) + '" class="nh-highlighted one">');
            smallestElement = smallestElement.find('.nh-highlighted');
        }
        key = smallestElement.text();
        if (!_this.commentMap[key]) {
            _this.commentMap[key] = {
                comments: []
            };
            $('.nh-highlighted').unbind('click');
            $('.nh-highlighted').on('click', function () {
                _this.displayComment( $(this) );
            });
        }
        _this.commentMap[key].element = smallestElement;
        _this.commentMap[key].comments.push(comment);
        _this.commentMap[key].element.data('comments', _this.commentMap[key].comments);
        length = _this.commentMap[key].comments.length;
        if (length > 1) smallestElement.removeClass('one, many').addClass('some');
        if (length > 3) smallestElement.removeClass('one, some').addClass('many');
        return _this.commentMap[key].element;
    }
    return;
};

FGCmnt.prototype.createComment = function (result, cb) {
    var _this = this;
    var comment = result;
    var smallestElement = _this.parseBody(comment);
    if (smallestElement) {
        $('#add-news-hound-comment').find('textarea').val('');
        _this.pushSingleComment(comment);
        _this.active = true;
    }
    $('#cmnt-global-mask').find('textarea').toggleClass('processing');
};

FGCmnt.prototype.attachEvents = function () {
    var _this = this, body;

    $('#cmnt-global-mask').find('#cmnt_add_comment').on('click', function () {

        if ($('#cmnt-global-mask').find('textarea').hasClass('processing')) return false;

        $('#cmnt-global-mask').find('textarea').toggleClass('processing');

        $('#add-news-hound-comment textarea').css('height', '30px');

        body = {
            comment: $('#cmnt-global-mask').find('.cmnt_comment-text').val(),
            username: $('#add-news-hound-comment .username').val(),
            email: $('#add-news-hound-comment .email').val(),
            location: getCanonical(),
            lang: _this.lang,
            text: _this.currSelection
        }

        if (body.username === '' || body.email === '' || body.comment === '') {
            $('#cmnt-global-mask').find('textarea').toggleClass('processing');
            return _this.showNotice(chrome.i18n.getMessage('weNeedContent'));
        }

        if (body.comment.length > 1200) {
            $('#cmnt-global-mask').find('textarea').toggleClass('processing');
            return _this.showNotice(chrome.i18n.getMessage('commentTooLong'));
        }

        checkInvites(body);

        _this.active = null;

        _this.port.postMessage({
            action: 'createComment',
            body: body
        });

        if (_this.username == null) {
            _this.setUser(body.username, body.email);
        }

        $('#cmnt-global-mask').find('.addPeeps').hide();

        return false;
    });

    $('#cmnt-modal-close').on('click', function () {
        $('#cmnt-global-mask').empty();
        _this.currSelection = '';
        $('body').css('overflow', 'auto');
    });

    $('#add-news-hound-comment .username').unbind('focus').focus(function () {
        if ($(this).val() === '') {
            $('#add-news-hound-comment .email').show();
        }
    });

    $('#add-news-hound-comment textarea').unbind('keydown keyup focus');

    $('#add-news-hound-comment textarea').focus(function () {
        $(this).css('height', '60px');
    })
    .on('keydown', function (e) {
        var keyCode = e.keyCode || e.which;
        if ($('#cmnt_mention-suggest').length > 0) {
            if (keyCode === 9) {
                e.preventDefault();
            }
        }
    })
    .on('keyup', function (e) {

        var keyCode = e.keyCode || e.which,
            query;

        var contents = this.value;
        var cursorPos = $('#add-news-hound-comment textarea').prop('selectionStart');
        var check_contents = contents.substring(contents.lastIndexOf('@') - 1, cursorPos + 1);
        var regex = new RegExp('\\B\\@([\\w\\-]+)');

        query = check_contents.replace(/@/, '');

        if (contents.indexOf('@') > -1 && check_contents.match(regex) && !check_contents.substring(1).match(/^$|\s+/)) {
            //TODO - prevent unnecesary queries
            if (query.length > 1 && keyCode !== 9) {
                _this.port.postMessage({
                    action: 'autosuggest',
                    body: { query: query.trim() }
                });
            }
        } else {
            $('#cmnt_mention-suggest').remove();
        }

        if (keyCode === 9) {
            if ($('#cmnt_mention-suggest').length > 0) {
                e.preventDefault();
                insertTag($('#cmnt_mention-suggest li:eq(0)'), query);
            }
        }

    });

    $('#cmnt-modal-menu').unbind('click').on('click', function () {
        _this.toggleMenu();
    });

    $('#cmnt-global-mask').find('#cmnt_user_login').on('click', function () {
        _this.toggleMenu();
        $('#add-news-hound-comment').hide();
        $('#cmnt-global-mask').find('.cmnt-content-block.cmnt-login-box').remove();
        $('#cmnt-modal-menu-expanded').after('<div class="cmnt-content-block cmnt-login-box"><input type="text" placeholder="' + chrome.i18n.getMessage('emailPlaceholder') + '" name="cmnt_email" id="cmnt_email" /> \
            <input placeholder="' + chrome.i18n.getMessage('passwordPlaceholder') + '" type="password" name="cmnt_password" id="cmnt_password" /> \
            <button id="cmnt_login_button" class="btn-primary">' + chrome.i18n.getMessage('login') + '</button></div>');
        $('#cmnt-global-mask').find('#cmnt_login_button').unbind('click').on('click', function () {
            _this.login($('#cmnt_email').val(), $('#cmnt_password').val());
        });
        $(this).hide();
        $('#cmnt_user_back').show();
    });

    $('#cmnt-global-mask').find('#cmnt_user_back').on('click', function () {
        $(this).hide();
        $('#add-news-hound-comment').show();
        $('#cmnt_user_login').show();
        $('#cmnt-global-mask').find('.cmnt-content-block').remove();
        _this.toggleMenu();
    });

    $('#cmnt-global-mask').find('.addPeepsBtn').on('click', function () {
        $('#cmnt-global-mask').find('.addPeeps').show().focus();
    });

    $('.cmnt_comment-text').focus(function () {
        var elem = $('#cmnt-global-mask').find('.addPeeps');
        if (elem.val() === '') { return elem.hide(); }
    });

    if (!this.authed) {
        $('#cmnt-modal-menu').hide();
        $('#cmnt-global-mask').find('#cmnt_login_button').unbind('click').on('click', function () {
            _this.login($('#cmnt_email').val(), $('#cmnt_password').val());
        });
    }

    if (this.username != null) {
        this.showCommentingAs();
        if (this.authed) {
            this.showAuthedMenu();
        }
    }
};

FGCmnt.prototype.receiveAutosuggest = function (results, cb) {
    $('#cmnt_mention-suggest').remove();
    if (results.response.users[0] === '') return;
    $('#add-news-hound-comment textarea').after('<ul id="cmnt_mention-suggest"></ul>');
    $.each(results.response.users, function (k, v) {
        $('#cmnt_mention-suggest').append('<li>' + v + '</li>');
    });
    $('#cmnt_mention-suggest li').on('click', function () {
        insertTag(this, results.query);
    });
};

FGCmnt.prototype.showCommentingAs = function () {
    var _this = this;
    $('#add-news-hound-comment .username').hide()
        .after('<span class="cmnt_commenting_as"> \
                ' + chrome.i18n.getMessage('commentingAs') + ' <span class="cmnt_username">'
                + _this.username +
                '</span> <a class="cmnt_ts edit" href="javascript:void(0)">' + chrome.i18n.getMessage('edit') + '</a></span>');
    $('#add-news-hound-comment').find('.edit').on('click', function () {
        $('#add-news-hound-comment').find('.cmnt_commenting_as').hide();
        $('#add-news-hound-comment').find('.username').val('').show();
    });
};

FGCmnt.prototype.displayComment = function (element) {

    var top = $(element).offset().top + $(element).height() + 10;
    var left = $(element).offset().left;
    var username = this.username || '';
    var email = this.email || '';

    this.currSelection = $(element).text();

    $('#cmnt-global-mask').empty();
    $('#cmnt-global-mask').show();

    $("#cmnt-global-mask").html(this.buildCommentBox(top, left, username, email));

    this.attachEvents();
    this.pushComments(element);
    $('#news-hound-thread').draggable({ opacity: 0.7, handle: "#thread-header" });

};

FGCmnt.prototype.buildCommentBox = function (top, left, username, email) {
    var _this = this, html = '';

    html = '<div id="news-hound-thread" class="cmnt-modal" style="position: absolute; top: ' + top + 'px; left: ' + left + 'px; margin: 0px;"> \
      <div id="cmnt-modal-menu">☰</div>\
      <div id="cmnt-modal-close">x</div>\
      <div id="thread-header" class="cmnt-modal-header"> \
      </div> \
      <div id="cmnt-modal-menu-expanded" class="cmnt_hidden"> \
        <ul> \
            <li id="cmnt_user_login">' + chrome.i18n.getMessage('login') + '</li> \
            <li style="display:none" id="cmnt_user_back">' + chrome.i18n.getMessage('back') + '</li> \
            <li id="cmnt_signup_link"><a style="color: green !important" href="' + _this.baseUrl + '/signup/" target="_blank">' + chrome.i18n.getMessage('signUp') + '</li> \
            <li><a href="' + _this.baseUrl + '/help/" target="_blank">' + chrome.i18n.getMessage('help') + '</a></li> \
        </ul> \
      </div>';

    if (_this.authed) {
        html += _this.buildCommentForm(username, email);
    } else {
        html += _this.buildLoginForm();
    }

    html += '<div class="cmnt-modal-body"> \
      </div> \
    </div>';

    return html;
};

FGCmnt.prototype.buildCommentForm = function (username, email) {
    return '<form id="add-news-hound-comment" action="javascript:void(0)" method="post"> \
            <input type="text" placeholder="Emails" class="addPeeps"/> \
            <div class="addPeepsBtn">+</div> \
            <textarea placeholder="' + chrome.i18n.getMessage('commentPlaceholder') + '" class="cmnt_comment-text"></textarea> \
            <input class="left username" type="text" placeholder="' + chrome.i18n.getMessage('namePlaceholder') + '" value="' + username + '"> \
            <input class="left email" style="display:none" type="text" placeholder="' + chrome.i18n.getMessage('emailPlaceholder') + '" value="' + email + '"> \
            <button id="cmnt_add_comment" class="btn btn-primary" value="Add Comment">' + chrome.i18n.getMessage('mainCta') + '</button> \
          </form>';
};

FGCmnt.prototype.buildLoginForm = function () {
    var _this = this;
    return '<div class="cmnt-content-block cmnt-login-box"><input type="text" placeholder="' + chrome.i18n.getMessage('emailPlaceholder') + '" name="cmnt_email" id="cmnt_email" /> \
            <input placeholder="' + chrome.i18n.getMessage('passwordPlaceholder') + '" type="password" name="cmnt_password" id="cmnt_password" /> \
            <button id="cmnt_login_button" class="btn-primary">' + chrome.i18n.getMessage('login') + '</button></div> \
            <form id="add-news-hound-comment" action="javascript:void(0)" method="post"> \
                <p>' + chrome.i18n.getMessage('signUpWith') + '</p> \
                <a target="_blank" href="' + _this.baseUrl + '/auth/twitter" class="btn btn-primary twitter-signin signin-float">' + 'Twitter' + '</a> \
                <a target="_blank" href="' + _this.baseUrl + '/signup/" class="btn btn-primary btn-default signin-float" style="float: right !important">' + 'Email' + '</a> \
            </form>';
};

FGCmnt.prototype.pushComments = function (element) {
    if (element.data('comments') && element.data('comments').length) {
        var commentsArr = element.data('comments').slice(0);
        var comments = commentsArr.reverse();
        $('#cmnt_add_comment').data('text', comments[0].text);
        for (var i = 0, comment; (comment = comments[i]) != null; i++) {
            var ts = new Date(parseInt(comment.timestamp, 10));
            var c = $('<div class="cmnt_comment"> \
                       <img class="cmnt_avatar" height="20" width="20" src="' + comment.avatar.replace('http:', '') + '" /> \
                       <span class="cmnt_comment-content"><span class="cmnt_username">' + comment.username + '</span> \
                       <span data-ts="' + ts + '" class="cmnt_ts">' + moment(ts).fromNow() + '</span><div class="cmnt_spacer"><div class="cmnt_arrow"></div></div> \
                       <span class="cmnt_text">' + comment.comment + '</span></span> \
                       </div>');
            $('#news-hound-thread').find('.cmnt-modal-body').append(c);
        }
    }
};

FGCmnt.prototype.pushSingleComment = function (comment) {
    var ts = new Date(parseInt(comment.timestamp, 10));
    var c = $('<div class="cmnt_comment"> \
               <img class="cmnt_avatar" height="20" width="20" src="' + comment.avatar.replace('http:', '') + '" /> \
               <span class="cmnt_comment-content"><span class="cmnt_username">' + comment.username + '</span> \
               <span data-ts="' + ts + '" class="cmnt_ts">' + moment(ts).fromNow() + '</span><div class="cmnt_spacer"><div class="cmnt_arrow"></div></div> \
               <span class="cmnt_text">' + comment.comment + '</span></span> \
               </div>');
    $('#news-hound-thread').find('.cmnt_comment').each(function () {
        ts = $(this).find('.cmnt_ts').attr('data-ts');
        $(this).find('.cmnt_ts').text(moment(ts).fromNow());
    });
    $('#news-hound-thread').find('.cmnt-modal-body').prepend(c);
};

FGCmnt.prototype.login = function (email, password) {
    var _this = this;

    if (email === '' || password === '')
        return _this.showNotice(chrome.i18n.getMessage('enterCreds'));

    _this.port.postMessage({
        action: 'login',
        body: { email: email, password: password }
    });
};

FGCmnt.prototype.processLogin = function (results, cb) {
    var _this = this;
    if (results.err) {
        _this.showNotice(chrome.i18n.getMessage('loginFailed'));
    } else {
        _this.getUser(results);
    }
};

FGCmnt.prototype.setAuthedUser = function (user) {
    $('#add-news-hound-comment .email').val(user.email);
    $('#add-news-hound-comment .username').val(user.username);
    this.showNotice(chrome.i18n.getMessage('Hi') + user.firstName + chrome.i18n.getMessage('letsGetToIt'));
    this.showAuthedMenu();
    this.username = user.username;
    this.email = user.email;
    return this.authed = true;
};

FGCmnt.prototype.logout = function () {
    var _this = this;
    _this.port.postMessage({
        action: 'logout',
        body: {}
    });
};

FGCmnt.prototype.processLogout = function (results, cb) {
    var _this = this;
    $('#add-news-hound-comment').remove();
    $('#cmnt-modal-menu-expanded').after(_this.buildLoginForm);
    $('#cmnt-modal-menu').hide();
    _this.authed = false;
    _this.username = null;
    _this.email = null;
    _this.showNotice(chrome.i18n.getMessage('loggedOut'));
    _this.toggleMenu();
    _this.showNotAuthedMenu();
    if (cb) return cb();
};

FGCmnt.prototype.showNotice = function (message) {
    var elem = $('#cmnt-global-mask').find('#cmnt-modal-menu-expanded');
    elem.after('<div class="cmnt_notice">' + message + '</div>');
    setTimeout(function () { $('#cmnt-global-mask').find('.cmnt_notice').remove() }, 3500);
};

FGCmnt.prototype.toggleMenu = function () {
    $('#cmnt-modal-menu-expanded').toggleClass('cmnt_hidden');
};

FGCmnt.prototype.showAuthedMenu = function () {
    var _this = this;
    $('#cmnt_user_login').hide();
    $('#cmnt_user_back').hide();
    $('#cmnt_signup_link').hide();
    $('#cmnt-modal-menu-expanded ul').find('#cmnt_user_logout, #cmnt_user_profile').remove();
    $('#cmnt-modal-menu-expanded ul').prepend('<li id="cmnt_user_logout">' + chrome.i18n.getMessage('logout') + '</li>');
    $('#cmnt-modal-menu-expanded ul').prepend('<li id="cmnt_user_profile"><a href="https://hilight.io/me/" target="_blank">' + chrome.i18n.getMessage('profile') + '</a></li>');
    $('#cmnt_user_logout').unbind('click').on('click', function () {
        _this.logout();
    });
};

FGCmnt.prototype.showNotAuthedMenu = function () {
    $('#cmnt_user_login').show();
    $('#cmnt_signup_link').show();
    $('#cmnt_user_logout').hide();
    $('#cmnt_user_profile').hide();
    $('.cmnt_commenting_as').remove();
    $('#add-news-hound-comment').find('.username').show().val('');
    $('#add-news-hound-comment .username').unbind('focus').focus(function () {
        if ($(this).val() === '') {
            $('#add-news-hound-comment .email').show().val('');
        }
    });
};

FGCmnt.prototype.getSelection = function (selection) {

    //console.log(selection.getRangeAt());

    var range = selection.getRangeAt();
    var selectionText = selection.getRangeAt().toString();

    //console.log('Range text', range.toString());

    //selection.removeAllRanges();
    //selection.addRange(range);

    //console.log($(range.commonAncestorContainer));

    //document.execCommand('bold', false, null);

    //$(selection.focusNode).addClass('nh-highlighted');

    var self = this;

    console.log('selection', selection);
    console.log('currSelection', self.currSelection);

    if (!selection.baseNode) return $('#cmnt-indicator').remove();
    if (self.allowedTags.indexOf(selection.baseNode.parentElement.tagName) < 0) {
        return $('#cmnt-indicator').remove();
    }
    console.log('passed first and second');
    if (selection.type === 'None'
        || selection.type === 'Caret'
        || !selection.focusNode.data) {
        return setTimeout(function () {$('#cmnt-indicator').remove()});
    }
    console.log('passed third');
    if (selection.focusNode.id !== 'cmnt-global-mask'
         && $('#cmnt-indicator').length > 0) return $('#cmnt-indicator').remove();
    console.log('passed fourth');
    if (self.currSelection !== self.selection.data
        && typeof self.currSelection !== 'undefined')  {
        console.log('INNNN fifth', self.currSelection, self.selection.data);
        return $('#cmnt-indicator').remove();
    }
    console.log('passed fifth');
    self.selection.node = $(selection.baseNode.parentElement);
    self.selection.data = selection.baseNode.parentNode.innerText;
    // self.selection.offset = selection.focusOffset;
    // self.selection.baseoffset = selection.baseOffset;
    // self.selection.text = self.selection.data.substring(self.selection.baseoffset, self.selection.offset);
    self.selection.text = selectionText;
    self.selection.top = self.selection.node.offset().top - 30;
    self.selection.left = self.selection.node.offset().left;
    self.currSelection = self.selection.data;

    console.log('selection', self.selection);

    $('#cmnt-indicator').remove();
    $('#cmnt-global-mask').prepend('<div id="cmnt-indicator">+</div>');
    $('#cmnt-indicator').css({
          'position' : 'absolute'
        , 'top' : self.selection.top + 'px'
        , 'left' : self.selection.left + 'px'
        , 'margin' : '0px'
    }).on('click', function (e) {
        e.preventDefault();
        e.stopPropagation();

        console.log('Ancestor', range.commonAncestorContainer);

        //$(range.commonAncestorContainer).wrapInner('<span class="nh-highlighted"></span>');
        self.addNewComment({
            selectionText: self.currSelection
            , commonAncestor: range.commonAncestorContainer
        });
    });
    $('#cmnt-global-mask').show();
};

FGCmnt.prototype.selection = {
    node: null
    , data: null
    , offset: 0
    , baseoffset: 0
    , text: ''
    , top: 0
    , left: 0
};

// helpers

var getCanonical = function () {
    var location;
    try {
        location = document.querySelector('link[rel="canonical"]').href
        || document.querySelector('meta[property="og:url"]').content;
    } catch (err) {
        location = (window.location.hash === '' ? window.location.href : window.location.href.replace(window.location.hash, ''));
    };

    return location;
}

var insertTextAtCursor = function (el, text) {
    var val = el.value, endIndex, range;
    if (typeof el.selectionStart != "undefined" && typeof el.selectionEnd != "undefined") {
        endIndex = el.selectionEnd;
        el.value = val.slice(0, endIndex) + text + val.slice(endIndex);
        el.selectionStart = el.selectionEnd = endIndex + text.length;
    } else if (typeof document.selection != "undefined" && typeof document.selection.createRange != "undefined") {
        el.focus();
        range = document.selection.createRange();
        range.collapse(false);
        range.text = text;
        range.select();
    }
}

var insertTag = function (el, query) {
    var name = $(el).text();
    var elem = document.querySelector('#add-news-hound-comment textarea');
    var text;
    if ($(elem).val().length > query.trim().length + 1) {
        text = name.substring(query.length - 1);
    } else {
        text = name.substring(query.length);
    }
    insertTextAtCursor(elem, text);
    $('#cmnt_mention-suggest').remove();
}

var checkInvites = function (body) {
    if ($('#cmnt-global-mask .addPeeps').val() !== '') {
        var emailString = $('#cmnt-global-mask .addPeeps').val(),
            emailPattern = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
            emails = [];
        body.invites = [];
        if (/,/.test(emailString)) {
            emails = emailString.split(',');
        } else {
            emails = emailString.split(' ');
        }
        $.each(emails, function (k, v) {
            var email = v.trim();
            if (emailPattern.test(email)) {
                body.invites.push(email);
            }
        });
    }
    return body;
}

$(document).ready(function () {
    var Cmnt
        , timer
        , mousemove
        , portListeners;

    Cmnt = new FGCmnt({
        port: chrome.runtime.connect({name: "channel"})
    });

    if ($('#cmnt-profile-authed').length > 0) {
        Cmnt.getUser({
            username: $('#cmnt-profile-authed').attr('data-username')
            , email: $('#cmnt-profile-authed').attr('data-email')
            , firstName: $('#cmnt-profile-authed').attr('data-name')
            , loggedin: true
        });
    } else {
        Cmnt.getUser();
    }

    portListeners = function () {
        Cmnt.port.onMessage.addListener(function (msg) {
            if (!msg.action) return;
            Cmnt[msg.action](msg.body, function (response) {
                return null;
            });
        });
    };

    timer = function () {
        Cmnt.timer = setInterval(function () {
            Cmnt.active = null;
        }, 1667);
    }
    mousemove = function () {
        $('body').on('mousemove', function () {
            Cmnt.active = true;
        });
    }
    $(window).on("blur focus", function(e) {
        var prevType = $(this).data("prevType");
        if (prevType != e.type) {
            switch (e.type) {
                case "blur":
                    Cmnt.active = null;
                    clearInterval(Cmnt.pollInterval);
                    clearInterval(Cmnt.timer);
                    Cmnt.port.disconnect();
                    Cmnt.port = null;
                    $('body').unbind('mousemove');
                    break;
                case "focus":
                    Cmnt.active = true;
                    Cmnt.port = chrome.runtime.connect({name: "channel"});
                    portListeners();
                    Cmnt.pollForNews();
                    timer();
                    mousemove();
                    break;
            }
        }
        $(this).data("prevType", e.type);
    });
    $('body').append('<div id="cmnt-global-mask" role="chrome-extension"><div id="news-hound-thread"></div></div>');
    $(document.body).on("mouseup", function () {
        console.log('mousing up');
        Cmnt.getSelection(window.getSelection());
    });
    portListeners();
    Cmnt.init = true;
    mousemove();
    timer();
    Cmnt.active = true;

    chrome.extension.onMessage.addListener(function (message, sender, sendResponse) {
        var keys = [];
        if (message.method === 'getComments') {
            for (key in Cmnt.commentMap) {
                keys.push({
                    key: key
                    , hash: Cmnt.commentMap[key].comments[0].hash
                    , count: Cmnt.commentMap[key].comments.length
                });
            }
            sendResponse(keys);
        }
        if (message.method === 'setInView') {
            Cmnt.setInView(message.data);
        }
    });

});
