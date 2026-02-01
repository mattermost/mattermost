// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {SharedProvider} from '@mattermost/shared/context';
import type {Emoji} from '@mattermost/types/emojis';

import {getEmojiImageUrl} from 'mattermost-redux/utils/emoji_utils';

export interface SharedPackageProviderProps {
    children: React.ReactNode;
}

export default function SharedPackageProvider({children}: SharedPackageProviderProps) {
    return (
        <SharedProvider useEmojiUrl={useEmojiUrl}>
            {children}
        </SharedProvider>
    );
}

function useEmojiUrl(emoji?: Emoji) {
    if (!emoji) {
        return '';
    }

    return getEmojiImageUrl(emoji);
}
