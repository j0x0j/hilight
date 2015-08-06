$(document).ready(function () {
    var skip = 0, offset = 0, attachEditEvents, local;

    local = {
        set: function (key, value) {
            return localStorage.setItem(key, value);
        },
        get: function (key) {
            return localStorage.getItem(key);
        }
    }

    attachEditEvents = function () {
        $('.editComment').unbind('click').on('click', function (e) {
            var text = $(this).closest('.lead').text().replace(/Edit/, '').trim(),
                _id = $(this).attr('data-id'),
                box = $(this).parent().parent();

            box.find('.editor').css('width','95%').val(text).show();
            box.find('.lead').hide();
            $(this).hide();
            box.find('.cancel').show().unbind('click').on('click', function () {
                box.find('textarea.editor').hide();
                box.find('.submiter').hide();
                box.find('.cancel').hide();
                box.find('.lead').show();
                box.find('.editComment').show();
            });
            box.find('.submiter').show().unbind('click').on('click', function () {
                var newComment = box.find('.editor').val();
                if (text === newComment || newComment === '') return false;
                $.post('/comment/edit/', { 
                    _id: _id, 
                    comment: box.find('.editor').val() 
                }, function (data) {
                    box.find('textarea.editor').hide();
                    box.find('.submiter').hide();
                    box.find('.cancel').hide();
                    box.find('.lead .comment').text(data.comment);
                    box.find('.lead').show();
                }).error(function () {
                    alert('Validation Error');
                });
            });

        });
    }

    if($('#load-more').length > 0) {
        $('#load-more').on('click', function () {
            skip += 5;
            $.getJSON('/get/user/comments/' + skip, function (data) {
                data.forEach(function (v, k) {
                    var ago = moment(parseInt(v.timestamp, 10)).fromNow();
                    $('#load-more').before('<div class="box"> \
                        <textarea style="display:none" class="editor"></textarea> \
                        <p class="lead"><span class="comment">' + v.comment + '</span> \
                        <button style="height: 27px; padding-top: 3px; display: inline-block;" data-id="' + v._id + '" class="btn btn-success editComment">Edit</button></p> \
                        <button style="display:none" class="btn btn-primary submiter">Submit</button> \
                        <button style="display:none" class="btn btn-warning cancel">Cancel</button> \
                        <p>' + ago + '</p> \
                        <div class="fromUrl"> \
                            <i class="icon-share-alt"></i> \
                            <a href="' + v.url + '" target="_blank">' + v.url + '</a> \
                        </div> \
                    </div>');
                });
                attachEditEvents();
                if(parseInt($('#total-comments').text(), 10) <= $('.box').length)
                    return $('#load-more').remove()
            });
        });
    }

    if($('#load-more-mentions').length > 0) {
        $('#load-more-mentions').on('click', function () {
            offset += 5;
            $.getJSON('/get/user/mentions/' + offset, function (data) {
                data.forEach(function (v, k) {
                    var ago = moment(parseInt(v.timestamp, 10)).fromNow();

                    $('#load-more-mentions').before('<div class="box"> \
                        <p> \
                            <img src="' + v.avatar.replace('http:','') + '" width="20" height="20" class="avatar"> \
                            ' + v.username + ' <span class="ago">' + ago + '</span> \
                        </p> \
                        <div class="spacer"><div class="arrow"></div></div> \
                        <p class="lead bubble">' + v.comment + '</p> \
                        <div class="fromUrl"> \
                        <i class="icon-share-alt"></i> \
                        <a href="' + v.url + '" target="_blank">' + v.url + '</a> \
                        </div></div>');
                });
                if(parseInt($('#total').val(), 10) <= $('.box').length)
                    return $('#load-more-mentions').remove()
            });
        });
    }

    if($('#addUser').length > 0) {
        $('#addUser').on('submit', function (e) {
            e.preventDefault();
            $.post('/user/add/', $(this).serialize(), function (data) {
                console.log(data);
                if(data.error) return alert(data.error);
                window.location.href = '/me/';
            });
        });
    }

    if($('#editUser').length > 0) {
        $('#editUser').on('submit', function (e) {
            e.preventDefault();
            $.post('/user/update/', $(this).serialize(), function (data) {
                console.log(data);
                window.location.href = '/me/';
            }).error(function () {
                alert('Validation Error');
            });
        });
    }

    if($('.editComment').length > 0) {
        attachEditEvents();
    }

    if($('#addThreadComment').length > 0) {
        var user = {
            username: local.get('username') || '',
            email: local.get('email') || ''
        };
        $('#name').val(user.username);
        $('#email').val(user.email);
        //$('#comment').focus();
        document.getElementById('addThreadComment')
            .addEventListener('submit', function () {
                var body = {
                    comment: $('#comment').val(),
                    username: $('#name').val(),
                    email: $('#email').val(),
                    location: $('.fromUrl a').attr('href'),
                    lang: 'en',
                    text: $('#originatorText').text()
                }
                
                if(body.username === '' 
                    || body.email === '' 
                    || body.comment === '' 
                    || body.comment.trim() === '@' + $('#originatorUser').val()) 
                    return alert('All fields are required');

                if(body.comment.length > 1200) 
                    return alert('Your comment is too long');

                $.post('/comment/add/', body, function (comment) {
                    $('#addThreadComment').after('<div class="box">\
                        <p><img src="' + comment.avatar.replace('http:','') + '" width="20" height="20" class="avatar"> \
                        ' + comment.username + ' \
                        <span class="ago">' + moment(comment.timestamp).fromNow() + '</span>\
                        </p><div class="spacer"><div class="arrow"></div></div>\
                        <p class="lead bubble">' + comment.comment + '</p></div>');

                    $('#comment').val('');
                    window.scrollTo(0, $('.box:eq(0)').offset().top - 50);
                    local.set('username', comment.username);
                    local.set('email', comment.email);
                });

        }, false);
    }

});