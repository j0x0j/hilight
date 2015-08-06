var db = window.cmntDb
    , loadNotifications
    , objectStore;

loadNotifications = function () {
    db.readAll('notifications', function (notifications) {
        notifications.forEach(function (notification) {
            $('#notifications').prepend('<div data-id="' + notification.id + '" data-url="' 
                + notification.url 
                + '#{cmnt_' + notification.hash + '}" class="row">' 
                + '<div class="user">'
                + '<img src="' + notification.avatar + '" width="20" height="20" class="avatar"> '
                + notification.user
                + ' <span class="ago">' + moment(parseInt(notification.timestamp, 10)).fromNow() + '</span>'
                + '</div>' 
                + '<div class="spacer"><div class="arrow"></div></div>'
                + '<div class="text">' + notification.comment + '</div>'
                + '<div class="url">' + notification.url + '</div></div>');
        });
        $('#notifications').find('.row').unbind('click');
        $('#notifications').find('.row').on('click', function () {
            var count = parseInt(localStorage.getItem('cmnt_notification_count'), 10);
            localStorage.setItem('cmnt_notification_count', count - 1);
            chrome.browserAction.setBadgeText({ text: (count - 1 > 0 ? (count - 1).toString() : '') });
            db.delete('notifications', parseInt($(this).attr('data-id'), 10));
            chrome.tabs.create({ url: $(this).attr('data-url') }, null);
        });
    });
};

window.addNotification = function (notification) {
    $('#notifications').prepend('<div data-id="' + (notification.id || 0) + '" data-url="' 
        + notification.url 
        + '#{cmnt_' + notification.hash + '}" class="row">' 
        + '<div class="user">' + notification.user + '</div>' 
        + '<div class="text">' + notification.comment + '</div>'
        + '<div class="url">' + notification.url + '</div>'
        + '<div class="time">' + moment(parseInt(notification.timestamp, 10)).fromNow() + '</div></div>');
};

db.open(function () {
    chrome.i18n.getAcceptLanguages(function (languageList) {
        var lang = languageList[0];
        moment.lang(lang.substring(0,2));
        loadNotifications();
    });
});

document.addEventListener('DOMContentLoaded', function () {
    chrome.tabs.query({'active': true, 'currentWindow': true }, function (tab) {
        if (!tab) return;
        chrome.tabs.sendMessage(tab[0].id, { method: 'getComments' }, function (response) {
            $.each(response, function (k, v) {
                var cls = 'one';
                if(v.count > 1) cls = 'some';
                if(v.count > 3) cls = 'many';
                $('#content').append('<div data-hash=" ' + v.hash + '" class="row">' 
                    + '<div class="content">' + (v.key.length > 140 ? v.key.substring(0, 140) + '...' : v.key) + '</div>'
                    + '<div class="meta">'
                    + '<div class="count ' + cls + '">' + v.count + '</div>'
                    + '</div>'
                    + '</div>');
            });
            $('#content .row').on('click', function () {
                var hash = $(this).attr('data-hash');
                $('#content .row').css('background', '#ffffff');
                $(this).css('background', '#f6f6f6');
                chrome.tabs.sendMessage(tab[0].id, { method: 'setInView', data: hash }); 
            });
        });
    });
});