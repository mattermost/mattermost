// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';

import {isSystemEmoji, type Emoji} from '@mattermost/types/emojis';

import {SharedProvider, type SharedProviderProps} from '../context/context';

export function useMockSharedContext({
    useEmojiUrl,
}: Partial<Omit<SharedProviderProps, 'children'>>) {
    const propsWithOverrides = useMemo(() => {
        return {
            useEmojiUrl: useEmojiUrl ?? ((emoji?: Emoji) => {
                // This doesn't 100% follow getEmojiImageUrl, but it's close enough for testing
                if (!emoji) {
                    return '';
                }

                if (isSystemEmoji(emoji)) {
                    return `https://mattermost.example.com/static/emoji/${emoji.unified}.png`;
                }

                return `https://mattermost.example.com/api/v4/emojis/${emoji.id}`;
            }),
        };
    }, [useEmojiUrl]);

    const SharedContextProvider = useCallback(({children}: Pick<SharedProviderProps, 'children'>) => {
        return (
            <SharedProvider {...propsWithOverrides}>
                {children}
            </SharedProvider>
        );
    }, [propsWithOverrides]);

    return {SharedContextProvider};
}
