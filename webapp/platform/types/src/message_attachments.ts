// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {isPostAction, type PostAction} from './integration_actions';
import {isArrayOf} from './utilities';

export type MessageAttachment = {
    fallback?: string;
    color?: string;
    pretext?: string;
    author_name?: string;
    author_link?: string;
    author_icon?: string;
    title?: string;
    title_link?: string;
    text?: string;
    fields?: MessageAttachmentField[] | null;
    image_url?: string;
    thumb_url?: string;
    footer?: string;
    footer_icon?: string;
    actions?: PostAction[];
};

export function isMessageAttachmentArray(v: unknown): v is MessageAttachment[] {
    return isArrayOf(v, isMessageAttachment);
}

function isMessageAttachment(v: unknown): v is MessageAttachment {
    if (typeof v !== 'object' || !v) {
        return false;
    }

    if ('fallback' in v && typeof v.fallback !== 'string') {
        return false;
    }

    // We may consider adding more validation to what color may be
    if ('color' in v && typeof v.color !== 'string') {
        return false;
    }

    if ('pretext' in v && typeof v.pretext !== 'string') {
        return false;
    }

    if ('author_name' in v && typeof v.author_name !== 'string') {
        return false;
    }

    // Where it is used, we are calling isUrlSafe. We could consider calling it here
    if ('author_link' in v && typeof v.author_link !== 'string') {
        return false;
    }

    // We may need more validation since this is going to be passed to an img src prop
    if ('author_icon' in v && typeof v.author_icon !== 'string') {
        return false;
    }

    if ('title' in v && typeof v.title !== 'string') {
        return false;
    }

    // Where it is used, we are calling isUrlSafe. We could consider calling it here
    if ('title_link' in v && typeof v.title_link !== 'string') {
        return false;
    }

    if ('text' in v && typeof v.text !== 'string') {
        return false;
    }

    // We may need more validation since this is going to be passed to an img src prop
    if ('image_url' in v && typeof v.image_url !== 'string') {
        return false;
    }

    // We may need more validation since this is going to be passed to an img src prop
    if ('thumb_url' in v && typeof v.thumb_url !== 'string') {
        return false;
    }

    // We are truncating if the size is more than some constant. We could check this here
    if ('footer' in v && typeof v.footer !== 'string') {
        return false;
    }

    // We may need more validation since this is going to be passed to an img src prop
    if ('footer_icon' in v && typeof v.footer_icon !== 'string') {
        return false;
    }

    if ('fields' in v && v.fields !== null && !isArrayOf(v.fields, isMessageAttachmentField)) {
        return false;
    }

    if ('actions' in v && !isArrayOf(v.actions, isPostAction)) {
        return false;
    }

    return true;
}

export type MessageAttachmentField = {
    title: string;
    value: any;
    short?: boolean;
}

function isMessageAttachmentField(v: unknown) {
    if (typeof v !== 'object') {
        return false;
    }

    if (!v) {
        return false;
    }

    if (!('title' in v)) {
        return false;
    }

    if (typeof v.title !== 'string') {
        return false;
    }

    if (!('value' in v)) {
        return false;
    }

    if (typeof v.value === 'object' && v.value && 'toString' in v.value && typeof v.value.toString !== 'function') {
        return false;
    }

    if ('short' in v && typeof v.short !== 'boolean') {
        return false;
    }

    return true;
}
