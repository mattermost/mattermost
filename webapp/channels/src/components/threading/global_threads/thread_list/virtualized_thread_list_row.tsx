// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {FormattedMessage} from 'react-intl';
import {areEqual} from 'react-window';

import type {UserThread} from '@mattermost/types/threads';

import SearchHintSVG from 'components/common/svg_images_components/search_hint_svg';
import LoadingScreen from 'components/loading_screen';
import NoResultsIndicator from 'components/no_results_indicator';
import {NoResultsLayout} from 'components/no_results_indicator/types';
import {SearchShortcut} from 'components/search_shortcut/search_shortcut';
import {ShortcutKeyVariant} from 'components/shortcut_key';

import {Constants} from 'utils/constants';

import ThreadItem from '../thread_item';

type Props = {
    data: {
        ids: Array<UserThread['id']>;
        selectedThreadId?: UserThread['id'];
    };
    index: number;
    style: any;
};

function Row({index, style, data}: Props) {
    const itemId = data.ids[index];
    const isSelected = data.selectedThreadId === itemId;

    if (itemId === Constants.THREADS_LOADING_INDICATOR_ITEM_ID) {
        return (
            <LoadingScreen
                message={<></>}
                style={style}
            />
        );
    }

    if (itemId === Constants.THREADS_NO_RESULTS_ITEM_ID) {
        return (
            <NoResultsIndicator
                style={{...style, padding: '16px 16px 16px 24px', background: 'rgba(var(--center-channel-color-rgb), 0.04)'}}
                iconGraphic={<SearchHintSVG/>}
                title={
                    <FormattedMessage
                        id='globalThreads.searchGuidance.title'
                        defaultMessage='That’s the end of the list'
                    />
                }
                subtitle={
                    <FormattedMessage
                        id='globalThreads.searchGuidance.subtitle'
                        defaultMessage='If you’re looking for older conversations, try searching with {searchShortcut}'
                        values={{
                            searchShortcut: (
                                <SearchShortcut
                                    className='thread-no-results-subtitle-shortcut'
                                    variant={ShortcutKeyVariant.TutorialTip}
                                />
                            ),
                        }}
                    />
                }
                titleClassName='thread-no-results-title'
                subtitleClassName='thread-no-results-subtitle'
                layout={NoResultsLayout.Horizontal}
            />
        );
    }

    return (
        <ThreadItem
            isSelected={isSelected}
            key={itemId}
            style={style}
            threadId={itemId}
            isFirstThreadInList={index === 0}
        />
    );
}

export default memo(Row, areEqual);
