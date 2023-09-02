// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {LinkHTMLAttributes} from 'react';
import {FormattedMessage, IntlShape} from 'react-intl';

import cssVars from 'css-vars-ponyfill';

import moment from 'moment';

import type {Locale} from 'date-fns';

import {getName} from 'country-list';

import {isNil} from 'lodash';

import Constants, {FileTypes, ValidationErrors, A11yCustomEventTypes, A11yFocusEventDetail} from 'utils/constants';

import {
    getChannel as getChannelAction,
    getChannelByNameAndTeamName,
    getChannelMember,
    joinChannel,
} from 'mattermost-redux/actions/channels';
import {getPost as getPostAction} from 'mattermost-redux/actions/posts';
import {getTeamByName as getTeamByNameAction} from 'mattermost-redux/actions/teams';
import {Client4} from 'mattermost-redux/client';
import {Preferences, General} from 'mattermost-redux/constants';
import {
    getChannel,
    getChannelsNameMapInTeam,
    getMyChannelMemberships,
} from 'mattermost-redux/selectors/entities/channels';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {getBool, getTeammateNameDisplaySetting, Theme, isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUser, getCurrentUserId, isFirstAdmin} from 'mattermost-redux/selectors/entities/users';
import {blendColors, changeOpacity} from 'mattermost-redux/utils/theme_utils';
import {displayUsername, isSystemAdmin} from 'mattermost-redux/utils/user_utils';
import {
    getTeamByName,
    getTeamMemberships,
    isTeamSameWithCurrentTeam,
} from 'mattermost-redux/selectors/entities/teams';

import {addUserToTeam} from 'actions/team_actions';
import {searchForTerm} from 'actions/post_actions';
import {getHistory} from 'utils/browser_history';
import * as Keyboard from 'utils/keyboard';
import * as UserAgent from 'utils/user_agent';
import {t} from 'utils/i18n';
import store from 'stores/redux_store.jsx';

import {getCurrentLocale, getTranslations} from 'selectors/i18n';

import {FileInfo} from '@mattermost/types/files';
import {Team} from '@mattermost/types/teams';
import {UserProfile} from '@mattermost/types/users';
import {Channel} from '@mattermost/types/channels';

import {ClientConfig} from '@mattermost/types/config';

import {GlobalState} from '@mattermost/types/store';

import {focusPost} from 'components/permalink_view/actions';

import {TextboxElement} from '../components/textbox';

import {Address} from '@mattermost/types/cloud';

import {joinPrivateChannelPrompt} from './channel_utils';

const CLICKABLE_ELEMENTS = [
    'a',
    'button',
    'img',
    'svg',
    'audio',
    'video',
];
const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export enum TimeInformation {
    MILLISECONDS = 'm',
    SECONDS = 's',
    MINUTES = 'x',
    HOURS = 'h',
    DAYS = 'd',
    FUTURE = 'f',
    PAST = 'p'
}

export type TimeUnit = Exclude<TimeInformation, TimeInformation.FUTURE | TimeInformation.PAST>;
export type TimeDirection = TimeInformation.FUTURE | TimeInformation.PAST;

export function createSafeId(prop: {props: {defaultMessage: string}} | string): string | undefined {
    let str = '';

    if (typeof prop !== 'string' && prop.props && prop.props.defaultMessage) {
        str = prop.props.defaultMessage;
    } else {
        str = prop.toString();
    }

    return str.replace(new RegExp(' ', 'g'), '_');
}

/**
 * check keydown event for line break combo. Should catch alt/option + enter not all browsers except Safari
 */
export function isUnhandledLineBreakKeyCombo(e: React.KeyboardEvent | KeyboardEvent): boolean {
    return Boolean(
        Keyboard.isKeyPressed(e, Constants.KeyCodes.ENTER) &&
        !e.shiftKey && // shift + enter is already handled everywhere, so don't handle again
        (e.altKey && !UserAgent.isSafari() && !Keyboard.cmdOrCtrlPressed(e)), // alt/option + enter is already handled in Safari, so don't handle again
    );
}

/**
 * insert a new line character at keyboard cursor (or overwrites selection)
 * WARNING: HAS DOM SIDE EFFECTS
 */
export function insertLineBreakFromKeyEvent(e: React.KeyboardEvent<TextboxElement>): string {
    const el = e.target as TextboxElement;
    const {selectionEnd, selectionStart, value} = el;

    // replace text selection (or insert if no selection) with new line character
    const newValue = `${value.substr(0, selectionStart!)}\n${value.substr(selectionEnd!, value.length)}`;

    // update value on DOM element immediately and restore key cursor to correct position
    el.value = newValue;
    setSelectionRange(el, selectionStart! + 1, selectionStart! + 1);

    // return the updated string so that component state can be updated
    return newValue;
}

export function getDateForUnixTicks(ticks: number): Date {
    return new Date(ticks);
}

// returns Unix timestamp in milliseconds
export function getTimestamp(): number {
    return Date.now();
}

export function getRemainingDaysFromFutureTimestamp(timestamp?: number): number {
    const futureDate = new Date(timestamp as number);
    const utcFuture = Date.UTC(futureDate.getFullYear(), futureDate.getMonth(), futureDate.getDate());
    const today = new Date();
    const utcToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());

    return Math.floor((utcFuture - utcToday) / MS_PER_DAY);
}

export function addTimeToTimestamp(timestamp: number, type: TimeUnit, diff: number, timeline: TimeDirection) {
    let modifier = 1;
    switch (type) {
    case TimeInformation.SECONDS:
        modifier = MS_PER_SECOND;
        break;
    case TimeInformation.MINUTES:
        modifier = MS_PER_MINUTE;
        break;
    case TimeInformation.HOURS:
        modifier = MS_PER_HOUR;
        break;
    case TimeInformation.DAYS:
        modifier = MS_PER_DAY;
        break;
    }

    return timeline === TimeInformation.FUTURE ? timestamp + (diff * modifier) : timestamp - (diff * modifier);
}

/**
 * Verifies if a date is in a particular given range of days from today
 * @param timestamp date you want to check is in the range of the provided number of days from today
 * @param days number of days you want to check your date against to
 * @param timeline 'f' represents future, 'p' represents past
 * @returns boolean, true if your date is in the range of the provided number of days
 */
export function isDateWithinDaysRange(timestamp: number, days: number, timeline: TimeDirection): boolean {
    const today = new Date().getTime();
    const daysSince = Math.round((today - timestamp) / MS_PER_DAY);
    return timeline === TimeInformation.PAST ? daysSince <= days : daysSince >= days;
}

export function getLocaleDateFromUTC(timestamp: number, format = 'YYYY/MM/DD HH:mm:ss', userTimezone = '') {
    if (!timestamp) {
        return moment.now();
    }
    const timezone = userTimezone ? ' ' + moment().tz(userTimezone).format('z') : '';
    return moment.unix(timestamp).format(format) + timezone;
}

export function replaceHtmlEntities(text: string) {
    const tagsToReplace = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
    };
    let newtext = text;
    Object.entries(tagsToReplace).forEach(([tag, replacement]) => {
        const regex = new RegExp(tag, 'g');
        newtext = newtext.replace(regex, replacement);
    });
    return newtext;
}

export function isGIFImage(extin: string): boolean {
    return extin.toLowerCase() === Constants.IMAGE_TYPE_GIF;
}

const removeQuerystringOrHash = (extin: string): string => {
    return extin.split(/[?#]/)[0];
};

export const getFileType = (extin: string): typeof FileTypes[keyof typeof FileTypes] => {
    const ext = removeQuerystringOrHash(extin.toLowerCase());

    if (Constants.TEXT_TYPES.indexOf(ext) > -1) {
        return FileTypes.TEXT;
    }

    if (Constants.IMAGE_TYPES.indexOf(ext) > -1) {
        return FileTypes.IMAGE;
    }

    if (Constants.AUDIO_TYPES.indexOf(ext) > -1) {
        return FileTypes.AUDIO;
    }

    if (Constants.VIDEO_TYPES.indexOf(ext) > -1) {
        return FileTypes.VIDEO;
    }

    if (Constants.SPREADSHEET_TYPES.indexOf(ext) > -1) {
        return FileTypes.SPREADSHEET;
    }

    if (Constants.CODE_TYPES.indexOf(ext) > -1) {
        return FileTypes.CODE;
    }

    if (Constants.WORD_TYPES.indexOf(ext) > -1) {
        return FileTypes.WORD;
    }

    if (Constants.PRESENTATION_TYPES.indexOf(ext) > -1) {
        return FileTypes.PRESENTATION;
    }

    if (Constants.PDF_TYPES.indexOf(ext) > -1) {
        return FileTypes.PDF;
    }

    if (Constants.PATCH_TYPES.indexOf(ext) > -1) {
        return FileTypes.PATCH;
    }

    if (Constants.SVG_TYPES.indexOf(ext) > -1) {
        return FileTypes.SVG;
    }

    return FileTypes.OTHER;
};

export function getFileIconPath(fileInfo: FileInfo) {
    const fileType = getFileType(fileInfo.extension) as keyof typeof Constants.ICON_FROM_TYPE;

    let icon;
    if (fileType in Constants.ICON_FROM_TYPE) {
        icon = Constants.ICON_FROM_TYPE[fileType];
    } else {
        icon = Constants.ICON_FROM_TYPE.other;
    }

    return icon;
}

export function getCompassIconClassName(fileTypeIn: string, outline = true, large = false) {
    const fileType = fileTypeIn.toLowerCase() as keyof typeof Constants.ICON_FROM_TYPE;
    let icon = 'generic';

    if (fileType in Constants.ICON_NAME_FROM_TYPE) {
        icon = Constants.ICON_NAME_FROM_TYPE[fileType];
    }

    icon = icon === 'ppt' ? 'powerpoint' : icon;
    icon = icon === 'spreadsheet' ? 'excel' : icon;
    icon = icon === 'other' ? 'generic' : icon;

    return `icon-file-${icon}${outline ? '-outline' : ''}${large ? '-large' : ''}`;
}

export function getIconClassName(fileTypeIn: string) {
    const fileType = fileTypeIn.toLowerCase()as keyof typeof Constants.ICON_FROM_TYPE;

    if (fileType in Constants.ICON_NAME_FROM_TYPE) {
        return Constants.ICON_NAME_FROM_TYPE[fileType];
    }

    return 'generic';
}

export function toTitleCase(str: string): string {
    function doTitleCase(txt: string) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    }
    return str.replace(/\w\S*/g, doTitleCase);
}

function dropAlpha(value: string): string {
    return value.substr(value.indexOf('(') + 1).split(',', 3).join(',');
}

// given '#fffff', returns '255, 255, 255' (no trailing comma)
export function toRgbValues(hexStr: string): string {
    const rgbaStr = `${parseInt(hexStr.substr(1, 2), 16)}, ${parseInt(hexStr.substr(3, 2), 16)}, ${parseInt(hexStr.substr(5, 2), 16)}`;
    return rgbaStr;
}

export function applyTheme(theme: Theme) {
    if (theme.centerChannelColor) {
        changeCss('.app__body .bg-text-200', 'background:' + changeOpacity(theme.centerChannelColor, 0.2));
        changeCss('.app__body .user-popover__role', 'background:' + changeOpacity(theme.centerChannelColor, 0.3));
        changeCss('.app__body .svg-text-color', 'fill:' + theme.centerChannelColor);
        changeCss('.app__body .suggestion-list__icon .status.status--group, .app__body .multi-select__note', 'background:' + changeOpacity(theme.centerChannelColor, 0.12));
        changeCss('.app__body .modal-tabs .nav-tabs > li, .app__body .system-notice, .app__body .file-view--single .file__image .image-loaded, .app__body .post .MenuWrapper .dropdown-menu button, .app__body .member-list__popover .more-modal__body, .app__body .alert.alert-transparent, .app__body .table > thead > tr > th, .app__body .table > tbody > tr > td', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.12));
        changeCss('.app__body .post-list__arrows', 'fill:' + changeOpacity(theme.centerChannelColor, 0.3));
        changeCss('.app__body .post .card-icon__container', 'color:' + changeOpacity(theme.centerChannelColor, 0.3));
        changeCss('.app__body .post-image__details .post-image__download svg', 'stroke:' + changeOpacity(theme.centerChannelColor, 0.4));
        changeCss('.app__body .post-image__details .post-image__download svg', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.35));
        changeCss('.app__body .channel-header__links .icon, .app__body .sidebar--right .sidebar--right__subheader .usage__icon, .app__body .more-modal__header svg, .app__body .icon--body', 'fill:' + theme.centerChannelColor);
        changeCss('@media(min-width: 768px){.app__body .post:hover .post__header .post-menu, .app__body .post.post--hovered .post__header .post-menu, .app__body .post.a11y--active .post__header .post-menu', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.2));
        changeCss('.app__body .help-text, .app__body .post .post-waiting, .app__body .post.post--system .post__body', 'color:' + changeOpacity(theme.centerChannelColor, 0.6));
        changeCss('.app__body .nav-tabs, .app__body .nav-tabs > li.active > a, pp__body .input-group-addon, .app__body .app__content, .app__body .post-create__container .post-create-body .btn-file, .app__body .post-create__container .post-create-footer .msg-typing, .app__body .dropdown-menu, .app__body .popover, .app__body .suggestion-list__item .suggestion-list__ellipsis .suggestion-list__main, .app__body .tip-overlay, .app__body .form-control[disabled], .app__body .form-control[readonly], .app__body fieldset[disabled] .form-control', 'color:' + theme.centerChannelColor);
        changeCss('.app__body .post .post__link', 'color:' + changeOpacity(theme.centerChannelColor, 0.65));
        changeCss('.app__body #archive-link-home, .video-div .video-thumbnail__error', 'background:' + changeOpacity(theme.centerChannelColor, 0.15));
        changeCss('.app__body #post-create', 'color:' + theme.centerChannelColor);
        changeCss('.app__body .mentions--top', 'box-shadow:' + changeOpacity(theme.centerChannelColor, 0.2) + ' 1px -3px 12px');
        changeCss('.app__body .mentions--top', '-webkit-box-shadow:' + changeOpacity(theme.centerChannelColor, 0.2) + ' 1px -3px 12px');
        changeCss('.app__body .mentions--top', '-moz-box-shadow:' + changeOpacity(theme.centerChannelColor, 0.2) + ' 1px -3px 12px');
        changeCss('.app__body .shadow--2', 'box-shadow: 0 20px 30px 0' + changeOpacity(theme.centerChannelColor, 0.1) + ', 0 14px 20px 0 ' + changeOpacity(theme.centerChannelColor, 0.1));
        changeCss('.app__body .shadow--2', '-moz-box-shadow: 0  20px 30px 0 ' + changeOpacity(theme.centerChannelColor, 0.1) + ', 0 14px 20px 0 ' + changeOpacity(theme.centerChannelColor, 0.1));
        changeCss('.app__body .shadow--2', '-webkit-box-shadow: 0  20px 30px 0 ' + changeOpacity(theme.centerChannelColor, 0.1) + ', 0 14px 20px 0 ' + changeOpacity(theme.centerChannelColor, 0.1));
        changeCss('.app__body .shortcut-key, .app__body .post__body hr, .app__body .loading-screen .loading__content .round, .app__body .tutorial__circles .circle', 'background:' + theme.centerChannelColor);
        changeCss('.app__body .channel-header .heading', 'color:' + theme.centerChannelColor);
        changeCss('.app__body .markdown__table tbody tr:nth-child(2n)', 'background:' + changeOpacity(theme.centerChannelColor, 0.07));
        changeCss('.app__body .channel-header__info .header-dropdown__icon', 'color:' + changeOpacity(theme.centerChannelColor, 0.8));
        changeCss('.app__body .post-create__container .post-create-body .send-button.disabled i', 'color:' + changeOpacity(theme.centerChannelColor, 0.4));
        changeCss('.app__body .channel-header .pinned-posts-button svg', 'fill:' + changeOpacity(theme.centerChannelColor, 0.6));
        changeCss('.app__body .channel-header .channel-header_plugin-dropdown svg', 'fill:' + changeOpacity(theme.centerChannelColor, 0.6));
        changeCss('.app__body .file-preview, .app__body .post-image__details, .app__body .markdown__table th, .app__body .markdown__table td, .app__body .modal .settings-modal .settings-table .settings-content .divider-light, .app__body .webhooks__container, .app__body .dropdown-menu, .app__body .modal .modal-header', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.2));
        changeCss('.emoji-picker .emoji-picker__header', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.2));
        changeCss('.app__body .popover.bottom>.arrow', 'border-bottom-color:' + changeOpacity(theme.centerChannelColor, 0.25));
        changeCss('.app__body .btn.btn-transparent', 'color:' + changeOpacity(theme.centerChannelColor, 0.7));
        changeCss('.app__body .popover.right>.arrow', 'border-right-color:' + changeOpacity(theme.centerChannelColor, 0.25));
        changeCss('.app__body .popover.left>.arrow', 'border-left-color:' + changeOpacity(theme.centerChannelColor, 0.25));
        changeCss('.app__body .popover.top>.arrow', 'border-top-color:' + changeOpacity(theme.centerChannelColor, 0.25));
        changeCss('.app__body .popover .popover__row', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.2));
        changeCss('body.app__body, .app__body .custom-textarea', 'color:' + theme.centerChannelColor);
        changeCss('.app__body .input-group-addon', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.1));
        changeCss('@media(min-width: 768px){.app__body .post-list__table .post-list__content .dropdown-menu a:hover, .dropdown-menu > li > button:hover', 'background:' + changeOpacity(theme.centerChannelColor, 0.1));
        changeCss('.app__body .MenuWrapper .MenuItem > button:hover, .app__body .Menu .MenuItem > button:hover, .app__body .MenuWrapper .MenuItem > button:focus, .app__body .MenuWrapper .SubMenuItem > div:focus, .app__body .MenuWrapper .MenuItem > a:hover, .MenuItem > div:hover, .SubMenuItemContainer:not(.hasDivider):hover, .app__body .dropdown-menu div > a:focus, .app__body .dropdown-menu div > a:hover, .dropdown-menu li > a:focus, .app__body .dropdown-menu li > a:hover', 'background:' + changeOpacity(theme.centerChannelColor, 0.1));
        changeCss('.app__body .MenuWrapper .MenuItem > button:hover, .app__body .Menu .MenuItem > button:hover, .app__body .MenuWrapper .MenuItem > button:focus, .app__body .MenuWrapper .SubMenuItem > div:focus, .app__body .MenuWrapper .MenuItem > a:hover, .app__body .MenuWrapper .MenuItem > div:hover, .app__body .MenuWrapper .SubMenuItemContainer:not(.hasDivider):hover, .app__body .MenuWrapper .SubMenuItemContainer:not(.hasDivider):focus, .app__body .MenuWrapper .SubMenuItemContainer:focus, .app__body .dropdown-menu div > a:focus, .app__body .dropdown-menu div > a:hover, .dropdown-menu li > a:focus, .app__body .dropdown-menu li > a:hover', 'background-color:' + changeOpacity(theme.centerChannelColor, 0.1));
        changeCss('.app__body .attachment .attachment__content, .app__body .attachment-actions button', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.16));
        changeCss('.app__body .attachment-actions button:focus, .app__body .attachment-actions button:hover', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.5));
        changeCss('.app__body .attachment-actions button:focus, .app__body .attachment-actions button:hover', 'background:' + changeOpacity(theme.centerChannelColor, 0.03));
        changeCss('.app__body .input-group-addon, .app__body .channel-intro .channel-intro__content, .app__body .webhooks__container', 'background:' + changeOpacity(theme.centerChannelColor, 0.05));
        changeCss('.app__body .date-separator .separator__text', 'color:' + theme.centerChannelColor);
        changeCss('.app__body .date-separator .separator__hr, .app__body .modal-footer, .app__body .modal .custom-textarea', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.2));
        changeCss('.app__body .search-item-container', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.1));
        changeCss('.app__body .modal .custom-textarea:focus', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.3));
        changeCss('.app__body .channel-intro, .app__body .modal .settings-modal .settings-table .settings-content .divider-dark, .app__body hr, .app__body .modal .settings-modal .settings-table .settings-links, .app__body .modal .settings-modal .settings-table .settings-content .appearance-section .theme-elements__header, .app__body .user-settings .authorized-app:not(:last-child)', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.2));
        changeCss('.app__body .post.post--comment.other--root.current--user .post-comment, .app__body pre', 'background:' + changeOpacity(theme.centerChannelColor, 0.05));
        changeCss('.app__body .post.post--comment.other--root.current--user .post-comment, .app__body .more-modal__list .more-modal__row, .app__body .member-div:first-child, .app__body .member-div, .app__body .access-history__table .access__report, .app__body .activity-log__table', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.1));
        changeCss('@media(max-width: 1800px){.app__body .inner-wrap.move--left .post.post--comment.same--root', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.07));
        changeCss('.app__body .post.post--hovered', 'background:' + changeOpacity(theme.centerChannelColor, 0.08));
        changeCss('.app__body .attachment__body__wrap.btn-close', 'background:' + changeOpacity(theme.centerChannelColor, 0.08));
        changeCss('.app__body .attachment__body__wrap.btn-close', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.2));
        changeCss('@media(min-width: 768px){.app__body .post.a11y--active, .app__body .modal .settings-modal .settings-table .settings-content .section-min:hover', 'background:' + changeOpacity(theme.centerChannelColor, 0.08));
        changeCss('@media(min-width: 768px){.app__body .post.post--editing', 'background:' + changeOpacity(theme.buttonBg, 0.08));
        changeCss('@media(min-width: 768px){.app__body .post.current--user:hover .post__body ', 'background: transparent;');
        changeCss('.app__body .more-modal__row.more-modal__row--selected, .app__body .date-separator.hovered--before:after, .app__body .date-separator.hovered--after:before, .app__body .new-separator.hovered--after:before, .app__body .new-separator.hovered--before:after', 'background:' + changeOpacity(theme.centerChannelColor, 0.07));
        changeCss('@media(min-width: 768px){.app__body .dropdown-menu>li>a:focus, .app__body .dropdown-menu>li>a:hover', 'background:' + changeOpacity(theme.centerChannelColor, 0.15));
        changeCss('.app__body .form-control[disabled], .app__body .form-control[readonly], .app__body fieldset[disabled] .form-control', 'background:' + changeOpacity(theme.centerChannelColor, 0.1));
        changeCss('.app__body .sidebar--right', 'color:' + theme.centerChannelColor);
        changeCss('.app__body .modal .settings-modal .settings-table .settings-content .appearance-section .theme-elements__body', 'background:' + changeOpacity(theme.centerChannelColor, 0.05));
        changeCss('body', 'scrollbar-arrow-color:' + theme.centerChannelColor);
        changeCss('.app__body .post-create__container .post-create-body .btn-file svg, .app__body .post.post--compact .post-image__column .post-image__details svg, .app__body .modal .about-modal .about-modal__logo svg, .app__body .status svg, .app__body .edit-post__actions .icon svg', 'fill:' + theme.centerChannelColor);
        changeCss('.app__body .post-list__new-messages-below', 'background:' + changeColor(theme.centerChannelColor, 0.5));
        changeCss('@media(min-width: 768px){.app__body .post.post--compact.same--root.post--comment .post__content', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.2));
        changeCss('.app__body .post.post--comment.current--user .post__body', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.2));
        changeCss('.app__body .emoji-picker', 'color:' + theme.centerChannelColor);
        changeCss('.app__body .emoji-picker', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.2));
        changeCss('.app__body .emoji-picker__search-icon', 'color:' + changeOpacity(theme.centerChannelColor, 0.4));
        changeCss('.app__body .emoji-picker__preview, .app__body .emoji-picker__items, .app__body .emoji-picker__search-container', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.2));
        changeCss('.emoji-picker__category .fa:hover', 'color:' + changeOpacity(theme.centerChannelColor, 0.8));
        changeCss('.app__body .emoji-picker__item-wrapper:hover', 'background-color:' + changeOpacity(theme.centerChannelColor, 0.8));
        changeCss('.app__body .icon__postcontent_picker:hover', 'color:' + changeOpacity(theme.centerChannelColor, 0.8));
        changeCss('.app__body .emoji-picker .nav-tabs li a', 'fill:' + theme.centerChannelColor);
        changeCss('.app__body .post .post-collapse__show-more-button', `border-color:${changeOpacity(theme.centerChannelColor, 0.1)}`);
        changeCss('.app__body .post .post-collapse__show-more-line', `background-color:${changeOpacity(theme.centerChannelColor, 0.1)}`);
    }

    if (theme.newMessageSeparator) {
        changeCss('.app__body .new-separator .separator__text', 'color:' + theme.newMessageSeparator);
        changeCss('.app__body .new-separator .separator__hr', 'border-color:' + changeOpacity(theme.newMessageSeparator, 0.5));
    }

    if (theme.linkColor) {
        changeCss('.app__body .more-modal__list .a11y--focused, .app__body .post.a11y--focused, .app__body .channel-header.a11y--focused, .app__body .post-create.a11y--focused, .app__body .user-popover.a11y--focused, .app__body .post-message__text.a11y--focused, #archive-link-home>a.a11y--focused', 'box-shadow: inset 0 0 1px 3px ' + changeOpacity(theme.linkColor, 0.5) + ', inset 0 0 0 1px ' + theme.linkColor);
        changeCss('.app__body .a11y--focused', 'box-shadow: 0 0 1px 3px ' + changeOpacity(theme.linkColor, 0.5) + ', 0 0 0 1px ' + theme.linkColor);
        changeCss('.app__body .channel-header .channel-header__favorites.inactive:hover, .app__body .channel-header__links > a.active, .app__body a, .app__body a:focus, .app__body a:hover, .app__body .channel-header__links > .color--link.active, .app__body .color--link, .app__body a:focus, .app__body .color--link:hover, .app__body .btn, .app__body .btn:focus, .app__body .btn:hover', 'color:' + theme.linkColor);
        changeCss('.app__body .attachment .attachment__container', 'border-left-color:' + changeOpacity(theme.linkColor, 0.5));
        changeCss('.app__body .channel-header .channel-header_plugin-dropdown a:hover, .app__body .member-list__popover .more-modal__list .more-modal__row:hover', 'background:' + changeOpacity(theme.linkColor, 0.08));
        changeCss('.app__body .channel-header__links .icon:hover, .app__body .channel-header__links > a.active .icon, .app__body .post .post__reply', 'fill:' + theme.linkColor);
        changeCss('.app__body .channel-header__links .icon:hover, .app__body .post .card-icon__container.active svg, .app__body .post .post__reply', 'fill:' + theme.linkColor);
        changeCss('.app__body .channel-header .pinned-posts-button:hover svg', 'fill:' + changeOpacity(theme.linkColor, 0.6));
        changeCss('.app__body .member-list__popover .more-modal__actions svg', 'fill:' + theme.linkColor);
        changeCss('.app__body .modal-tabs .nav-tabs > li.active, .app__body .channel-header .channel-header_plugin-dropdown a:hover, .app__body .member-list__popover .more-modal__list .more-modal__row:hover', 'border-color:' + theme.linkColor);
        changeCss('.app__body .channel-header .channel-header_plugin-dropdown a:hover svg', 'fill:' + theme.linkColor);
        changeCss('.app__body .channel-header .dropdown-toggle:hover .heading, .app__body .channel-header .dropdown-toggle:hover .header-dropdown__icon, .app__body .channel-header__title .open .heading, .app__body .channel-header__info .channel-header__title .open .header-dropdown__icon, .app__body .channel-header__title .open .heading, .app__body .channel-header__info .channel-header__title .open .heading', 'color:' + theme.linkColor);
        changeCss('.emoji-picker__container .icon--emoji.active svg', 'fill:' + theme.linkColor);
        changeCss('.app__body .channel-header .channel-header_plugin-dropdown a:hover .fa', 'color:' + theme.linkColor);
        changeCss('.app__body .post .post-collapse__show-more', `color:${theme.linkColor}`);
        changeCss('.app__body .post .post-attachment-collapse__show-more', `color:${theme.linkColor}`);
        changeCss('.app__body .post .post-collapse__show-more-button:hover', `background-color:${theme.linkColor}`);
    }

    if (theme.buttonBg) {
        changeCss('.app__body .modal .settings-modal .profile-img__remove:hover, .app__body .DayPicker:not(.DayPicker--interactionDisabled) .DayPicker-Day:not(.DayPicker-Day--disabled):not(.DayPicker-Day--selected):not(.DayPicker-Day--outside):hover:before, .app__body .modal .settings-modal .team-img__remove:hover, .app__body .btn.btn-transparent:hover, .app__body .btn.btn-transparent:active, .app__body .post-image__details .post-image__download svg:hover, .app__body .file-view--single .file__download:hover, .app__body .new-messages__button div, .app__body .btn.btn-primary, .app__body .tutorial__circles .circle.active', 'background:' + theme.buttonBg);
        changeCss('.app__body .system-notice__logo svg', 'fill:' + theme.buttonBg);
        changeCss('.app__body .post-image__details .post-image__download svg:hover', 'border-color:' + theme.buttonBg);
        changeCss('.app__body .btn.btn-primary:hover, .app__body .btn.btn-primary:active, .app__body .btn.btn-primary:focus', 'background:' + changeColor(theme.buttonBg, -0.15));
        changeCss('.app__body .emoji-picker .nav-tabs li.active a, .app__body .emoji-picker .nav-tabs li a:hover', 'fill:' + theme.buttonBg);
        changeCss('.app__body .emoji-picker .nav-tabs > li.active > a', 'border-bottom-color:' + theme.buttonBg + '!important;');
    }

    if (theme.buttonColor) {
        changeCss('.app__body .DayPicker:not(.DayPicker--interactionDisabled) .DayPicker-Day:not(.DayPicker-Day--disabled):not(.DayPicker-Day--selected):not(.DayPicker-Day--outside):hover, .app__body .modal .settings-modal .team-img__remove:hover, .app__body .btn.btn-transparent:hover, .app__body .btn.btn-transparent:active, .app__body .new-messages__button div, .app__body .btn.btn-primary', 'color:' + theme.buttonColor);
        changeCss('.app__body .new-messages__button svg', 'fill:' + theme.buttonColor);
        changeCss('.app__body .post-image__details .post-image__download svg:hover, .app__body .file-view--single .file__download svg', 'stroke:' + theme.buttonColor);
    }

    if (theme.errorTextColor) {
        changeCss('.app__body .error-text, .app__body .modal .settings-modal .settings-table .settings-content .has-error, .app__body .modal .input__help.error, .app__body .color--error, .app__body .has-error .help-block, .app__body .has-error .control-label, .app__body .has-error .radio, .app__body .has-error .checkbox, .app__body .has-error .radio-inline, .app__body .has-error .checkbox-inline, .app__body .has-error.radio label, .app__body .has-error.checkbox label, .app__body .has-error.radio-inline label, .app__body .has-error.checkbox-inline label', 'color:' + theme.errorTextColor);
    }

    if (theme.mentionHighlightBg) {
        changeCss('.app__body .search-highlight', 'background:' + theme.mentionHighlightBg);
        changeCss('.app__body .post.post--highlight', 'background:' + changeOpacity(theme.mentionHighlightBg, 0.5));
    }

    if (theme.mentionHighlightLink) {
        changeCss('.app__body .search-highlight', 'color:' + theme.mentionHighlightLink);
        changeCss('.app__body .search-highlight > a', 'color: inherit');
    }

    if (!theme.codeTheme) {
        theme.codeTheme = Constants.DEFAULT_CODE_THEME;
    }
    updateCodeTheme(theme.codeTheme);

    cssVars({
        variables: {

            // RGB values derived from theme hex values i.e. '255, 255, 255'
            // (do not apply opacity mutations here)
            'away-indicator-rgb': toRgbValues(theme.awayIndicator),
            'button-bg-rgb': toRgbValues(theme.buttonBg),
            'button-color-rgb': toRgbValues(theme.buttonColor),
            'center-channel-bg-rgb': toRgbValues(theme.centerChannelBg),
            'center-channel-color-rgb': toRgbValues(theme.centerChannelColor),
            'dnd-indicator-rgb': toRgbValues(theme.dndIndicator),
            'error-text-color-rgb': toRgbValues(theme.errorTextColor),
            'link-color-rgb': toRgbValues(theme.linkColor),
            'mention-bg-rgb': toRgbValues(theme.mentionBg),
            'mention-color-rgb': toRgbValues(theme.mentionColor),
            'mention-highlight-bg-rgb': toRgbValues(theme.mentionHighlightBg),
            'mention-highlight-link-rgb': toRgbValues(theme.mentionHighlightLink),
            'mention-highlight-bg-mixed-rgb': dropAlpha(blendColors(theme.centerChannelBg, theme.mentionHighlightBg, 0.5)),
            'pinned-highlight-bg-mixed-rgb': dropAlpha(blendColors(theme.centerChannelBg, theme.mentionHighlightBg, 0.24)),
            'own-highlight-bg-rgb': dropAlpha(blendColors(theme.mentionHighlightBg, theme.centerChannelColor, 0.05)),
            'new-message-separator-rgb': toRgbValues(theme.newMessageSeparator),
            'online-indicator-rgb': toRgbValues(theme.onlineIndicator),
            'sidebar-bg-rgb': toRgbValues(theme.sidebarBg),
            'sidebar-header-bg-rgb': toRgbValues(theme.sidebarHeaderBg),
            'sidebar-teambar-bg-rgb': toRgbValues(theme.sidebarTeamBarBg),
            'sidebar-header-text-color-rgb': toRgbValues(theme.sidebarHeaderTextColor),
            'sidebar-text-rgb': toRgbValues(theme.sidebarText),
            'sidebar-text-active-border-rgb': toRgbValues(theme.sidebarTextActiveBorder),
            'sidebar-text-active-color-rgb': toRgbValues(theme.sidebarTextActiveColor),
            'sidebar-text-hover-bg-rgb': toRgbValues(theme.sidebarTextHoverBg),
            'sidebar-unread-text-rgb': toRgbValues(theme.sidebarUnreadText),

            // Hex CSS variables
            'sidebar-bg': theme.sidebarBg,
            'sidebar-text': theme.sidebarText,
            'sidebar-unread-text': theme.sidebarUnreadText,
            'sidebar-text-hover-bg': theme.sidebarTextHoverBg,
            'sidebar-text-active-border': theme.sidebarTextActiveBorder,
            'sidebar-text-active-color': theme.sidebarTextActiveColor,
            'sidebar-header-bg': theme.sidebarHeaderBg,
            'sidebar-teambar-bg': theme.sidebarTeamBarBg,
            'sidebar-header-text-color': theme.sidebarHeaderTextColor,
            'online-indicator': theme.onlineIndicator,
            'away-indicator': theme.awayIndicator,
            'dnd-indicator': theme.dndIndicator,
            'mention-bg': theme.mentionBg,
            'mention-color': theme.mentionColor,
            'center-channel-bg': theme.centerChannelBg,
            'center-channel-color': theme.centerChannelColor,
            'new-message-separator': theme.newMessageSeparator,
            'link-color': theme.linkColor,
            'button-bg': theme.buttonBg,
            'button-color': theme.buttonColor,
            'error-text': theme.errorTextColor,
            'mention-highlight-bg': theme.mentionHighlightBg,
            'mention-highlight-link': theme.mentionHighlightLink,

            // Legacy variables with baked in opacity, do not use!
            'sidebar-text-08': changeOpacity(theme.sidebarText, 0.08),
            'sidebar-text-16': changeOpacity(theme.sidebarText, 0.16),
            'sidebar-text-30': changeOpacity(theme.sidebarText, 0.3),
            'sidebar-text-40': changeOpacity(theme.sidebarText, 0.4),
            'sidebar-text-50': changeOpacity(theme.sidebarText, 0.5),
            'sidebar-text-60': changeOpacity(theme.sidebarText, 0.6),
            'sidebar-text-72': changeOpacity(theme.sidebarText, 0.72),
            'sidebar-text-80': changeOpacity(theme.sidebarText, 0.8),
            'sidebar-header-text-color-80': changeOpacity(theme.sidebarHeaderTextColor, 0.8),
            'center-channel-bg-88': changeOpacity(theme.centerChannelBg, 0.88),
            'center-channel-color-88': changeOpacity(theme.centerChannelColor, 0.88),
            'center-channel-bg-80': changeOpacity(theme.centerChannelBg, 0.8),
            'center-channel-color-80': changeOpacity(theme.centerChannelColor, 0.8),
            'center-channel-color-72': changeOpacity(theme.centerChannelColor, 0.72),
            'center-channel-bg-64': changeOpacity(theme.centerChannelBg, 0.64),
            'center-channel-color-64': changeOpacity(theme.centerChannelColor, 0.64),
            'center-channel-bg-56': changeOpacity(theme.centerChannelBg, 0.56),
            'center-channel-color-56': changeOpacity(theme.centerChannelColor, 0.56),
            'center-channel-color-48': changeOpacity(theme.centerChannelColor, 0.48),
            'center-channel-bg-40': changeOpacity(theme.centerChannelBg, 0.4),
            'center-channel-color-40': changeOpacity(theme.centerChannelColor, 0.4),
            'center-channel-bg-30': changeOpacity(theme.centerChannelBg, 0.3),
            'center-channel-color-32': changeOpacity(theme.centerChannelColor, 0.32),
            'center-channel-bg-20': changeOpacity(theme.centerChannelBg, 0.2),
            'center-channel-color-20': changeOpacity(theme.centerChannelColor, 0.2),
            'center-channel-bg-16': changeOpacity(theme.centerChannelBg, 0.16),
            'center-channel-color-24': changeOpacity(theme.centerChannelColor, 0.24),
            'center-channel-color-16': changeOpacity(theme.centerChannelColor, 0.16),
            'center-channel-bg-08': changeOpacity(theme.centerChannelBg, 0.08),
            'center-channel-color-08': changeOpacity(theme.centerChannelColor, 0.08),
            'center-channel-color-04': changeOpacity(theme.centerChannelColor, 0.04),
            'link-color-08': changeOpacity(theme.linkColor, 0.08),
            'button-bg-88': changeOpacity(theme.buttonBg, 0.88),
            'button-color-88': changeOpacity(theme.buttonColor, 0.88),
            'button-bg-80': changeOpacity(theme.buttonBg, 0.8),
            'button-color-80': changeOpacity(theme.buttonColor, 0.8),
            'button-bg-72': changeOpacity(theme.buttonBg, 0.72),
            'button-color-72': changeOpacity(theme.buttonColor, 0.72),
            'button-bg-64': changeOpacity(theme.buttonBg, 0.64),
            'button-color-64': changeOpacity(theme.buttonColor, 0.64),
            'button-bg-56': changeOpacity(theme.buttonBg, 0.56),
            'button-color-56': changeOpacity(theme.buttonColor, 0.56),
            'button-bg-48': changeOpacity(theme.buttonBg, 0.48),
            'button-color-48': changeOpacity(theme.buttonColor, 0.48),
            'button-bg-40': changeOpacity(theme.buttonBg, 0.4),
            'button-color-40': changeOpacity(theme.buttonColor, 0.4),
            'button-bg-30': changeOpacity(theme.buttonBg, 0.32),
            'button-color-32': changeOpacity(theme.buttonColor, 0.32),
            'button-bg-24': changeOpacity(theme.buttonBg, 0.24),
            'button-color-24': changeOpacity(theme.buttonColor, 0.24),
            'button-bg-16': changeOpacity(theme.buttonBg, 0.16),
            'button-color-16': changeOpacity(theme.buttonColor, 0.16),
            'button-bg-08': changeOpacity(theme.buttonBg, 0.08),
            'button-color-08': changeOpacity(theme.buttonColor, 0.08),
            'button-bg-04': changeOpacity(theme.buttonBg, 0.04),
            'button-color-04': changeOpacity(theme.buttonColor, 0.04),
            'error-text-08': changeOpacity(theme.errorTextColor, 0.08),
            'error-text-12': changeOpacity(theme.errorTextColor, 0.12),
        },
    });
}

export function resetTheme() {
    applyTheme(Preferences.THEMES.denim);
}

function changeCss(className: string, classValue: string) {
    let styleEl: HTMLStyleElement = document.querySelector('style[data-class="' + className + '"]')!;
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.setAttribute('data-class', className);

        // Append style element to head
        document.head.appendChild(styleEl);
    }

    // Grab style sheet
    const styleSheet = styleEl.sheet!;
    const rules: CSSRuleList = styleSheet.cssRules || styleSheet.rules;
    const style = classValue.substr(0, classValue.indexOf(':'));
    const value = classValue.substr(classValue.indexOf(':') + 1).replace(/!important[;]/g, '');
    const priority = (classValue.match(/!important/) ? 'important' : null);

    for (let i = 0; i < rules.length; i++) {
        if ((rules[i] as any).selectorText === className) {
            (rules[i] as any).style.setProperty(style, value, priority);
            return;
        }
    }

    let mediaQuery = '';
    if (className.indexOf('@media') >= 0) {
        mediaQuery = '}';
    }
    try {
        styleSheet.insertRule(className + '{' + classValue + '}' + mediaQuery, styleSheet.cssRules.length);
    } catch (e) {
        console.error(e); // eslint-disable-line no-console
    }
}

function updateCodeTheme(codeTheme: string) {
    let cssPath = '';
    Constants.THEME_ELEMENTS.forEach((element) => {
        if (element.id === 'codeTheme') {
            element.themes?.forEach((theme) => {
                if (codeTheme === theme.id) {
                    cssPath = theme.cssURL!;
                }
            });
        }
    });

    const link: HTMLLinkElement = document.querySelector('link.code_theme')!;
    if (link && cssPath !== (link.attributes as LinkHTMLAttributes<HTMLLinkElement>).href) {
        changeCss('code.hljs', 'visibility: hidden');

        const xmlHTTP = new XMLHttpRequest();

        xmlHTTP.open('GET', cssPath, true);
        xmlHTTP.onload = function onLoad() {
            link.href = cssPath;

            if (UserAgent.isFirefox()) {
                link.addEventListener('load', () => {
                    changeCss('code.hljs', 'visibility: visible');
                }, {once: true});
            } else {
                changeCss('code.hljs', 'visibility: visible');
            }
        };

        xmlHTTP.send();
    }
}

export function placeCaretAtEnd(el: HTMLInputElement | HTMLTextAreaElement) {
    el.focus();
    el.selectionStart = el.value.length;
    el.selectionEnd = el.value.length;
}

export function scrollToCaret(el: HTMLInputElement | HTMLTextAreaElement) {
    el.scrollTop = el.scrollHeight;
}

function createHtmlElement(el: keyof HTMLElementTagNameMap) {
    return document.createElement(el);
}

function getElementComputedStyle(el: Element) {
    return getComputedStyle(el);
}

function addElementToDocument(el: Node) {
    document.body.appendChild(el);
}

export function copyTextAreaToDiv(textArea: HTMLTextAreaElement) {
    if (!textArea) {
        return null;
    }
    const copy = createHtmlElement('div');
    copy.textContent = textArea.value;
    const style = getElementComputedStyle(textArea);
    [
        'fontFamily',
        'fontSize',
        'fontWeight',
        'wordWrap',
        'whiteSpace',
        'borderLeftWidth',
        'borderTopWidth',
        'borderRightWidth',
        'borderBottomWidth',
        'paddingRight',
        'paddingLeft',
        'paddingTop',
    ].forEach((key) => {
        copy.style[key as any] = style[key as any];
    });
    copy.style.overflow = 'auto';
    copy.style.width = textArea.offsetWidth + 'px';
    copy.style.height = textArea.offsetHeight + 'px';
    copy.style.position = 'absolute';
    copy.style.left = textArea.offsetLeft + 'px';
    copy.style.top = textArea.offsetTop + 'px';
    addElementToDocument(copy);
    return copy;
}

function convertEmToPixels(el: Element, remNum: number | any): number {
    if (isNaN(remNum)) {
        return 0;
    }
    const styles = getElementComputedStyle(el);
    return remNum * parseFloat(styles.fontSize);
}

export function getCaretXYCoordinate(textArea: HTMLTextAreaElement) {
    if (!textArea) {
        return {x: 0, y: 0};
    }
    const start = textArea.selectionStart;
    const end = textArea.selectionEnd;
    const copy = copyTextAreaToDiv(textArea);
    const range = document.createRange();
    range.setStart(copy!.firstChild!, start);
    range.setEnd(copy!.firstChild!, end);
    const selection = document.getSelection();
    selection!.removeAllRanges();
    selection!.addRange(range);
    const rect = range.getClientRects();
    document.body.removeChild(copy!);
    textArea.selectionStart = start;
    textArea.selectionEnd = end;
    textArea.focus();
    return {
        x: Math.floor(rect[0].left - textArea.scrollLeft),
        y: Math.floor(rect[0].top - textArea.scrollTop),
    };
}

export function getViewportSize(win?: Window) {
    const w = win || window;
    if (w.innerWidth != null) {
        return {w: w.innerWidth, h: w.innerHeight};
    }
    const {clientWidth, clientHeight} = w.document.body;
    return {w: clientWidth, h: clientHeight};
}

export function offsetTopLeft(el: HTMLElement) {
    if (!(el instanceof HTMLElement)) {
        return {top: 0, left: 0};
    }
    const rect = el.getBoundingClientRect();
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    return {top: rect.top + scrollTop, left: rect.left + scrollLeft};
}

export function getSuggestionBoxAlgn(textArea: HTMLTextAreaElement, pxToSubstract = 0, alignWithTextBox = false) {
    if (!textArea || !(textArea instanceof HTMLElement)) {
        return {
            pixelsToMoveX: 0,
            pixelsToMoveY: 0,
        };
    }

    const {x: caretXCoordinateInTxtArea, y: caretYCoordinateInTxtArea} = getCaretXYCoordinate(textArea);
    const {w: viewportWidth, h: viewportHeight} = getViewportSize();
    const {offsetWidth: textAreaWidth} = textArea;

    const suggestionBoxWidth = Math.min(textAreaWidth, Constants.SUGGESTION_LIST_MAXWIDTH);

    // value in pixels for the offsetLeft for the textArea
    const {top: txtAreaOffsetTop, left: txtAreaOffsetLft} = offsetTopLeft(textArea);

    // how many pixels to the right should be moved the suggestion box
    let pxToTheRight = (caretXCoordinateInTxtArea) - (pxToSubstract);

    // the x coordinate in the viewport of the suggestion box border-right
    const xBoxRightCoordinate = caretXCoordinateInTxtArea + txtAreaOffsetLft + suggestionBoxWidth;

    if (alignWithTextBox) {
        // when the list should be aligned with the textbox just set this value to 0
        pxToTheRight = 0;
    } else if (xBoxRightCoordinate > viewportWidth) {
        // if the right-border edge of the suggestion box will overflow the x-axis viewport
        // stick the suggestion list to the very right of the TextArea
        pxToTheRight = textAreaWidth - suggestionBoxWidth;
    }

    return {

        // The rough location of the caret in the textbox
        pixelsToMoveX: Math.max(0, Math.round(pxToTheRight)),
        pixelsToMoveY: Math.round(caretYCoordinateInTxtArea),

        // The line height of the textbox is needed so that the SuggestionList can adjust its position to be below the current line in the textbox
        lineHeight: Number(getComputedStyle(textArea)?.lineHeight.replace('px', '')),

        placementShift: txtAreaOffsetTop + caretYCoordinateInTxtArea + Constants.SUGGESTION_LIST_MAXHEIGHT > viewportHeight - Constants.POST_AREA_HEIGHT,
    };
}

export function getPxToSubstract(char = '@') {
    // depending on the triggering character different values must be substracted
    if (char === '@') {
    // mention name padding-left 2.4rem as stated in suggestion-list__content .suggestion-list__item
        const mentionNamePaddingLft = convertEmToPixels(document.documentElement, Constants.MENTION_NAME_PADDING_LEFT);

        // half of width of avatar stated in .Avatar.Avatar-sm (24px)
        const avatarWidth = Constants.AVATAR_WIDTH * 0.5;
        return 5 + avatarWidth + mentionNamePaddingLft;
    } else if (char === '~') {
        return 39;
    } else if (char === ':') {
        return 32;
    }
    return 0;
}

export function setSelectionRange(input: HTMLInputElement | HTMLTextAreaElement, selectionStart: number, selectionEnd: number) {
    input.focus();
    input.setSelectionRange(selectionStart, selectionEnd);
}

export function setCaretPosition(input: HTMLInputElement, pos: number) {
    if (!input) {
        return;
    }

    setSelectionRange(input, pos, pos);
}

export function isValidUsername(name: string) {
    let error;
    if (!name) {
        error = {
            id: ValidationErrors.USERNAME_REQUIRED,
        };
    } else if (name.length < Constants.MIN_USERNAME_LENGTH || name.length > Constants.MAX_USERNAME_LENGTH) {
        error = {
            id: ValidationErrors.INVALID_LENGTH,
        };
    } else if (!(/^[a-z0-9.\-_]+$/).test(name)) {
        error = {
            id: ValidationErrors.INVALID_CHARACTERS,
        };
    } else if (!(/[a-z]/).test(name.charAt(0))) { //eslint-disable-line no-negated-condition
        error = {
            id: ValidationErrors.INVALID_FIRST_CHARACTER,
        };
    } else {
        for (const reserved of Constants.RESERVED_USERNAMES) {
            if (name === reserved) {
                error = {
                    id: ValidationErrors.RESERVED_NAME,
                };
                break;
            }
        }
    }

    return error;
}

export function isValidBotUsername(name: string) {
    let error = isValidUsername(name);
    if (error) {
        return error;
    }

    if (name.endsWith('.')) {
        error = {
            id: ValidationErrors.INVALID_LAST_CHARACTER,
        };
    }

    return error;
}

export function loadImage(
    url: string,
    onLoad: ((this: XMLHttpRequest, ev: ProgressEvent) => any) | null,
    onProgress?: (completedPercentage: number) => any | null,
) {
    const request = new XMLHttpRequest();

    request.open('GET', url, true);
    request.responseType = 'arraybuffer';
    request.onload = onLoad;
    request.onprogress = (e) => {
        if (onProgress) {
            let total = 0;
            if (e.lengthComputable) {
                total = e.total;
            } else {
                total = parseInt((e.target as any).getResponseHeader('X-Uncompressed-Content-Length'), 10);
            }

            const completedPercentage = Math.round((e.loaded / total) * 100);

            (onProgress as any)(completedPercentage);
        }
    };

    request.send();
}

function changeColor(colourIn: string, amt: number): string {
    let hex = colourIn;
    let lum = amt;

    // validate hex string
    hex = String(hex).replace(/[^0-9a-f]/gi, '');
    if (hex.length < 6) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    lum = lum || 0;

    // convert to decimal and change luminosity
    let rgb = '#';
    let c;
    let i;
    for (i = 0; i < 3; i++) {
        c = parseInt(hex.substr(i * 2, 2), 16);
        c = Math.round(Math.min(Math.max(0, c + (c * lum)), 255)).toString(16);
        rgb += ('00' + c).substr(c.length);
    }

    return rgb;
}

export function getFullName(user: UserProfile) {
    if (user.first_name && user.last_name) {
        return user.first_name + ' ' + user.last_name;
    } else if (user.first_name) {
        return user.first_name;
    } else if (user.last_name) {
        return user.last_name;
    }

    return '';
}

export function getDisplayName(user: UserProfile) {
    if (user.nickname && user.nickname.trim().length > 0) {
        return user.nickname;
    }
    const fullName = getFullName(user);

    if (fullName) {
        return fullName;
    }

    return user.username;
}

export function getLongDisplayName(user: UserProfile) {
    let displayName = '@' + user.username;
    const fullName = getFullName(user);
    if (fullName) {
        displayName = displayName + ' - ' + fullName;
    }
    if (user.nickname && user.nickname.trim().length > 0) {
        displayName = displayName + ' (' + user.nickname + ')';
    }

    if (user.position && user.position.trim().length > 0) {
        displayName = displayName + ' -' + user.position;
    }

    return displayName;
}

export function getLongDisplayNameParts(user: UserProfile) {
    return {
        displayName: '@' + user.username,
        fullName: getFullName(user),
        nickname: user.nickname && user.nickname.trim() ? user.nickname : null,
        position: user.position && user.position.trim() ? user.position : null,
    };
}

/**
 * Gets the display name of the specified user, respecting the TeammateNameDisplay configuration setting
 */
export function getDisplayNameByUser(state: GlobalState, user?: UserProfile) {
    const teammateNameDisplay = getTeammateNameDisplaySetting(state);
    if (user) {
        return displayUsername(user, teammateNameDisplay);
    }

    return '';
}

/**
 * Gets the entire name, including username, full name, and nickname, of the specified user
 */
export function displayEntireNameForUser(user: UserProfile): React.ReactNode {
    if (!user) {
        return '';
    }

    let displayName: React.ReactNode = '';
    const fullName = getFullName(user);

    if (fullName) {
        displayName = ' - ' + fullName;
    }

    if (user.nickname) {
        displayName = displayName + ' (' + user.nickname + ')';
    }

    if (user.position) {
        displayName = displayName + ' - ' + user.position;
    }

    displayName = (
        <span id={'displayedUserName' + user.username}>
            {'@' + user.username}
            <span className='light'>{displayName}</span>
        </span>
    );

    return displayName;
}

/**
 * Gets the full name and nickname of the specified user
 */
export function displayFullAndNicknameForUser(user: UserProfile) {
    if (!user) {
        return '';
    }

    let displayName;
    const fullName = getFullName(user);

    if (fullName && user.nickname) {
        displayName = (
            <span className='light'>{fullName + ' (' + user.nickname + ')'}</span>
        );
    } else if (fullName) {
        displayName = (
            <span className='light'>{fullName}</span>
        );
    } else if (user.nickname) {
        displayName = (
            <span className='light'>{'(' + user.nickname + ')'}</span>
        );
    }

    return displayName;
}

export function imageURLForUser(userId: UserProfile['id'], lastPictureUpdate = 0) {
    return Client4.getUsersRoute() + '/' + userId + '/image?_=' + lastPictureUpdate;
}

export function defaultImageURLForUser(userId: UserProfile['id']) {
    return Client4.getUsersRoute() + '/' + userId + '/image/default';
}

// in contrast to Client4.getTeamIconUrl, for ui logic this function returns null if last_team_icon_update is unset
export function imageURLForTeam(team: Team & {last_team_icon_update?: number}) {
    return team.last_team_icon_update ? Client4.getTeamIconUrl(team.id, team.last_team_icon_update) : null;
}

// Converts a file size in bytes into a human-readable string of the form '123MB'.
export function fileSizeToString(bytes: number) {
    // it's unlikely that we'll have files bigger than this
    if (bytes > 1024 ** 4) {
        // check if file is smaller than 10 to display fractions
        if (bytes < (1024 ** 4) * 10) {
            return (Math.round((bytes / (1024 ** 4)) * 10) / 10) + 'TB';
        }
        return Math.round(bytes / (1024 ** 4)) + 'TB';
    } else if (bytes > 1024 ** 3) {
        if (bytes < (1024 ** 3) * 10) {
            return (Math.round((bytes / (1024 ** 3)) * 10) / 10) + 'GB';
        }
        return Math.round(bytes / (1024 ** 3)) + 'GB';
    } else if (bytes > 1024 ** 2) {
        if (bytes < (1024 ** 2) * 10) {
            return (Math.round((bytes / (1024 ** 2)) * 10) / 10) + 'MB';
        }
        return Math.round(bytes / (1024 ** 2)) + 'MB';
    } else if (bytes > 1024) {
        return Math.round(bytes / 1024) + 'KB';
    }
    return bytes + 'B';
}

// Generates a RFC-4122 version 4 compliant globally unique identifier.
export function generateId() {
    // implementation taken from http://stackoverflow.com/a/2117523
    let id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';

    id = id.replace(/[xy]/g, (c) => {
        const r = Math.floor(Math.random() * 16);

        let v;
        if (c === 'x') {
            v = r;
        } else {
            v = (r & 0x3) | 0x8;
        }

        return v.toString(16);
    });

    return id;
}

export function getDirectChannelName(id: string, otherId: string): string {
    let handle;

    if (otherId > id) {
        handle = id + '__' + otherId;
    } else {
        handle = otherId + '__' + id;
    }

    return handle;
}

// Used to get the id of the other user from a DM channel
export function getUserIdFromChannelName(channel: Channel) {
    return getUserIdFromChannelId(channel.name);
}

// Used to get the id of the other user from a DM channel id (id1_id2)
export function getUserIdFromChannelId(channelId: Channel['id'], currentUserId = getCurrentUserId(store.getState())) {
    const ids = channelId.split('__');
    let otherUserId = '';
    if (ids[0] === currentUserId) {
        otherUserId = ids[1];
    } else {
        otherUserId = ids[0];
    }

    return otherUserId;
}

// Should be refactored, seems to make most sense to wrap TextboxLinks in a connect(). To discuss
export function isFeatureEnabled(feature: {label: string}, state: GlobalState) {
    return getBool(state, Constants.Preferences.CATEGORY_ADVANCED_SETTINGS, Constants.FeatureTogglePrefix + feature.label);
}

export function fillRecord<T>(value: T, length: number): Record<number, T> {
    const arr: Record<number, T> = {};

    for (let i = 0; i < length; i++) {
        arr[i] = value;
    }

    return arr;
}

// Checks if a data transfer contains files not text, folders, etc..
// Slightly modified from http://stackoverflow.com/questions/6848043/how-do-i-detect-a-file-is-being-dragged-rather-than-a-draggable-element-on-my-pa
export function isFileTransfer(files: DataTransfer) {
    if (UserAgent.isInternetExplorer() || UserAgent.isEdge()) {
        return files.types != null && files.types.includes('Files');
    }

    return files.types != null && (files.types.indexOf ? files.types.indexOf('Files') !== -1 : files.types.includes('application/x-moz-file'));
}

export function isUriDrop(dataTransfer: DataTransfer) {
    if (UserAgent.isInternetExplorer() || UserAgent.isEdge() || UserAgent.isSafari()) {
        for (let i = 0; i < dataTransfer.items.length; i++) {
            if (dataTransfer.items[i].type === 'text/uri-list') {
                return true;
            }
        }
    }
    return false; // we don't care about others, they handle as we want it
}

export function isTextTransfer(dataTransfer: DataTransfer) {
    return ['text/plain', 'text/unicode', 'Text'].some((type) => dataTransfer.types.includes(type));
}

export function isTextDroppableEvent(e: Event) {
    return (e instanceof DragEvent) &&
           (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) &&
           e.dataTransfer !== null &&
           isTextTransfer(e.dataTransfer);
}

export function clearFileInput(elm: HTMLInputElement) {
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

export function localizeMessage(id: string, defaultMessage?: string) {
    const state = store.getState();

    const locale = getCurrentLocale(state);
    const translations = getTranslations(state, locale);

    if (!translations || !(id in translations)) {
        return defaultMessage || id;
    }

    return translations[id];
}

/**
 * @deprecated If possible, use intl.formatMessage instead. If you have to use this, remember to mark the id using `t`
 */
export function localizeAndFormatMessage(id: string, defaultMessage: string, template: { [name: string]: any } | undefined) {
    const base = localizeMessage(id, defaultMessage);

    if (!template) {
        return base;
    }

    return base.replace(/{[\w]+}/g, (match) => {
        const key = match.substr(1, match.length - 2);
        return template[key] || match;
    });
}

export function mod(a: number, b: number): number {
    return ((a % b) + b) % b;
}

export const REACTION_PATTERN = /^(\+|-):([^:\s]+):\s*$/;

export function getPasswordConfig(config: Partial<ClientConfig>) {
    return {
        minimumLength: parseInt(config.PasswordMinimumLength!, 10),
        requireLowercase: config.PasswordRequireLowercase === 'true',
        requireUppercase: config.PasswordRequireUppercase === 'true',
        requireNumber: config.PasswordRequireNumber === 'true',
        requireSymbol: config.PasswordRequireSymbol === 'true',
    };
}

export function isValidPassword(password: string, passwordConfig: ReturnType<typeof getPasswordConfig>, intl?: IntlShape) {
    let errorId = t('user.settings.security.passwordError');
    const telemetryErrorIds = [];
    let valid = true;
    const minimumLength = passwordConfig.minimumLength || Constants.MIN_PASSWORD_LENGTH;

    if (password.length < minimumLength || password.length > Constants.MAX_PASSWORD_LENGTH) {
        valid = false;
        telemetryErrorIds.push({field: 'password', rule: 'error_length'});
    }

    if (passwordConfig.requireLowercase) {
        if (!password.match(/[a-z]/)) {
            valid = false;
        }

        errorId += 'Lowercase';
        telemetryErrorIds.push({field: 'password', rule: 'lowercase'});
    }

    if (passwordConfig.requireUppercase) {
        if (!password.match(/[A-Z]/)) {
            valid = false;
        }

        errorId += 'Uppercase';
        telemetryErrorIds.push({field: 'password', rule: 'uppercase'});
    }

    if (passwordConfig.requireNumber) {
        if (!password.match(/[0-9]/)) {
            valid = false;
        }

        errorId += 'Number';
        telemetryErrorIds.push({field: 'password', rule: 'number'});
    }

    if (passwordConfig.requireSymbol) {
        if (!password.match(/[ !"\\#$%&'()*+,-./:;<=>?@[\]^_`|~]/)) {
            valid = false;
        }

        errorId += 'Symbol';
        telemetryErrorIds.push({field: 'password', rule: 'symbol'});
    }

    let error;
    if (!valid) {
        error = intl ? (
            intl.formatMessage(
                {
                    id: errorId,
                    defaultMessage: 'Must be {min}-{max} characters long.',
                },
                {
                    min: minimumLength,
                    max: Constants.MAX_PASSWORD_LENGTH,
                },
            )
        ) : (
            <FormattedMessage
                id={errorId}
                defaultMessage='Must be {min}-{max} characters long.'
                values={{
                    min: minimumLength,
                    max: Constants.MAX_PASSWORD_LENGTH,
                }}
            />
        );
    }

    return {valid, error, telemetryErrorIds};
}

function isChannelOrPermalink(link: string) {
    let match = (/\/([^/]+)\/channels\/(\S+)/).exec(link);
    if (match) {
        return {
            type: 'channel',
            teamName: match[1],
            channelName: match[2],
        };
    }
    match = (/\/([^/]+)\/pl\/(\w+)/).exec(link);
    if (match) {
        return {
            type: 'permalink',
            teamName: match[1],
            postId: match[2],
        };
    }
    return match;
}

export async function handleFormattedTextClick(e: React.MouseEvent, currentRelativeTeamUrl = '') {
    const hashtagAttribute = (e.target as any).getAttributeNode('data-hashtag');
    const linkAttribute = (e.target as any).getAttributeNode('data-link');
    const channelMentionAttribute = (e.target as any).getAttributeNode('data-channel-mention');

    if (hashtagAttribute) {
        e.preventDefault();

        store.dispatch(searchForTerm(hashtagAttribute.value));
    } else if (linkAttribute) {
        const MIDDLE_MOUSE_BUTTON = 1;

        if (!(e.button === MIDDLE_MOUSE_BUTTON || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey)) {
            e.preventDefault();

            const state = store.getState();
            const user = getCurrentUser(state);
            const match = isChannelOrPermalink(linkAttribute.value);
            const crtEnabled = isCollapsedThreadsEnabled(state);

            let isReply = false;

            if (isSystemAdmin(user.roles)) {
                if (match) {
                    // Get team by name
                    const {teamName} = match;
                    let team = getTeamByName(state, teamName);
                    if (!team) {
                        const {data: teamData} = await store.dispatch(getTeamByNameAction(teamName));
                        team = teamData;
                    }
                    if (team && team.delete_at === 0) {
                        let channel;

                        // Handle channel url - Get channel data from channel name
                        if (match.type === 'channel') {
                            const {channelName} = match;
                            channel = getChannelsNameMapInTeam(state, team.id)[channelName as string];
                            if (!channel) {
                                const {data: channelData} = await store.dispatch(getChannelByNameAndTeamName(teamName, channelName!, true));
                                channel = channelData;
                            }
                        } else { // Handle permalink - Get channel data from post
                            const {postId} = match;
                            let post = getPost(state, postId!);
                            if (!post) {
                                const {data: postData} = await store.dispatch(getPostAction(match.postId!));
                                post = postData;
                            }
                            if (post) {
                                isReply = Boolean(post.root_id);

                                channel = getChannel(state, post.channel_id);
                                if (!channel) {
                                    const {data: channelData} = await store.dispatch(getChannelAction(post.channel_id));
                                    channel = channelData;
                                }
                            }
                        }
                        if (channel && channel.type === Constants.PRIVATE_CHANNEL) {
                            let member = getMyChannelMemberships(state)[channel.id];
                            if (!member) {
                                const membership = await store.dispatch(getChannelMember(channel.id, getCurrentUserId(state)));
                                if ('data' in membership) {
                                    member = membership.data;
                                }
                            }
                            if (!member) {
                                const {data} = await store.dispatch(joinPrivateChannelPrompt(team, channel, false));
                                if (data.join) {
                                    let error = false;
                                    if (!getTeamMemberships(state)[team.id]) {
                                        const joinTeamResult = await store.dispatch(addUserToTeam(team.id, user.id));
                                        error = joinTeamResult.error;
                                    }
                                    if (!error) {
                                        await store.dispatch(joinChannel(user.id, team.id, channel.id, channel.name));
                                    }
                                } else {
                                    return;
                                }
                            }
                        }
                    }
                }
            }

            e.stopPropagation();

            if (match && match.type === 'permalink' && isTeamSameWithCurrentTeam(state, match.teamName) && isReply && crtEnabled) {
                focusPost(match.postId ?? '', linkAttribute.value, user.id, {skipRedirectReplyPermalink: true})(store.dispatch, store.getState);
            } else {
                getHistory().push(linkAttribute.value);
            }
        }
    } else if (channelMentionAttribute) {
        e.preventDefault();
        getHistory().push(currentRelativeTeamUrl + '/channels/' + channelMentionAttribute.value);
    }
}

export function isEmptyObject(object: any) {
    if (!object) {
        return true;
    }

    if (Object.keys(object).length === 0) {
        return true;
    }

    return false;
}

export function removePrefixFromLocalStorage(prefix: string) {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
        if (localStorage.key(i)!.startsWith(prefix)) {
            keys.push(localStorage.key(i));
        }
    }

    for (let i = 0; i < keys.length; i++) {
        localStorage.removeItem(keys[i]!);
    }
}

export function copyToClipboard(data: string) {
    // Attempt to use the newer clipboard API when possible
    const clipboard = navigator.clipboard;
    if (clipboard) {
        clipboard.writeText(data);
        return;
    }

    // creates a tiny temporary text area to copy text out of
    // see https://stackoverflow.com/a/30810322/591374 for details
    const textArea = document.createElement('textarea');
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    textArea.value = data;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
}

export function moveCursorToEnd(e: React.MouseEvent | React.FocusEvent) {
    const val = (e.target as any).value;
    if (val.length) {
        (e.target as any).value = '';
        (e.target as any).value = val;
    }
}

export function setCSRFFromCookie() {
    if (typeof document !== 'undefined' && typeof document.cookie !== 'undefined') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.startsWith('MMCSRF=')) {
                Client4.setCSRF(cookie.replace('MMCSRF=', ''));
                break;
            }
        }
    }
}

export function getNextBillingDate() {
    const nextBillingDate = moment().add(1, 'months').startOf('month');
    return nextBillingDate.format('MMM D, YYYY');
}

export function stringToNumber(s: string | undefined) {
    if (!s) {
        return 0;
    }

    return parseInt(s, 10);
}

export function deleteKeysFromObject(value: Record<string, any>, keys: string[]) {
    for (const key of keys) {
        delete value[key];
    }
    return value;
}

function isSelection() {
    const selection = window.getSelection();
    return selection!.type === 'Range';
}

export function isTextSelectedInPostOrReply(e: React.KeyboardEvent | KeyboardEvent) {
    const {id} = e.target as HTMLElement;

    const isTypingInPost = id === 'post_textbox';
    const isTypingInReply = id === 'reply_textbox';

    if (!isTypingInPost && !isTypingInReply) {
        return false;
    }

    const {
        selectionStart,
        selectionEnd,
    } = e.target as TextboxElement;

    const hasSelection = !isNil(selectionStart) && !isNil(selectionEnd) && selectionStart < selectionEnd;

    return hasSelection;
}

/*
 * Returns false when the element clicked or its ancestors
 * is a potential click target (link, button, image, etc..)
 * but not the events currentTarget
 * and true in any other case.
 *
 * @param {string} selector - CSS selector of elements not eligible for click
 * @returns {function}
 */
export function makeIsEligibleForClick(selector = '') {
    return (event: React.MouseEvent) => {
        const currentTarget = event.currentTarget;
        let node: HTMLElement = event.target as HTMLElement;

        if (isSelection()) {
            return false;
        }

        if (node === currentTarget) {
            return true;
        }

        // in the case of a react Portal
        if (!currentTarget.contains(node)) {
            return false;
        }

        // traverses the targets parents up to currentTarget to see
        // if any of them is a potentially clickable element
        while (node) {
            if (!node || node === currentTarget) {
                break;
            }

            if (
                CLICKABLE_ELEMENTS.includes(node.tagName.toLowerCase()) ||
                node.getAttribute('role') === 'button' ||
                (selector && node.matches(selector))
            ) {
                return false;
            }

            node = node.parentNode! as HTMLElement;
        }

        return true;
    };
}

// Returns the minimal number of zeroes needed to render a number,
// up to the given number of places.
// e.g.
// numberToFixedDynamic(3.12345, 4) -> 3.1235
// numberToFixedDynamic(3.01000, 4) -> 3.01
// numberToFixedDynamic(3.01000, 1) -> 3
export function numberToFixedDynamic(num: number, places: number): string {
    const str = num.toFixed(Math.max(places, 0));
    if (!str.includes('.')) {
        return str;
    }
    let indexToExclude = -1;
    let i = str.length - 1;
    while (str[i] === '0') {
        indexToExclude = i;
        i -= 1;
    }
    if (str[i] === '.') {
        indexToExclude -= 1;
    }
    if (indexToExclude === -1) {
        return str;
    }
    return str.slice(0, indexToExclude);
}

const TrackFlowRoles: Record<string, string> = {
    fa: Constants.FIRST_ADMIN_ROLE,
    sa: General.SYSTEM_ADMIN_ROLE,
    su: General.SYSTEM_USER_ROLE,
};

export function getTrackFlowRole() {
    const state = store.getState();
    let trackFlowRole = 'su';

    if (isFirstAdmin(state)) {
        trackFlowRole = 'fa';
    } else if (isSystemAdmin(getCurrentUser(state).roles)) {
        trackFlowRole = 'sa';
    }

    return trackFlowRole;
}

export function getRoleForTrackFlow() {
    const startedByRole = TrackFlowRoles[getTrackFlowRole()];

    return {started_by_role: startedByRole};
}

export function getSbr() {
    const params = new URLSearchParams(window.location.search);
    const sbr = params.get('sbr') ?? '';
    return sbr;
}

export function getRoleFromTrackFlow() {
    const sbr = getSbr();
    const startedByRole = TrackFlowRoles[sbr] ?? '';

    return {started_by_role: startedByRole};
}

export function getDatePickerLocalesForDateFns(locale: string, loadedLocales: Record<string, Locale>) {
    if (locale && locale !== 'en' && !loadedLocales[locale]) {
        try {
            /* eslint-disable global-require */
            loadedLocales[locale] = require(`date-fns/locale/${locale}/index.js`);
            /* eslint-disable global-require */
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }
    }

    return loadedLocales;
}

export function getMediumFromTrackFlow() {
    const params = new URLSearchParams(window.location.search);
    const source = params.get('md') ?? '';

    return {source};
}

const TrackFlowSources: Record<string, string> = {
    wd: 'webapp-desktop',
    wm: 'webapp-mobile',
    d: 'desktop-app',
};

function getTrackFlowSource() {
    if (UserAgent.isMobile()) {
        return TrackFlowSources.wm;
    } else if (UserAgent.isDesktopApp()) {
        return TrackFlowSources.d;
    }
    return TrackFlowSources.wd;
}

export function getSourceForTrackFlow() {
    return {source: getTrackFlowSource()};
}

export function a11yFocus(element: HTMLElement | null | undefined, keyboardOnly = true) {
    document.dispatchEvent(new CustomEvent<A11yFocusEventDetail>(
        A11yCustomEventTypes.FOCUS, {
            detail: {
                target: element,
                keyboardOnly,
            },
        },
    ));
}

export function getBlankAddressWithCountry(country?: string): Address {
    let c = '';
    if (country) {
        c = getName(country) || '';
    }
    return {
        city: '',
        country: c || '',
        line1: '',
        line2: '',
        postal_code: '',
        state: '',
    };
}
