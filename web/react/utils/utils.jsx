// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var ChannelStore = require('../stores/channel_store.jsx');
var UserStore = require('../stores/user_store.jsx');
var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;
var AsyncClient = require('./async_client.jsx');
var client = require('./client.jsx');
var Autolinker = require('autolinker');
import {config} from '../utils/config.js';

export function isEmail(email) {
    var regex = /^([a-zA-Z0-9_.+-])+\@(([a-zA-Z0-9-])+\.)+([a-zA-Z0-9]{2,4})+$/;
    return regex.test(email);
}

export function cleanUpUrlable(input) {
    var cleaned = input.trim().replace(/-/g, ' ').replace(/[^\w\s]/gi, '').toLowerCase().replace(/\s/g, '-');
    cleaned = cleaned.replace(/^\-+/, '');
    cleaned = cleaned.replace(/\-+$/, '');
    return cleaned;
}

export function isTestDomain() {
    if ((/^localhost/).test(window.location.hostname)) {
        return true;
    }

    if ((/^dockerhost/).test(window.location.hostname)) {
        return true;
    }

    if ((/^test/).test(window.location.hostname)) {
        return true;
    }

    if ((/^127.0./).test(window.location.hostname)) {
        return true;
    }

    if ((/^192.168./).test(window.location.hostname)) {
        return true;
    }

    if ((/^10./).test(window.location.hostname)) {
        return true;
    }

    if ((/^176./).test(window.location.hostname)) {
        return true;
    }

    return false;
}

export function getDomainWithOutSub() {
    var parts = window.location.host.split('.');

    if (parts.length === 1) {
        if (parts[0].indexOf('dockerhost') > -1) {
            return 'dockerhost:8065';
        }

        return 'localhost:8065';
    }

    return parts[1] + '.' + parts[2];
}

export function getCookie(name) {
    var value = '; ' + document.cookie;
    var parts = value.split('; ' + name + '=');
    if (parts.length === 2) {
        return parts.pop().split(';').shift();
    }
}

export function notifyMe(title, body, channel) {
    if ('Notification' in window && Notification.permission !== 'denied') {
        Notification.requestPermission(function onRequestPermission(permission) {
            if (Notification.permission !== permission) {
                Notification.permission = permission;
            }

            if (permission === 'granted') {
                var notification = new Notification(title, {body: body, tag: body, icon: '/static/images/icon50x50.gif'});
                notification.onclick = function onClick() {
                    window.focus();
                    if (channel) {
                        switchChannel(channel);
                    } else {
                        window.location.href = '/';
                    }
                };
                setTimeout(function closeNotificationOnTimeout() {
                    notification.close();
                }, 5000);
            }
        });
    }
}

export function ding() {
    if (!isBrowserFirefox()) {
        var audio = new Audio('/static/images/ding.mp3');
        audio.play();
    }
}

export function getUrlParameter(sParam) {
    var sPageURL = window.location.search.substring(1);
    var sURLVariables = sPageURL.split('&');
    for (var i = 0; i < sURLVariables.length; i++) {
        var sParameterName = sURLVariables[i].split('=');
        if (sParameterName[0] === sParam) {
            return sParameterName[1];
        }
    }
    return null;
}

export function getDateForUnixTicks(ticks) {
    return new Date(ticks);
}

export function displayDate(ticks) {
    var d = new Date(ticks);
    var monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    return monthNames[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}

export function displayTime(ticks) {
    var d = new Date(ticks);
    var hours = d.getHours();
    var minutes = d.getMinutes();

    var ampm = 'AM';
    if (hours >= 12) {
        ampm = 'PM';
    }

    hours = hours % 12;
    if (!hours) {
        hours = '12';
    }
    if (minutes <= 9) {
        minutes = '0' + minutes;
    }
    return hours + ':' + minutes + ' ' + ampm;
}

export function displayDateTime(ticks) {
    var seconds = Math.floor((Date.now() - ticks) / 1000);

    var interval = Math.floor(seconds / 3600);

    if (interval > 24) {
        return this.displayTime(ticks);
    }

    if (interval > 1) {
        return interval + ' hours ago';
    }

    if (interval === 1) {
        return interval + ' hour ago';
    }

    interval = Math.floor(seconds / 60);
    if (interval > 1) {
        return interval + ' minutes ago';
    }

    return '1 minute ago';
}

export function displayCommentDateTime(ticks) {
    return displayDate(ticks) + ' ' + displayTime(ticks);
}

// returns Unix timestamp in milliseconds
export function getTimestamp() {
    return Date.now();
}

function testUrlMatch(text) {
    var urlMatcher = new Autolinker.matchParser.MatchParser({
        urls: true,
        emails: false,
        twitter: false,
        phone: false,
        hashtag: false
    });
    var result = [];
    function replaceFn(match) {
        var linkData = {};
        var matchText = match.getMatchedText();

        linkData.text = matchText;
        if (matchText.trim().indexOf('http') !== 0) {
            linkData.link = 'http://' + matchText;
        } else {
            linkData.link = matchText;
        }

        result.push(linkData);
    }
    urlMatcher.replace(text, replaceFn, this);
    return result;
}

export function extractLinks(text) {
    var repRegex = new RegExp('<br>', 'g');
    var matches = testUrlMatch(text.replace(repRegex, '\n'));

    if (!matches.length) {
        return {links: null, text: text};
    }

    var links = [];
    for (var i = 0; i < matches.length; i++) {
        links.push(matches[i].link);
    }

    return {links: links, text: text};
}

export function escapeRegExp(string) {
    return string.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1');
}

function handleYoutubeTime(link) {
    var timeRegex = /[\\?&]t=([0-9hms]+)/;

    var time = link.trim().match(timeRegex);
    if (!time || !time[1]) {
        return '';
    }

    var hours = time[1].match(/([0-9]+)h/);
    var minutes = time[1].match(/([0-9]+)m/);
    var seconds = time[1].match(/([0-9]+)s/);

    var ticks = 0;

    if (hours && hours[1]) {
        ticks += parseInt(hours[1], 10) * 3600;
    }

    if (minutes && minutes[1]) {
        ticks += parseInt(minutes[1], 10) * 60;
    }

    if (seconds && seconds[1]) {
        ticks += parseInt(seconds[1], 10);
    }

    return '&start=' + ticks.toString();
}

function getYoutubeEmbed(link) {
    var regex = /.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|watch\?(?:[a-zA-Z-_]+=[a-zA-Z0-9-_]+&)+v=)([^#\&\?]*).*/;

    var youtubeId = link.trim().match(regex)[1];
    var time = handleYoutubeTime(link);

    function onClick(e) {
        var div = $(e.target).closest('.video-thumbnail__container')[0];
        var iframe = document.createElement('iframe');
        iframe.setAttribute('src',
                            'https://www.youtube.com/embed/' +
                            div.id +
                            '?autoplay=1&autohide=1&border=0&wmode=opaque&fs=1&enablejsapi=1' +
                            time);
        iframe.setAttribute('width', '480px');
        iframe.setAttribute('height', '360px');
        iframe.setAttribute('type', 'text/html');
        iframe.setAttribute('frameborder', '0');
        iframe.setAttribute('allowfullscreen', 'allowfullscreen');

        div.parentNode.replaceChild(iframe, div);
    }

    function success(data) {
        if (!data.items.length || !data.items[0].snippet) {
            return;
        }
        var metadata = data.items[0].snippet;
        $('.video-type.' + youtubeId).html('Youtube - ');
        $('.video-uploader.' + youtubeId).html(metadata.channelTitle);
        $('.video-title.' + youtubeId).find('a').html(metadata.title);
        $('.post-list-holder-by-time').scrollTop($('.post-list-holder-by-time')[0].scrollHeight);
    }

    if (config.GoogleDeveloperKey) {
        $.ajax({
            async: true,
            url: 'https://www.googleapis.com/youtube/v3/videos',
            type: 'GET',
            data: {part: 'snippet', id: youtubeId, key: config.GoogleDeveloperKey},
            success: success
        });
    }

    return (
        <div className='post-comment'>
            <h4>
                <span className={'video-type ' + youtubeId}>YouTube</span>
                <span className={'video-title ' + youtubeId}><a href={link}></a></span>
            </h4>
            <h4 className={'video-uploader ' + youtubeId}></h4>
            <div
                className='video-div embed-responsive-item'
                id={youtubeId}
                onClick={onClick}
            >
                <div className='embed-responsive embed-responsive-4by3 video-div__placeholder'>
                    <div
                        id={youtubeId}
                        className='video-thumbnail__container'
                    >
                        <img
                            className='video-thumbnail'
                            src={'https://i.ytimg.com/vi/' + youtubeId + '/hqdefault.jpg'}
                        />
                        <div className='block'>
                            <span className='play-button'><span/></span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function getEmbed(link) {
    var ytRegex = /.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|watch\?(?:[a-zA-Z-_]+=[a-zA-Z0-9-_]+&)+v=)([^#\&\?]*).*/;

    var match = link.trim().match(ytRegex);
    if (match && match[1].length === 11) {
        return getYoutubeEmbed(link);
    }

    // Generl embed feature turned off for now
    return '';

    // NEEDS REFACTORING WHEN TURNED BACK ON
    /*
    var id = parseInt((Math.random() * 1000000) + 1);

    $.ajax({
        type: 'GET',
        url: 'https://query.yahooapis.com/v1/public/yql',
        data: {
            q: 'select * from html where url="' + link + "\" and xpath='html/head'",
            format: 'json'
        },
        async: true
    }).done(function(data) {
        if(!data.query.results) {
            return;
        }

        var headerData = data.query.results.head;

        var description = ''
        for(var i = 0; i < headerData.meta.length; i++) {
            if(headerData.meta[i].name && (headerData.meta[i].name === 'description' || headerData.meta[i].name === 'Description')){
                description = headerData.meta[i].content;
                break;
            }
        }

        $('.embed-title.'+id).html(headerData.title);
        $('.embed-description.'+id).html(description);
    })

    return (
        <div className='post-comment'>
            <div className={'web-embed-data'}>
                <p className={'embed-title ' + id} />
                <p className={'embed-description ' + id} />
                <p className={'embed-link ' + id}>{link}</p>
            </div>
        </div>
    );
    */
}

export function areStatesEqual(state1, state2) {
    return JSON.stringify(state1) === JSON.stringify(state2);
}

export function replaceHtmlEntities(text) {
    var tagsToReplace = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>'
    };
    var newtext = text;
    for (var tag in tagsToReplace) {
        if ({}.hasOwnProperty.call(tagsToReplace, tag)) {
            var regex = new RegExp(tag, 'g');
            newtext = newtext.replace(regex, tagsToReplace[tag]);
        }
    }
    return newtext;
}

export function insertHtmlEntities(text) {
    var tagsToReplace = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;'
    };
    var newtext = text;
    for (var tag in tagsToReplace) {
        if ({}.hasOwnProperty.call(tagsToReplace, tag)) {
            var regex = new RegExp(tag, 'g');
            newtext = newtext.replace(regex, tagsToReplace[tag]);
        }
    }
    return newtext;
}

export function searchForTerm(term) {
    AppDispatcher.handleServerAction({
        type: ActionTypes.RECIEVED_SEARCH_TERM,
        term: term,
        do_search: true
    });
}

var puncStartRegex = /^((?![@#])\W)+/g;
var puncEndRegex = /(\W)+$/g;

export function textToJsx(textin, options) {
    var text = textin;
    if (options && options.singleline) {
        var repRegex = new RegExp('\n', 'g'); //eslint-disable-line no-control-regex
        text = text.replace(repRegex, ' ');
    }

    var searchTerm = '';
    if (options && options.searchTerm) {
        searchTerm = options.searchTerm.toLowerCase();
    }

    var mentionClass = 'mention-highlight';
    if (options && options.noMentionHighlight) {
        mentionClass = '';
    }

    var inner = [];

    // Function specific regex
    var hashRegex = /^href="#[^']+"|(^#[A-Za-z]+[A-Za-z0-9_\-]*[A-Za-z0-9])$/g;

    var implicitKeywords = UserStore.getCurrentMentionKeys();

    var lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        var line = lines[i];
        var words = line.split(' ');
        var highlightSearchClass = '';
        for (let z = 0; z < words.length; z++) {
            var word = words[z];
            var trimWord = word.replace(puncStartRegex, '').replace(puncEndRegex, '').trim();
            var mentionRegex = /^(?:@)([a-z0-9_]+)$/gi; // looks loop invariant but a weird JS bug needs it to be redefined here
            var explicitMention = mentionRegex.exec(trimWord);

            if (searchTerm !== '') {
                let searchWords = searchTerm.split(' ');
                for (let idx in searchWords) {
                    if ({}.hasOwnProperty.call(searchWords, idx)) {
                        let searchWord = searchWords[idx];
                        if (searchWord === word.toLowerCase() || searchWord === trimWord.toLowerCase()) {
                            highlightSearchClass = ' search-highlight';
                            break;
                        } else if (searchWord.charAt(searchWord.length - 1) === '*') {
                            let searchWordPrefix = searchWord.slice(0, -1);
                            if (trimWord.toLowerCase().indexOf(searchWordPrefix) > -1 || word.toLowerCase().indexOf(searchWordPrefix) > -1) {
                                highlightSearchClass = ' search-highlight';
                                break;
                            }
                        }
                    }
                }
            }

            if (explicitMention &&
                (UserStore.getProfileByUsername(explicitMention[1]) ||
                 Constants.SPECIAL_MENTIONS.indexOf(explicitMention[1]) !== -1)) {
                let name = explicitMention[1];

                // do both a non-case sensitive and case senstive check
                let mClass = '';
                if (implicitKeywords.indexOf('@' + name.toLowerCase()) !== -1 || implicitKeywords.indexOf('@' + name) !== -1) {
                    mClass = mentionClass;
                }

                let suffix = word.match(puncEndRegex);
                let prefix = word.match(puncStartRegex);

                if (searchTerm === name) {
                    highlightSearchClass = ' search-highlight';
                }

                inner.push(
                    <span key={name + i + z + '_span'}>
                        {prefix}
                        <a
                            className={mClass + highlightSearchClass + ' mention-link'}
                            key={name + i + z + '_link'}
                            href='#'
                            onClick={() => searchForTerm(name)} //eslint-disable-line no-loop-func
                        >
                            @{name}
                        </a>
                        {suffix}
                        {' '}
                    </span>
                );
            } else if (testUrlMatch(word).length) {
                let match = testUrlMatch(word)[0];
                let link = match.link;

                let prefix = word.substring(0, word.indexOf(match.text));
                let suffix = word.substring(word.indexOf(match.text) + match.text.length);

                inner.push(
                    <span key={word + i + z + '_span'}>
                        {prefix}
                        <a
                            key={word + i + z + '_link'}
                            className={'theme' + highlightSearchClass}
                            target='_blank'
                            href={link}
                        >
                            {match.text}
                        </a>
                        {suffix}
                        {' '}
                    </span>
                );
            } else if (trimWord.match(hashRegex)) {
                let suffix = word.match(puncEndRegex);
                let prefix = word.match(puncStartRegex);
                let mClass = '';
                if (implicitKeywords.indexOf(trimWord) !== -1 || implicitKeywords.indexOf(trimWord.toLowerCase()) !== -1) {
                    mClass = mentionClass;
                }

                if (searchTerm === trimWord.substring(1).toLowerCase() || searchTerm === trimWord.toLowerCase()) {
                    highlightSearchClass = ' search-highlight';
                }

                inner.push(
                    <span key={word + i + z + '_span'}>
                        {prefix}
                        <a
                            key={word + i + z + '_hash'}
                            className={'theme ' + mClass + highlightSearchClass}
                            href='#'
                            onClick={searchForTerm.bind(this, trimWord)} //eslint-disable-line no-loop-func
                        >
                            {trimWord}
                        </a>
                        {suffix}
                        {' '}
                    </span>
                );
            } else if (implicitKeywords.indexOf(trimWord) !== -1 || implicitKeywords.indexOf(trimWord.toLowerCase()) !== -1) {
                let suffix = word.match(puncEndRegex);
                let prefix = word.match(puncStartRegex);

                if (trimWord.charAt(0) === '@') {
                    if (searchTerm === trimWord.substring(1).toLowerCase()) {
                        highlightSearchClass = ' search-highlight';
                    }
                    inner.push(
                        <span key={word + i + z + '_span'}>
                            {prefix}
                            <a
                                className={mentionClass + highlightSearchClass}
                                key={name + i + z + '_link'}
                                href='#'
                            >
                                {trimWord}
                            </a>
                            {suffix}
                            {' '}
                        </span>
                    );
                } else {
                    inner.push(
                        <span key={word + i + z + '_span'}>
                            {prefix}
                            <span className={mentionClass + highlightSearchClass}>
                                {replaceHtmlEntities(trimWord)}
                            </span>
                            {suffix}
                            {' '}
                        </span>
                    );
                }
            } else if (word === '') {

                // if word is empty dont include a span

            } else {
                inner.push(
                    <span key={word + i + z + '_span'}>
                        <span className={highlightSearchClass}>
                            {replaceHtmlEntities(word)}
                        </span>
                        {' '}
                    </span>
                );
            }
            highlightSearchClass = '';
        }
        if (i !== lines.length - 1) {
            inner.push(
                <br key={'br_' + i}/>
            );
        }
    }

    return inner;
}

export function getFileType(extin) {
    var ext = extin.toLowerCase();
    if (Constants.IMAGE_TYPES.indexOf(ext) > -1) {
        return 'image';
    }

    if (Constants.AUDIO_TYPES.indexOf(ext) > -1) {
        return 'audio';
    }

    if (Constants.VIDEO_TYPES.indexOf(ext) > -1) {
        return 'video';
    }

    if (Constants.SPREADSHEET_TYPES.indexOf(ext) > -1) {
        return 'spreadsheet';
    }

    if (Constants.CODE_TYPES.indexOf(ext) > -1) {
        return 'code';
    }

    if (Constants.WORD_TYPES.indexOf(ext) > -1) {
        return 'word';
    }

    if (Constants.PRESENTATION_TYPES.indexOf(ext) > -1) {
        return 'presentation';
    }

    if (Constants.PDF_TYPES.indexOf(ext) > -1) {
        return 'pdf';
    }

    if (Constants.PATCH_TYPES.indexOf(ext) > -1) {
        return 'patch';
    }

    return 'other';
}

export function getPreviewImagePathForFileType(fileTypeIn) {
    var fileType = fileTypeIn.toLowerCase();

    var icon;
    if (fileType in Constants.ICON_FROM_TYPE) {
        icon = Constants.ICON_FROM_TYPE[fileType];
    } else {
        icon = Constants.ICON_FROM_TYPE.other;
    }

    return '/static/images/icons/' + icon + '.png';
}

export function getIconClassName(fileTypeIn) {
    var fileType = fileTypeIn.toLowerCase();

    if (fileType in Constants.ICON_FROM_TYPE) {
        return Constants.ICON_FROM_TYPE[fileType];
    }

    return 'glyphicon-file';
}

export function splitFileLocation(fileLocation) {
    var fileSplit = fileLocation.split('.');

    var ext = '';
    if (fileSplit.length > 1) {
        ext = fileSplit[fileSplit.length - 1];
        fileSplit.splice(fileSplit.length - 1, 1);
    }

    var filePath = fileSplit.join('.');
    var filename = filePath.split('/')[filePath.split('/').length - 1];

    return {ext: ext, name: filename, path: filePath};
}

export function toTitleCase(str) {
    function doTitleCase(txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    }
    return str.replace(/\w\S*/g, doTitleCase);
}

export function changeCss(className, classValue) {
    // we need invisible container to store additional css definitions
    var cssMainContainer = $('#css-modifier-container');
    if (cssMainContainer.length === 0) {
        cssMainContainer = $('<div id="css-modifier-container"></div>');
        cssMainContainer.hide();
        cssMainContainer.appendTo($('body'));
    }

    // and we need one div for each class
    var classContainer = cssMainContainer.find('div[data-class="' + className + '"]');
    if (classContainer.length === 0) {
        classContainer = $('<div data-class="' + className + '"></div>');
        classContainer.appendTo(cssMainContainer);
    }

    // append additional style
    classContainer.html('<style>' + className + ' {' + classValue + '}</style>');
}

export function rgb2hex(rgbIn) {
    if (/^#[0-9A-F]{6}$/i.test(rgbIn)) {
        return rgbIn;
    }

    var rgb = rgbIn.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    function hex(x) {
        return ('0' + parseInt(x, 10).toString(16)).slice(-2);
    }
    return '#' + hex(rgb[1]) + hex(rgb[2]) + hex(rgb[3]);
}

export function placeCaretAtEnd(el) {
    el.focus();
    if (typeof window.getSelection != 'undefined' && typeof document.createRange != 'undefined') {
        var range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    } else if (typeof document.body.createTextRange != 'undefined') {
        var textRange = document.body.createTextRange();
        textRange.moveToElementText(el);
        textRange.collapse(false);
        textRange.select();
    }
}

export function getCaretPosition(el) {
    if (el.selectionStart) {
        return el.selectionStart;
    } else if (document.selection) {
        el.focus();

        var r = document.selection.createRange();
        if (r == null) {
            return 0;
        }

        var re = el.createTextRange();
        var rc = re.duplicate();
        re.moveToBookmark(r.getBookmark());
        rc.setEndPoint('EndToStart', re);

        return rc.text.length;
    }
    return 0;
}

export function setSelectionRange(input, selectionStart, selectionEnd) {
    if (input.setSelectionRange) {
        input.focus();
        input.setSelectionRange(selectionStart, selectionEnd);
    } else if (input.createTextRange) {
        var range = input.createTextRange();
        range.collapse(true);
        range.moveEnd('character', selectionEnd);
        range.moveStart('character', selectionStart);
        range.select();
    }
}

export function setCaretPosition(input, pos) {
    setSelectionRange(input, pos, pos);
}

export function getSelectedText(input) {
    var selectedText;
    if (typeof document.selection !== 'undefined') {
        input.focus();
        var sel = document.selection.createRange();
        selectedText = sel.text;
    } else if (typeof input.selectionStart !== 'undefined') {
        var startPos = input.selectionStart;
        var endPos = input.selectionEnd;
        selectedText = input.value.substring(startPos, endPos);
    }

    return selectedText;
}

export function isValidUsername(name) {
    var error = '';
    if (!name) {
        error = 'This field is required';
    } else if (name.length < 3 || name.length > 15) {
        error = 'Must be between 3 and 15 characters';
    } else if (!(/^[a-z0-9\.\-\_]+$/).test(name)) {
        error = "Must contain only lowercase letters, numbers, and the symbols '.', '-', and '_'.";
    } else if (!(/[a-z]/).test(name.charAt(0))) {
        error = 'First character must be a letter.';
    } else {
        var lowerName = name.toLowerCase().trim();

        for (var i = 0; i < Constants.RESERVED_USERNAMES.length; i++) {
            if (lowerName === Constants.RESERVED_USERNAMES[i]) {
                error = 'Cannot use a reserved word as a username.';
                break;
            }
        }
    }

    return error;
}

export function updateTabTitle(name) {
    document.title = name + ' ' + document.title.substring(document.title.lastIndexOf('-'));
}

export function updateAddressBar(channelName) {
    var teamURL = window.location.href.split('/channels')[0];
    history.replaceState('data', '', teamURL + '/channels/' + channelName);
}

export function switchChannel(channel, teammateName) {
    AppDispatcher.handleViewAction({
        type: ActionTypes.CLICK_CHANNEL,
        name: channel.name,
        id: channel.id
    });

    updateAddressBar(channel.name);

    if (channel.type === 'D' && teammateName) {
        updateTabTitle(teammateName);
    } else {
        updateTabTitle(channel.display_name);
    }

    AsyncClient.getChannels(true, true, true);
    AsyncClient.getChannelExtraInfo(true);
    AsyncClient.getPosts(channel.id);

    $('.inner__wrap').removeClass('move--right');
    $('.sidebar--left').removeClass('move--right');

    client.trackPage();

    return false;
}

export function isMobile() {
    return screen.width <= 768;
}

export function isComment(post) {
    if ('root_id' in post) {
        return post.root_id !== '';
    }
    return false;
}

export function getDirectTeammate(channelId) {
    var userIds = ChannelStore.get(channelId).name.split('__');
    var curUserId = UserStore.getCurrentId();
    var teammate = {};

    if (userIds.length !== 2 || userIds.indexOf(curUserId) === -1) {
        return teammate;
    }

    for (var idx in userIds) {
        if (userIds[idx] !== curUserId) {
            teammate = UserStore.getProfile(userIds[idx]);
            break;
        }
    }

    return teammate;
}

Image.prototype.load = function imageLoad(url, progressCallback) {
    var self = this;
    var xmlHTTP = new XMLHttpRequest();
    xmlHTTP.open('GET', url, true);
    xmlHTTP.responseType = 'arraybuffer';
    xmlHTTP.onload = function onLoad() {
        var h = xmlHTTP.getAllResponseHeaders();
        var m = h.match(/^Content-Type\:\s*(.*?)$/mi);
        var mimeType = m[1] || 'image/png';

        var blob = new Blob([this.response], {type: mimeType});
        self.src = window.URL.createObjectURL(blob);
    };
    xmlHTTP.onprogress = function onprogress(e) {
        parseInt(self.completedPercentage = (e.loaded / e.total) * 100, 10);
        if (progressCallback) {
            progressCallback();
        }
    };
    xmlHTTP.onloadstart = function onloadstart() {
        self.completedPercentage = 0;
    };
    xmlHTTP.send();
};

Image.prototype.completedPercentage = 0;

export function changeColor(colourIn, amt) {
    var usePound = false;
    var col = colourIn;

    if (col[0] === '#') {
        col = col.slice(1);
        usePound = true;
    }

    var num = parseInt(col, 16);

    var r = (num >> 16) + amt;

    if (r > 255) {
        r = 255;
    } else if (r < 0) {
        r = 0;
    }

    var b = ((num >> 8) & 0x00FF) + amt;

    if (b > 255) {
        b = 255;
    } else if (b < 0) {
        b = 0;
    }

    var g = (num & 0x0000FF) + amt;

    if (g > 255) {
        g = 255;
    } else if (g < 0) {
        g = 0;
    }

    var pound = '#';
    if (!usePound) {
        pound = '';
    }

    return pound + String('000000' + (g | (b << 8) | (r << 16)).toString(16)).slice(-6);
}

export function changeOpacity(oldColor, opacity) {
    var col = oldColor;
    if (col[0] === '#') {
        col = col.slice(1);
    }

    var r = parseInt(col.substring(0, 2), 16);
    var g = parseInt(col.substring(2, 4), 16);
    var b = parseInt(col.substring(4, 6), 16);

    return 'rgba(' + r + ',' + g + ',' + b + ',' + opacity + ')';
}

export function getFullName(user) {
    if (user.first_name && user.last_name) {
        return user.first_name + ' ' + user.last_name;
    } else if (user.first_name) {
        return user.first_name;
    } else if (user.last_name) {
        return user.last_name;
    }

    return '';
}

export function getDisplayName(user) {
    if (user.nickname && user.nickname.trim().length > 0) {
        return user.nickname;
    }
    var fullName = getFullName(user);

    if (fullName) {
        return fullName;
    }

    return user.username;
}

//IE10 does not set window.location.origin automatically so this must be called instead when using it
export function getWindowLocationOrigin() {
    var windowLocationOrigin = window.location.origin;
    if (!windowLocationOrigin) {
        windowLocationOrigin = window.location.protocol + '//' + window.location.hostname;
        if (window.location.port) {
            windowLocationOrigin += ':' + window.location.port;
        }
    }
    return windowLocationOrigin;
}

// Converts a file size in bytes into a human-readable string of the form '123MB'.
export function fileSizeToString(bytes) {
    // it's unlikely that we'll have files bigger than this
    if (bytes > 1024 * 1024 * 1024 * 1024) {
        return Math.floor(bytes / (1024 * 1024 * 1024 * 1024)) + 'TB';
    } else if (bytes > 1024 * 1024 * 1024) {
        return Math.floor(bytes / (1024 * 1024 * 1024)) + 'GB';
    } else if (bytes > 1024 * 1024) {
        return Math.floor(bytes / (1024 * 1024)) + 'MB';
    } else if (bytes > 1024) {
        return Math.floor(bytes / 1024) + 'KB';
    }

    return bytes + 'B';
}

// Converts a filename (like those attached to Post objects) to a url that can be used to retrieve attachments from the server.
export function getFileUrl(filename) {
    var url = filename;

    // This is a temporary patch to fix issue with old files using absolute paths
    if (url.indexOf('/api/v1/files/get') !== -1) {
        url = filename.split('/api/v1/files/get')[1];
    }
    url = getWindowLocationOrigin() + '/api/v1/files/get' + url;

    return url;
}

// Gets the name of a file (including extension) from a given url or file path.
export function getFileName(path) {
    var split = path.split('/');
    return split[split.length - 1];
}

// Generates a RFC-4122 version 4 compliant globally unique identifier.
export function generateId() {
    // implementation taken from http://stackoverflow.com/a/2117523
    var id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';

    id = id.replace(/[xy]/g, function replaceRandom(c) {
        var r = Math.floor(Math.random() * 16);

        var v;
        if (c === 'x') {
            v = r;
        } else {
            v = r & 0x3 | 0x8;
        }

        return v.toString(16);
    });

    return id;
}

export function isBrowserFirefox() {
    return navigator && navigator.userAgent && navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
}

// Checks if browser is IE10 or IE11
export function isBrowserIE() {
    if (window.navigator && window.navigator.userAgent) {
        var ua = window.navigator.userAgent;

        return ua.indexOf('Trident/7.0') > 0 || ua.indexOf('Trident/6.0') > 0;
    }

    return false;
}

export function isBrowserEdge() {
    return window.naviagtor && navigator.userAgent && navigator.userAgent.toLowerCase().indexOf('edge') > -1;
}

// Used to get the id of the other user from a DM channel
export function getUserIdFromChannelName(channel) {
    var ids = channel.name.split('__');
    var otherUserId = '';
    if (ids[0] === UserStore.getCurrentId()) {
        otherUserId = ids[1];
    } else {
        otherUserId = ids[0];
    }

    return otherUserId;
}

export function importSlack(file, success, error) {
    var formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('filesize', file.size);
    formData.append('importFrom', 'slack');

    client.importSlack(formData, success, error);
}

export function getTeamURLFromAddressBar() {
    return window.location.href.split('/channels')[0];
}

export function getShortenedTeamURL() {
    const teamURL = getTeamURLFromAddressBar();
    if (teamURL.length > 24) {
        return teamURL.substring(0, 10) + '...' + teamURL.substring(teamURL.length - 12, teamURL.length - 1) + '/';
    }
}
