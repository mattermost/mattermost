// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import ChannelStore from 'stores/channel_store.jsx';
import UserStore from 'stores/user_store.jsx';
import LocalizationStore from 'stores/localization_store.jsx';
import PreferenceStore from 'stores/preference_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import Constants from 'utils/constants.jsx';
var ActionTypes = Constants.ActionTypes;
import * as AsyncClient from './async_client.jsx';
import Client from './web_client.jsx';

import React from 'react';
import {browserHistory} from 'react-router';
import {FormattedTime} from 'react-intl';

import icon50 from 'images/icon50x50.png';
import bing from 'images/bing.mp3';

export function isEmail(email) {
    // writing a regex to match all valid email addresses is really, really hard (see http://stackoverflow.com/a/201378)
    // so we just do a simple check and rely on a verification email to tell if it's a real address
    return (/^.+@.+$/).test(email);
}

export function cleanUpUrlable(input) {
    var cleaned = input.trim().replace(/-/g, ' ').replace(/[^\w\s]/gi, '').toLowerCase().replace(/\s/g, '-');
    cleaned = cleaned.replace(/-{2,}/, '-');
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

export function isChrome() {
    if (navigator.userAgent.indexOf('Chrome') > -1) {
        return true;
    }
    return false;
}

export function isSafari() {
    if (navigator.userAgent.indexOf('Safari') !== -1 && navigator.userAgent.indexOf('Chrome') === -1) {
        return true;
    }
    return false;
}

export function isIosChrome() {
    // https://developer.chrome.com/multidevice/user-agent
    return navigator.userAgent.indexOf('CriOS') !== -1;
}

export function isMobileApp() {
    const userAgent = navigator.userAgent;

    // the mobile app has different user agents for the native api calls and the shim, so handle them both
    const isApi = userAgent.indexOf('Mattermost') !== -1;
    const isShim = userAgent.indexOf('iPhone') !== -1 && userAgent.indexOf('Safari') === -1 && userAgent.indexOf('Chrome') === -1;

    return isApi || isShim;
}

export function isInRole(roles, inRole) {
    var parts = roles.split(' ');
    for (var i = 0; i < parts.length; i++) {
        if (parts[i] === inRole) {
            return true;
        }
    }

    return false;
}

export function isAdmin(roles) {
    if (isInRole(roles, 'admin')) {
        return true;
    }

    if (isInRole(roles, 'system_admin')) {
        return true;
    }

    return false;
}

export function isSystemAdmin(roles) {
    if (isInRole(roles, 'system_admin')) {
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
    return '';
}

var requestedNotificationPermission = false;

export function notifyMe(title, body, channel) {
    if (!('Notification' in window)) {
        return;
    }

    if (Notification.permission === 'granted' || (Notification.permission === 'default' && !requestedNotificationPermission)) {
        requestedNotificationPermission = true;

        Notification.requestPermission((permission) => {
            if (permission === 'granted') {
                try {
                    var notification = new Notification(title, {body: body, tag: body, icon: icon50});
                    notification.onclick = () => {
                        window.focus();
                        if (channel) {
                            browserHistory.push(getTeamURLNoOriginFromAddressBar() + '/channels/' + channel.name);
                        } else {
                            browserHistory.push(TeamStore.getCurrentTeamUrl() + '/channels/town-square');
                        }
                    };
                    setTimeout(() => {
                        notification.close();
                    }, 5000);
                } catch (e) {
                    console.error(e); //eslint-disable-line no-console
                }
            }
        });
    }
}

var canDing = true;

export function ding() {
    if (!isBrowserFirefox() && canDing) {
        var audio = new Audio(bing);
        audio.play();
        canDing = false;
        setTimeout(() => {
            canDing = true;
            return;
        }, 3000);
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

export function displayTime(ticks, utc) {
    const d = new Date(ticks);
    let hours;
    let minutes;
    let ampm = '';
    let timezone = '';

    if (utc) {
        hours = d.getUTCHours();
        minutes = d.getUTCMinutes();
        timezone = ' UTC';
    } else {
        hours = d.getHours();
        minutes = d.getMinutes();
    }

    if (minutes <= 9) {
        minutes = '0' + minutes;
    }

    const useMilitaryTime = PreferenceStore.getBool(Constants.Preferences.CATEGORY_DISPLAY_SETTINGS, 'use_military_time');
    if (!useMilitaryTime) {
        ampm = ' AM';
        if (hours >= 12) {
            ampm = ' PM';
        }

        hours = hours % 12;
        if (!hours) {
            hours = '12';
        }
    }

    return hours + ':' + minutes + ampm + timezone;
}

export function displayTimeFormatted(ticks) {
    const useMilitaryTime = PreferenceStore.getBool(Constants.Preferences.CATEGORY_DISPLAY_SETTINGS, 'use_military_time');

    return (
        <FormattedTime
            value={ticks}
            hour='numeric'
            minute='numeric'
            hour12={!useMilitaryTime}
        />
    );
}

export function isMilitaryTime() {
    return PreferenceStore.getBool(Constants.Preferences.CATEGORY_DISPLAY_SETTINGS, 'use_military_time');
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
    if (interval >= 2) {
        return interval + ' minutes ago';
    }

    if (interval >= 1) {
        return '1 minute ago';
    }

    return 'just now';
}

export function displayCommentDateTime(ticks) {
    return displayDate(ticks) + ' ' + displayTime(ticks);
}

// returns Unix timestamp in milliseconds
export function getTimestamp() {
    return Date.now();
}

// extracts links not styled by Markdown
export function extractFirstLink(text) {
    const pattern = /(^|[\s\n]|<br\/?>)((?:https?|ftp):\/\/[\-A-Z0-9+\u0026\u2019@#\/%?=()~_|!:,.;]*[\-A-Z0-9+\u0026@#\/%=~()_|])/i;
    let inText = text;

    // strip out code blocks
    inText = inText.replace(/`[^`]*`/g, '');

    // strip out inline markdown images
    inText = inText.replace(/!\[[^\]]*\]\([^\)]*\)/g, '');

    const match = pattern.exec(inText);
    if (match) {
        return match[0].trim();
    }

    return '';
}

export function escapeRegExp(string) {
    return string.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1');
}

// Taken from http://stackoverflow.com/questions/1068834/object-comparison-in-javascript and modified slightly
export function areObjectsEqual(x, y) {
    let p;
    const leftChain = [];
    const rightChain = [];

    // Remember that NaN === NaN returns false
    // and isNaN(undefined) returns true
    if (isNaN(x) && isNaN(y) && typeof x === 'number' && typeof y === 'number') {
        return true;
    }

    // Compare primitives and functions.
    // Check if both arguments link to the same object.
    // Especially useful on step when comparing prototypes
    if (x === y) {
        return true;
    }

    // Works in case when functions are created in constructor.
    // Comparing dates is a common scenario. Another built-ins?
    // We can even handle functions passed across iframes
    if ((typeof x === 'function' && typeof y === 'function') ||
       (x instanceof Date && y instanceof Date) ||
       (x instanceof RegExp && y instanceof RegExp) ||
       (x instanceof String && y instanceof String) ||
       (x instanceof Number && y instanceof Number)) {
        return x.toString() === y.toString();
    }

    if (x instanceof Map && y instanceof Map) {
        return areMapsEqual(x, y);
    }

    // At last checking prototypes as good a we can
    if (!(x instanceof Object && y instanceof Object)) {
        return false;
    }

    if (x.isPrototypeOf(y) || y.isPrototypeOf(x)) {
        return false;
    }

    if (x.constructor !== y.constructor) {
        return false;
    }

    if (x.prototype !== y.prototype) {
        return false;
    }

    // Check for infinitive linking loops
    if (leftChain.indexOf(x) > -1 || rightChain.indexOf(y) > -1) {
        return false;
    }

    // Quick checking of one object beeing a subset of another.
    for (p in y) {
        if (y.hasOwnProperty(p) !== x.hasOwnProperty(p)) {
            return false;
        } else if (typeof y[p] !== typeof x[p]) {
            return false;
        }
    }

    for (p in x) {
        if (y.hasOwnProperty(p) !== x.hasOwnProperty(p)) {
            return false;
        } else if (typeof y[p] !== typeof x[p]) {
            return false;
        }

        switch (typeof (x[p])) {
        case 'object':
        case 'function':

            leftChain.push(x);
            rightChain.push(y);

            if (!areObjectsEqual(x[p], y[p])) {
                return false;
            }

            leftChain.pop();
            rightChain.pop();
            break;

        default:
            if (x[p] !== y[p]) {
                return false;
            }
            break;
        }
    }

    return true;
}

export function areMapsEqual(a, b) {
    if (a.size !== b.size) {
        return false;
    }

    for (const [key, value] of a) {
        if (!b.has(key)) {
            return false;
        }

        if (!areObjectsEqual(value, b.get(key))) {
            return false;
        }
    }

    return true;
}

export function replaceHtmlEntities(text) {
    var tagsToReplace = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>'
    };
    var newtext = text;
    for (var tag in tagsToReplace) {
        if (Reflect.apply({}.hasOwnProperty, this, [tagsToReplace, tag])) {
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
        if (Reflect.apply({}.hasOwnProperty, this, [tagsToReplace, tag])) {
            var regex = new RegExp(tag, 'g');
            newtext = newtext.replace(regex, tagsToReplace[tag]);
        }
    }
    return newtext;
}

export function searchForTerm(term) {
    AppDispatcher.handleServerAction({
        type: ActionTypes.RECEIVED_SEARCH_TERM,
        term: term,
        do_search: true
    });
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

    return icon;
}

export function getIconClassName(fileTypeIn) {
    var fileType = fileTypeIn.toLowerCase();

    if (fileType in Constants.ICON_NAME_FROM_TYPE) {
        return Constants.ICON_NAME_FROM_TYPE[fileType];
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

export function getPreviewImagePath(filename) {
    // Returns the path to a preview image that can be used to represent a file.
    const fileInfo = splitFileLocation(filename);
    const fileType = getFileType(fileInfo.ext);

    if (fileType === 'image') {
        return getFileUrl(fileInfo.path + '_preview.jpg');
    }

    // only images have proper previews, so just use a placeholder icon for non-images
    return getPreviewImagePathForFileType(fileType);
}

export function toTitleCase(str) {
    function doTitleCase(txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    }
    return str.replace(/\w\S*/g, doTitleCase);
}

export function applyTheme(theme) {
    if (theme.sidebarBg) {
        changeCss('.app__body .sidebar--left, .app__body .sidebar--left .sidebar__divider .sidebar__divider__text, .app__body .modal .settings-modal .settings-table .settings-links, .app__body .sidebar--menu', 'background:' + theme.sidebarBg, 1);
        changeCss('body.app__body', 'scrollbar-face-color:' + theme.sidebarBg, 3);
    }

    if (theme.sidebarText) {
        changeCss('.app__body .sidebar--left .nav-pills__container li>a, .app__body .sidebar--right, .app__body .modal .settings-modal .nav-pills>li a, .app__body .sidebar--menu', 'color:' + changeOpacity(theme.sidebarText, 0.6), 1);
        changeCss('@media(max-width: 768px){.app__body .modal .settings-modal .settings-table .nav>li>a', 'color:' + theme.sidebarText, 1);
        changeCss('.app__body .sidebar--left .nav-pills__container li>h4, .app__body .sidebar--left .add-channel-btn', 'color:' + changeOpacity(theme.sidebarText, 0.6), 1);
        changeCss('.app__body .sidebar--left .add-channel-btn:hover, .app__body .sidebar--left .add-channel-btn:focus', 'color:' + theme.sidebarText, 1);
        changeCss('.app__body .sidebar--left .status .offline--icon, .app__body .sidebar--left .status .offline--icon', 'fill:' + theme.sidebarText, 1);
        changeCss('@media(max-width: 768px){.app__body .modal .settings-modal .settings-table .nav>li>a', 'border-color:' + changeOpacity(theme.sidebarText, 0.2), 2);
    }

    if (theme.sidebarUnreadText) {
        changeCss('.app__body .sidebar--left .nav-pills__container li>a.unread-title', 'color:' + theme.sidebarUnreadText + '!important;', 2);
    }

    if (theme.sidebarTextHoverBg) {
        changeCss('.app__body .sidebar--left .nav-pills__container li>a:hover, .app__body .sidebar--left .nav-pills__container li>a:focus, .app__body .modal .settings-modal .nav-pills>li:hover a, .app__body .modal .settings-modal .nav-pills>li:focus a', 'background:' + theme.sidebarTextHoverBg, 1);
        changeCss('@media(max-width: 768px){.app__body .modal .settings-modal .settings-table .nav>li:hover a', 'background:' + theme.sidebarTextHoverBg, 1);
    }

    if (theme.sidebarTextActiveBorder) {
        changeCss('.app__body .sidebar--left .nav li.active a:before, .app__body .modal .settings-modal .nav-pills>li.active a:before', 'background:' + theme.sidebarTextActiveBorder, 1);
        changeCss('.app__body .sidebar--left .sidebar__divider:before', 'background:' + changeOpacity(theme.sidebarTextActiveBorder, 0.5), 1);
        changeCss('.app__body .sidebar--left .sidebar__divider', 'color:' + theme.sidebarTextActiveBorder, 1);
    }

    if (theme.sidebarTextActiveColor) {
        changeCss('.app__body .sidebar--left .nav-pills__container li.active a, .app__body .sidebar--left .nav-pills__container li.active a:hover, .app__body .sidebar--left .nav-pills__container li.active a:focus, .app__body .modal .settings-modal .nav-pills>li.active a, .app__body .modal .settings-modal .nav-pills>li.active a:hover, .app__body .modal .settings-modal .nav-pills>li.active a:active', 'color:' + theme.sidebarTextActiveColor, 2);
        changeCss('.app__body .sidebar--left .nav li.active a, .app__body .sidebar--left .nav li.active a:hover, .app__body .sidebar--left .nav li.active a:focus', 'background:' + changeOpacity(theme.sidebarTextActiveColor, 0.1), 1);
    }

    if (theme.sidebarHeaderBg) {
        changeCss('.app__body .sidebar--left .team__header, .app__body .sidebar--menu .team__header, .app__body .post-list__timestamp > div', 'background:' + theme.sidebarHeaderBg, 1);
        changeCss('.app__body .modal .modal-header', 'background:' + theme.sidebarHeaderBg, 1);
        changeCss('.app__body #navbar .navbar-default', 'background:' + theme.sidebarHeaderBg, 1);
        changeCss('@media(max-width: 768px){.app__body .search-bar__container', 'background:' + theme.sidebarHeaderBg, 1);
        changeCss('.app__body .attachment .attachment__container', 'border-left-color:' + theme.sidebarHeaderBg, 1);
    }

    if (theme.sidebarHeaderTextColor) {
        changeCss('.app__body .sidebar--left .team__header .header__info, .app__body .sidebar--menu .team__header .header__info, .app__body .post-list__timestamp > div', 'color:' + theme.sidebarHeaderTextColor, 1);
        changeCss('.app__body .sidebar--left .team__header .navbar-right .dropdown__icon, .app__body .sidebar--menu .team__header .navbar-right .dropdown__icon', 'fill:' + theme.sidebarHeaderTextColor, 1);
        changeCss('.app__body .sidebar--left .team__header .user__name, .app__body .sidebar--menu .team__header .user__name', 'color:' + changeOpacity(theme.sidebarHeaderTextColor, 0.8), 1);
        changeCss('.app__body .sidebar--left .team__header:hover .user__name, .app__body .sidebar--menu .team__header:hover .user__name', 'color:' + theme.sidebarHeaderTextColor, 1);
        changeCss('.app__body .modal .modal-header .modal-title, .app__body .modal .modal-header .modal-title .name, .app__body .modal .modal-header button.close', 'color:' + theme.sidebarHeaderTextColor, 1);
        changeCss('.app__body #navbar .navbar-default .navbar-brand .heading', 'color:' + theme.sidebarHeaderTextColor, 1);
        changeCss('.app__body #navbar .navbar-default .navbar-toggle .icon-bar, ', 'background:' + theme.sidebarHeaderTextColor, 1);
        changeCss('@media(max-width: 768px){.app__body .search-bar__container', 'color:' + theme.sidebarHeaderTextColor, 2);
    }

    if (theme.onlineIndicator) {
        changeCss('.app__body .sidebar--left .status .online--icon', 'fill:' + theme.onlineIndicator, 1);
    }

    if (theme.awayIndicator) {
        changeCss('.app__body .sidebar--left .status .away--icon', 'fill:' + theme.awayIndicator, 1);
    }

    if (theme.mentionBj) {
        changeCss('.app__body .sidebar--left .nav-pills__unread-indicator', 'background:' + theme.mentionBj, 1);
        changeCss('.app__body .sidebar--left .badge', 'background:' + theme.mentionBj + '!important;', 1);
    }

    if (theme.mentionColor) {
        changeCss('.app__body .sidebar--left .nav-pills__unread-indicator', 'color:' + theme.mentionColor, 2);
        changeCss('.app__body .sidebar--left .badge', 'color:' + theme.mentionColor + '!important;', 2);
    }

    if (theme.centerChannelBg) {
        changeCss('.app__body .app__content, .app__body .markdown__table, .app__body .markdown__table tbody tr, .app__body .suggestion-list__content, .app__body .modal .modal-content', 'background:' + theme.centerChannelBg, 1);
        changeCss('#post-list .post-list-holder-by-time', 'background:' + theme.centerChannelBg, 1);
        changeCss('#post-create', 'background:' + theme.centerChannelBg, 1);
        changeCss('.app__body .date-separator .separator__text, .app__body .new-separator .separator__text', 'background:' + theme.centerChannelBg, 1);
        changeCss('.app__body .post-image__details, .app__body .search-help-popover .search-autocomplete__divider span', 'background:' + theme.centerChannelBg, 1);
        changeCss('.app__body .sidebar--right, .app__body .dropdown-menu, .app__body .popover, .app__body .tip-overlay', 'background:' + theme.centerChannelBg, 1);
        changeCss('.app__body .popover.bottom>.arrow:after', 'border-bottom-color:' + theme.centerChannelBg, 1);
        changeCss('.app__body .popover.right>.arrow:after, .app__body .tip-overlay.tip-overlay--sidebar .arrow, .app__body .tip-overlay.tip-overlay--header .arrow', 'border-right-color:' + theme.centerChannelBg, 1);
        changeCss('.app__body .popover.left>.arrow:after', 'border-left-color:' + theme.centerChannelBg, 1);
        changeCss('.app__body .popover.top>.arrow:after, .app__body .tip-overlay.tip-overlay--chat .arrow', 'border-top-color:' + theme.centerChannelBg, 1);
        changeCss('@media(min-width: 768px){.app__body .search-bar__container .search__form .search-bar, .app__body .form-control', 'background:' + theme.centerChannelBg, 1);
        changeCss('.app__body .attachment__content', 'background:' + theme.centerChannelBg, 1);
        changeCss('body.app__body', 'scrollbar-face-color:' + theme.centerChannelBg, 2);
        changeCss('body.app__body', 'scrollbar-track-color:' + theme.centerChannelBg, 2);
        changeCss('.app__body .post-list__new-messages-below', 'color:' + theme.centerChannelBg, 1);
    }

    if (theme.centerChannelColor) {
        changeCss('.app__body .post-list__arrows', 'fill:' + changeOpacity(theme.centerChannelColor, 0.3), 1);
        changeCss('.app__body .sidebar--left, .app__body .sidebar--right .sidebar--right__header, .app__body .suggestion-list__content .command', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.2), 1);
        changeCss('.app__body .app__content, .app__body .post-create__container .post-create-body .btn-file, .app__body .post-create__container .post-create-footer .msg-typing, .app__body .suggestion-list__content .command, .app__body .modal .modal-content, .app__body .dropdown-menu, .app__body .popover, .app__body .mentions__name, .app__body .tip-overlay', 'color:' + theme.centerChannelColor, 1);
        changeCss('.app__body #archive-link-home', 'background:' + changeOpacity(theme.centerChannelColor, 0.15), 1);
        changeCss('.app__body #post-create', 'color:' + theme.centerChannelColor, 2);
        changeCss('.app__body .mentions--top, .app__body .suggestion-list', 'box-shadow:' + changeOpacity(theme.centerChannelColor, 0.2) + ' 1px -3px 12px', 3);
        changeCss('.app__body .mentions--top, .app__body .suggestion-list', '-webkit-box-shadow:' + changeOpacity(theme.centerChannelColor, 0.2) + ' 1px -3px 12px', 2);
        changeCss('.app__body .mentions--top, .app__body .suggestion-list', '-moz-box-shadow:' + changeOpacity(theme.centerChannelColor, 0.2) + ' 1px -3px 12px', 1);
        changeCss('.app__body .dropdown-menu, .app__body .popover ', 'box-shadow:' + changeOpacity(theme.centerChannelColor, 0.1) + ' 0px 6px 12px', 3);
        changeCss('.app__body .dropdown-menu, .app__body .popover ', '-webkit-box-shadow:' + changeOpacity(theme.centerChannelColor, 0.1) + ' 0px 6px 12px', 2);
        changeCss('.app__body .dropdown-menu, .app__body .popover ', '-moz-box-shadow:' + changeOpacity(theme.centerChannelColor, 0.1) + ' 0px 6px 12px', 1);
        changeCss('.app__body .post__body hr, .app__body .loading-screen .loading__content .round, .app__body .tutorial__circles .circle', 'background:' + theme.centerChannelColor, 1);
        changeCss('.app__body .channel-header .heading', 'color:' + theme.centerChannelColor, 1);
        changeCss('.app__body .markdown__table tbody tr:nth-child(2n)', 'background:' + changeOpacity(theme.centerChannelColor, 0.07), 1);
        changeCss('.app__body .channel-header__info>div.dropdown .header-dropdown__icon', 'color:' + changeOpacity(theme.centerChannelColor, 0.8), 1);
        changeCss('.app__body .channel-header #member_popover', 'color:' + changeOpacity(theme.centerChannelColor, 0.8), 1);
        changeCss('.app__body .custom-textarea, .app__body .custom-textarea:focus, .app__body .file-preview, .app__body .post-image__details, .app__body .sidebar--right .sidebar-right__body, .app__body .markdown__table th, .app__body .markdown__table td, .app__body .suggestion-list__content, .app__body .modal .modal-content, .app__body .modal .settings-modal .settings-table .settings-content .divider-light, .app__body .webhooks__container, .app__body .dropdown-menu, .app__body .modal .modal-header, .app__body .popover', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.2), 1);
        changeCss('.app__body .popover.bottom>.arrow', 'border-bottom-color:' + changeOpacity(theme.centerChannelColor, 0.25), 1);
        changeCss('.app__body .search-help-popover .search-autocomplete__divider span', 'color:' + changeOpacity(theme.centerChannelColor, 0.7), 1);
        changeCss('.app__body .popover.right>.arrow', 'border-right-color:' + changeOpacity(theme.centerChannelColor, 0.25), 1);
        changeCss('.app__body .popover.left>.arrow', 'border-left-color:' + changeOpacity(theme.centerChannelColor, 0.25), 1);
        changeCss('.app__body .popover.top>.arrow', 'border-top-color:' + changeOpacity(theme.centerChannelColor, 0.25), 1);
        changeCss('.app__body .suggestion-list__content .command, .app__body .popover .popover-title', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.2), 1);
        changeCss('.app__body .dropdown-menu .divider, .app__body .search-help-popover .search-autocomplete__divider:before', 'background:' + theme.centerChannelColor, 1);
        changeCss('.app__body .custom-textarea', 'color:' + theme.centerChannelColor, 1);
        changeCss('.app__body .post-image__column', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.2), 2);
        changeCss('.app__body .post-image__details', 'color:' + theme.centerChannelColor, 2);
        changeCss('.app__body .post-image__column a, .app__body .post-image__column a:hover, .app__body .post-image__column a:focus', 'color:' + theme.centerChannelColor, 1);
        changeCss('@media(min-width: 768px){.app__body .search-bar__container .search__form .search-bar, .app__body .form-control', 'color:' + theme.centerChannelColor, 2);
        changeCss('.app__body .input-group-addon, .app__body .search-bar__container .search__form, .app__body .form-control', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.2), 1);
        changeCss('.app__body .form-control:focus', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.3), 1);
        changeCss('.app__body .attachment .attachment__content', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.3), 1);
        changeCss('.app__body .channel-intro .channel-intro__content, .app__body .webhooks__container', 'background:' + changeOpacity(theme.centerChannelColor, 0.05), 1);
        changeCss('.app__body .date-separator .separator__text', 'color:' + theme.centerChannelColor, 2);
        changeCss('.app__body .date-separator .separator__hr, .app__body .modal-footer, .app__body .modal .custom-textarea', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.2), 1);
        changeCss('.app__body .search-item-container, .app__body .post-right__container .post.post--root', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.1), 1);
        changeCss('.app__body .modal .custom-textarea:focus', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.3), 1);
        changeCss('.app__body .channel-intro, .app__body .modal .settings-modal .settings-table .settings-content .divider-dark, .app__body hr, .app__body .modal .settings-modal .settings-table .settings-links, .app__body .modal .settings-modal .settings-table .settings-content .appearance-section .theme-elements__header', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.2), 1);
        changeCss('.app__body .post.current--user .post__body, .app__body .post.post--comment.other--root.current--user .post-comment, .app__body pre, .app__body .post-right__container .post.post--root', 'background:' + changeOpacity(theme.centerChannelColor, 0.07), 1);
        changeCss('.app__body .post.post--comment.other--root.current--user .post-comment, .app__body .more-modal__list .more-modal__row, .app__body .member-div:first-child, .app__body .member-div, .app__body .access-history__table .access__report, .app__body .activity-log__table', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.1), 2);
        changeCss('@media(max-width: 1800px){.app__body .inner-wrap.move--left .post.post--comment.same--root', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.07), 2);
        changeCss('.app__body .post:hover, .app__body .more-modal__list .more-modal__row:hover, .app__body .modal .settings-modal .settings-table .settings-content .section-min:hover', 'background:' + changeOpacity(theme.centerChannelColor, 0.07), 1);
        changeCss('.app__body .date-separator.hovered--before:after, .app__body .date-separator.hovered--after:before, .app__body .new-separator.hovered--after:before, .app__body .new-separator.hovered--before:after', 'background:' + changeOpacity(theme.centerChannelColor, 0.07), 1);
        changeCss('.app__body .suggestion-list__content .command:hover, .app__body .mentions__name:hover, .app__body .suggestion--selected, .app__body .dropdown-menu>li>a:focus, .app__body .dropdown-menu>li>a:hover, .app__body .bot-indicator', 'background:' + changeOpacity(theme.centerChannelColor, 0.15), 1);
        changeCss('code, .app__body .form-control[disabled], .app__body .form-control[readonly], .app__body fieldset[disabled] .form-control', 'background:' + changeOpacity(theme.centerChannelColor, 0.1), 1);
        changeCss('@media(min-width: 960px){.app__body .post.current--user:hover .post__body ', 'background: none;', 1);
        changeCss('.app__body .sidebar--right', 'color:' + theme.centerChannelColor, 2);
        changeCss('.app__body .search-help-popover .search-autocomplete__item:hover, .app__body .modal .settings-modal .settings-table .settings-content .appearance-section .theme-elements__body', 'background:' + changeOpacity(theme.centerChannelColor, 0.05), 1);
        changeCss('.app__body .search-help-popover .search-autocomplete__item.selected', 'background:' + changeOpacity(theme.centerChannelColor, 0.15), 1);
        changeCss('::-webkit-scrollbar-thumb', 'background:' + changeOpacity(theme.centerChannelColor, 0.4), 1);
        changeCss('body', 'scrollbar-arrow-color:' + theme.centerChannelColor, 4);
        changeCss('.app__body .modal .about-modal .about-modal__logo svg, .app__body .post .post__img svg', 'fill:' + theme.centerChannelColor, 1);
        changeCss('.app__body .scrollbar--horizontal, .app__body .scrollbar--vertical', 'background:' + changeOpacity(theme.centerChannelColor, 0.5), 2);
        changeCss('.app__body .post-list__new-messages-below', 'background:' + changeColor(theme.centerChannelColor, 0.5), 2);
        changeCss('.app__body .post.post--comment .post__body', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.2), 1);
        changeCss('.app__body .post.post--comment.current--user .post__body', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.2), 1);
    }

    if (theme.newMessageSeparator) {
        changeCss('.app__body .new-separator .separator__text', 'color:' + theme.newMessageSeparator, 1);
        changeCss('.app__body .new-separator .separator__hr', 'border-color:' + changeOpacity(theme.newMessageSeparator, 0.5), 1);
    }

    if (theme.linkColor) {
        changeCss('.app__body a, .app__body a:focus, .app__body a:hover, .app__body .btn, .app__body .btn:focus, .app__body .btn:hover', 'color:' + theme.linkColor, 1);
        changeCss('.app__body .post .comment-icon__container, .app__body .post .post__reply', 'fill:' + theme.linkColor, 1);
    }

    if (theme.buttonBg) {
        changeCss('.app__body .btn.btn-primary, .app__body .tutorial__circles .circle.active', 'background:' + theme.buttonBg, 1);
        changeCss('.app__body .btn.btn-primary:hover, .app__body .btn.btn-primary:active, .app__body .btn.btn-primary:focus', 'background:' + changeColor(theme.buttonBg, -0.25), 1);
    }

    if (theme.buttonColor) {
        changeCss('.app__body .btn.btn-primary', 'color:' + theme.buttonColor, 2);
    }

    if (theme.mentionHighlightBg) {
        changeCss('.app__body .mention--highlight, .app__body .search-highlight', 'background:' + theme.mentionHighlightBg, 1);
    }

    if (theme.mentionHighlightBg) {
        changeCss('.app__body .post.post--highlight', 'background:' + changeOpacity(theme.mentionHighlightBg, 0.5), 1);
    }

    if (theme.mentionHighlightLink) {
        changeCss('.app__body .mention--highlight .mention-link, .app__body .mention--highlight, .app__body .search-highlight', 'color:' + theme.mentionHighlightLink, 1);
    }

    if (!theme.codeTheme) {
        theme.codeTheme = Constants.DEFAULT_CODE_THEME;
    }
    updateCodeTheme(theme.codeTheme);
}

export function resetTheme() {
    applyTheme(Constants.THEMES.default);
}

export function applyFont(fontName) {
    const body = $('body');

    for (const key of Reflect.ownKeys(Constants.FONTS)) {
        const className = Constants.FONTS[key];

        if (fontName === key) {
            if (!body.hasClass(className)) {
                body.addClass(className);
            }
        } else {
            body.removeClass(className);
        }
    }
}

export function changeCss(className, classValue, classRepeat) {
    // we need invisible container to store additional css definitions
    var cssMainContainer = $('#css-modifier-container');
    if (cssMainContainer.length === 0) {
        cssMainContainer = $('<div id="css-modifier-container"></div>');
        cssMainContainer.hide();
        cssMainContainer.appendTo($('body'));
    }

    // and we need one div for each class
    var classContainer = cssMainContainer.find('div[data-class="' + className + classRepeat + '"]');
    if (classContainer.length === 0) {
        classContainer = $('<div data-class="' + className + classRepeat + '"></div>');
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

export function updateCodeTheme(userTheme) {
    let cssPath = '';
    Constants.THEME_ELEMENTS.forEach((element) => {
        if (element.id === 'codeTheme') {
            element.themes.forEach((theme) => {
                if (userTheme === theme.id) {
                    cssPath = theme.cssURL;
                    return;
                }
            });
        }
    });
    const $link = $('link.code_theme');
    if (cssPath !== $link.attr('href')) {
        changeCss('code.hljs', 'visibility: hidden');
        var xmlHTTP = new XMLHttpRequest();
        xmlHTTP.open('GET', cssPath, true);
        xmlHTTP.onload = function onLoad() {
            $link.attr('href', cssPath);
            if (isBrowserFirefox()) {
                $link.one('load', () => {
                    changeCss('code.hljs', 'visibility: visible');
                });
            } else {
                changeCss('code.hljs', 'visibility: visible');
            }
        };
        xmlHTTP.send();
    }
}

export function placeCaretAtEnd(el) {
    el.focus();
    el.selectionStart = el.value.length;
    el.selectionEnd = el.value.length;

    return;
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
    } else if (name.length < Constants.MIN_USERNAME_LENGTH || name.length > Constants.MAX_USERNAME_LENGTH) {
        error = 'Must be between ' + Constants.MIN_USERNAME_LENGTH + ' and ' + Constants.MAX_USERNAME_LENGTH + ' characters';
    } else if (!(/^[a-z0-9\.\-_]+$/).test(name)) {
        error = "Must contain only letters, numbers, and the symbols '.', '-', and '_'.";
    } else if (!(/[a-z]/).test(name.charAt(0))) { //eslint-disable-line no-negated-condition
        error = 'First character must be a letter.';
    } else {
        for (var i = 0; i < Constants.RESERVED_USERNAMES.length; i++) {
            if (name === Constants.RESERVED_USERNAMES[i]) {
                error = 'Cannot use a reserved word as a username.';
                break;
            }
        }
    }

    return error;
}

export function isMobile() {
    return window.innerWidth <= Constants.MOBILE_SCREEN_WIDTH;
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
        var m = h.match(/^Content-Type:\s*(.*?)$/mi);
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
    var hex = colourIn;
    var lum = amt;

    // validate hex string
    hex = String(hex).replace(/[^0-9a-f]/gi, '');
    if (hex.length < 6) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    lum = lum || 0;

    // convert to decimal and change luminosity
    var rgb = '#';
    var c;
    var i;
    for (i = 0; i < 3; i++) {
        c = parseInt(hex.substr(i * 2, 2), 16);
        c = Math.round(Math.min(Math.max(0, c + (c * lum)), 255)).toString(16);
        rgb += ('00' + c).substr(c.length);
    }

    return rgb;
}

export function changeOpacity(oldColor, opacity) {
    var color = oldColor;
    if (color[0] === '#') {
        color = color.slice(1);
    }

    if (color.length === 3) {
        const tempColor = color;
        color = '';

        color += tempColor[0] + tempColor[0];
        color += tempColor[1] + tempColor[1];
        color += tempColor[2] + tempColor[2];
    }

    var r = parseInt(color.substring(0, 2), 16);
    var g = parseInt(color.substring(2, 4), 16);
    var b = parseInt(color.substring(4, 6), 16);

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

export function displayUsername(userId) {
    const user = UserStore.getProfile(userId);
    const nameFormat = PreferenceStore.get(Constants.Preferences.CATEGORY_DISPLAY_SETTINGS, 'name_format', 'false');

    let username = '';
    if (user) {
        if (nameFormat === Constants.Preferences.DISPLAY_PREFER_NICKNAME) {
            username = user.nickname || getFullName(user);
        } else if (nameFormat === Constants.Preferences.DISPLAY_PREFER_FULL_NAME) {
            username = getFullName(user);
        }
        if (!username.trim().length) {
            username = user.username;
        }
    }

    return username;
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
    return getWindowLocationOrigin() + Client.getFilesRoute() + '/get' + filename;
}

// Gets the name of a file (including extension) from a given url or file path.
export function getFileName(path) {
    var split = path.split('/');
    return split[split.length - 1];
}

// Gets the websocket port to use. Configurable on the server.
export function getWebsocketPort(protocol) {
    if ((/^wss:/).test(protocol)) { // wss://
        return ':' + global.window.mm_config.WebsocketSecurePort;
    }
    if ((/^ws:/).test(protocol)) {
        return ':' + global.window.mm_config.WebsocketPort;
    }
    return '';
}

// Generates a RFC-4122 version 4 compliant globally unique identifier.
export function generateId() {
    // implementation taken from http://stackoverflow.com/a/2117523
    var id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';

    id = id.replace(/[xy]/g, (c) => {
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
    return window.navigator && navigator.userAgent && navigator.userAgent.toLowerCase().indexOf('edge') > -1;
}

export function getDirectChannelName(id, otherId) {
    let handle;

    if (otherId > id) {
        handle = id + '__' + otherId;
    } else {
        handle = otherId + '__' + id;
    }

    return handle;
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

// Returns true if the given channel is a direct channel between the current user and the given one
export function isDirectChannelForUser(otherUserId, channel) {
    return channel.type === Constants.DM_CHANNEL && getUserIdFromChannelName(channel) === otherUserId;
}

export function importSlack(file, success, error) {
    var formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('filesize', file.size);
    formData.append('importFrom', 'slack');

    Client.importSlack(formData, success, error);
}

export function getTeamURLFromAddressBar() {
    return window.location.origin + '/' + window.location.pathname.split('/')[1];
}

export function getTeamNameFromUrl() {
    return window.location.pathname.split('/')[1];
}

export function getTeamURLNoOriginFromAddressBar() {
    return '/' + window.location.pathname.split('/')[1];
}

export function getShortenedTeamURL() {
    const teamURL = getTeamURLFromAddressBar();
    if (teamURL.length > 35) {
        return teamURL.substring(0, 10) + '...' + teamURL.substring(teamURL.length - 12, teamURL.length) + '/';
    }
    return teamURL + '/';
}

export function windowWidth() {
    return $(window).width();
}

export function windowHeight() {
    return $(window).height();
}

export function openDirectChannelToUser(user, successCb, errorCb) {
    AsyncClient.savePreference(
        Constants.Preferences.CATEGORY_DIRECT_CHANNEL_SHOW,
        user.id,
        'true'
    );

    // if the user in another team and isn't already in the direct message
    // list then we should add him so his name shows up correctly.
    var profileUser = UserStore.getProfile(user.id);
    if (!profileUser) {
        UserStore.getDirectProfiles()[user.id] = user;
    }

    const channelName = this.getDirectChannelName(UserStore.getCurrentId(), user.id);
    let channel = ChannelStore.getByName(channelName);

    if (channel) {
        if ($.isFunction(successCb)) {
            successCb(channel, true);
        }
    } else {
        channel = {
            name: channelName,
            last_post_at: 0,
            total_msg_count: 0,
            type: 'D',
            display_name: user.username,
            teammate_id: user.id,
            status: UserStore.getStatus(user.id)
        };

        Client.createDirectChannel(
            user.id,
            (data) => {
                Client.getChannel(
                    data.id,
                    (data2) => {
                        AppDispatcher.handleServerAction({
                            type: ActionTypes.RECEIVED_CHANNEL,
                            channel: data2.channel,
                            member: data2.member
                        });

                        if ($.isFunction(successCb)) {
                            successCb(data2.channel, false);
                        }
                    }
                );
            },
            () => {
                browserHistory.push(TeamStore.getCurrentTeamUrl() + '/channels/' + channelName);
                if ($.isFunction(errorCb)) {
                    errorCb();
                }
            }
        );
    }
}

// Use when sorting multiple channels or teams by their `display_name` field
export function sortByDisplayName(a, b) {
    let aDisplayName = '';
    let bDisplayName = '';

    if (a && a.display_name) {
        aDisplayName = a.display_name.toLowerCase();
    }
    if (b && b.display_name) {
        bDisplayName = b.display_name.toLowerCase();
    }

    if (aDisplayName < bDisplayName) {
        return -1;
    }
    if (aDisplayName > bDisplayName) {
        return 1;
    }
    return 0;
}

export function getChannelTerm(channelType) {
    let channelTerm = 'Channel';
    if (channelType === Constants.PRIVATE_CHANNEL) {
        channelTerm = 'Group';
    }

    return channelTerm;
}

export function getPostTerm(post) {
    let postTerm = 'Post';
    if (post.root_id) {
        postTerm = 'Comment';
    }

    return postTerm;
}

export function isFeatureEnabled(feature) {
    return PreferenceStore.getBool(Constants.Preferences.CATEGORY_ADVANCED_SETTINGS, Constants.FeatureTogglePrefix + feature.label);
}

export function fillArray(value, length) {
    const arr = [];

    for (let i = 0; i < length; i++) {
        arr.push(value);
    }

    return arr;
}

// Checks if a data transfer contains files not text, folders, etc..
// Slightly modified from http://stackoverflow.com/questions/6848043/how-do-i-detect-a-file-is-being-dragged-rather-than-a-draggable-element-on-my-pa
export function isFileTransfer(files) {
    if (isBrowserIE()) {
        return files.types != null && files.types.contains('Files');
    }

    return files.types != null && (files.types.indexOf ? files.types.indexOf('Files') !== -1 : files.types.contains('application/x-moz-file'));
}

export function clearFileInput(elm) {
    // clear file input for all modern browsers
    try {
        elm.value = '';
        if (elm.value) {
            elm.type = 'text';
            elm.type = 'file';
        }
    } catch (e) {
        // Do nothing
    }
}

export function isPostEphemeral(post) {
    return post.type === Constants.POST_TYPE_EPHEMERAL || post.state === Constants.POST_DELETED;
}

export function getRootId(post) {
    return post.root_id === '' ? post.id : post.root_id;
}

export function localizeMessage(id, defaultMessage) {
    const translations = LocalizationStore.getTranslations();
    if (translations) {
        const value = translations[id];
        if (value) {
            return value;
        }
    }

    if (defaultMessage) {
        return defaultMessage;
    }

    return id;
}
