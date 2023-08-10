// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import * as Markdown from 'utils/markdown';
import {getSiteURL} from 'utils/url';

import type EmojiMap from 'utils/emoji_map';

type Props = {
    id: string;
    value: string;
    emojiMap: EmojiMap;
}

export default function DialogIntroductionText({id, value, emojiMap}: Props): JSX.Element {
    const formattedMessage = Markdown.format(
        value,
        {
            breaks: true,
            sanitize: true,
            gfm: true,
            siteURL: getSiteURL(),
        },
        emojiMap,
    );

    return (
        <span
            id={id}
            dangerouslySetInnerHTML={{__html: formattedMessage}}
        />
    );
}
