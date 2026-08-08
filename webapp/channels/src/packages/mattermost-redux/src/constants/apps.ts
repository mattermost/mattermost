// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AppCallResponseType, AppFieldType} from '@mattermost/types/apps';

export const AppBindingLocations = {
    POST_MENU_ITEM: '/post_menu',
    CHANNEL_HEADER_ICON: '/channel_header',
    APP_BAR: '/app_bar',
    COMMAND: '/command',
    IN_POST: '/in_post',
    MARKETPLACE: '/marketplace',
};

export const AppCallResponseTypes: {[name: string]: AppCallResponseType} = {
    OK: 'ok',
    ERROR: 'error',
    FORM: 'form',
    CALL: 'call',
    NAVIGATE: 'navigate',
};

export const AppFieldTypes: {[name: string]: AppFieldType} = {
    TEXT: 'text',
    STATIC_SELECT: 'static_select',
    DYNAMIC_SELECT: 'dynamic_select',
    BOOL: 'bool',
    USER: 'user',
    CHANNEL: 'channel',
    MARKDOWN: 'markdown',
    RADIO: 'radio',
    DATE: 'date',
    DATETIME: 'datetime',
    FILE: 'file',
    ACTION_BUTTON: 'action_button',
};
