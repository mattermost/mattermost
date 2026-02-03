// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import {SharedProvider} from '@mattermost/shared/context';
import type {Emoji} from '@mattermost/types/emojis';

import {getEmojiImageUrl} from 'mattermost-redux/utils/emoji_utils';

import {getEmojiMap} from 'selectors/emojis';

import type {GlobalState} from 'types/store';

export interface SharedPackageProviderProps {
    children: React.ReactNode;
}

export default function SharedPackageProvider({children}: SharedPackageProviderProps) {
    return (
        <SharedProvider
            useEmojiByName={useEmojiByName}
            useEmojiUrl={useEmojiUrl}
        >
            {children}
        </SharedProvider>
    );
}

function useEmojiByName(name: string) {
    // This isn't defined for use elsewhere because makeUseEntity currently needs additional logic for handling emojis
    const emojiMap = useSelector((state: GlobalState) => getEmojiMap(state));

    if (!name) {
        return undefined;
    }

    return emojiMap.get(name);
}

function useEmojiUrl(emoji?: Emoji) {
    if (!emoji) {
        return '';
    }

    return getEmojiImageUrl(emoji);
}
