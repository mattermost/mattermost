// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef, useCallback} from 'react';
import {useSelector, useDispatch} from 'react-redux';

import type {Wiki} from '@mattermost/types/wikis';

import {getChannelWikis} from 'selectors/pages';
import {loadChannelWikis} from 'actions/pages';

import type {GlobalState} from 'types/store';

import WikiTab from './wiki_tab';
import WikiCreateButton from './wiki_create_button';
import './channel_tab_bar.scss';

interface Props {
    channelId: string;
}

function ChannelTabBar({channelId}: Props) {
    const dispatch = useDispatch();
    const tabRefs = useRef<{[key: string]: HTMLDivElement | null}>({});
    const wikis = useSelector((state: GlobalState) => getChannelWikis(state, channelId));

    useEffect(() => {
        dispatch(loadChannelWikis(channelId));
    }, [dispatch, channelId]);

    // Keyboard navigation for tabs (arrow keys)
    const handleKeyDown = useCallback((event: React.KeyboardEvent, currentIndex: number) => {
        if (event.key === 'ArrowLeft' && currentIndex > 0) {
            const prevId = wikis[currentIndex - 1]?.id;
            if (prevId && tabRefs.current[prevId]) {
                tabRefs.current[prevId]?.focus();
            }
        } else if (event.key === 'ArrowRight' && currentIndex < wikis.length - 1) {
            const nextId = wikis[currentIndex + 1]?.id;
            if (nextId && tabRefs.current[nextId]) {
                tabRefs.current[nextId]?.focus();
            }
        }
    }, [wikis]);

    return (
        <div
            className='channel-tab-bar-container'
            data-testid='channel-tab-bar-container'
            role='tablist'
            aria-label='Channel tabs'
        >
            {wikis.map((wiki: Wiki, index: number) => (
                <WikiTab
                    key={wiki.id}
                    ref={(el) => {
                        tabRefs.current[wiki.id] = el;
                    }}
                    wiki={wiki}
                    channelId={channelId}
                    onKeyDown={(event) => handleKeyDown(event, index)}
                />
            ))}
            <WikiCreateButton
                channelId={channelId}
            />
        </div>
    );
}

export default ChannelTabBar;
