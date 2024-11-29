// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {isArrayOf} from './utilities';

export type PostAction = {
    id: string;
    type?: string;
    name: string;
    disabled?: boolean;
    style?: string;
    data_source?: string;
    options?: PostActionOption[];
    default_option?: string;
    cookie?: string;
};

export function isPostAction(v: unknown): v is PostAction {
    if (typeof v !== 'object' || !v) {
        return false;
    }

    if (!('id' in v)) {
        return false;
    }

    if (typeof v.id !== 'string') {
        return false;
    }

    if (!('name' in v)) {
        return false;
    }

    if (typeof v.name !== 'string') {
        return false;
    }

    if ('type' in v && typeof v.type !== 'string') {
        return false;
    }

    if ('disabled' in v && typeof v.disabled !== 'boolean') {
        return false;
    }

    if ('style' in v && typeof v.style !== 'string') {
        return false;
    }

    if ('data_source' in v && typeof v.data_source !== 'string') {
        return false;
    }

    if ('options' in v && !isArrayOf(v.options, isPostActionOption)) {
        return false;
    }

    if ('default_option' in v && typeof v.default_option !== 'string') {
        return false;
    }

    if ('cookie' in v && typeof v.cookie !== 'string') {
        return false;
    }

    return true;
}

export type PostActionOption = {
    text: string;
    value: string;
};

function isPostActionOption(v: unknown): v is PostActionOption {
    if (typeof v !== 'object' || !v) {
        return false;
    }

    if ('text' in v && typeof v.text !== 'string') {
        return false;
    }

    if ('value' in v && typeof v.value !== 'string') {
        return false;
    }

    return true;
}

export type PostActionResponse = {
    status: string;
    trigger_id: string;
};
