// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PostAction} from './integration_actions';

export type MessageAttachment = {
    id: number;
    fallback: string;
    color: string;
    pretext: string;
    author_name: string;
    author_link: string;
    author_icon: string;
    title: string;
    title_link: string;
    text: string;
    fields: MessageAttachmentField[];
    image_url: string;
    thumb_url: string;
    footer: string;
    footer_icon: string;
    timestamp: number | string;
    actions?: PostAction[];
};

export type MessageAttachmentField = {
    title: string;
    value: any;
    short: boolean;
}
