// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import {
    PlusIcon,
} from '@mattermost/compass-icons/components';

import {useIsChannelBookmarksEnabled} from './hooks';

const ChannelBookmarks = () => {
    const show = useIsChannelBookmarksEnabled();
    const {formatMessage} = useIntl();

    if (!show) {
        return null;
    }

    const bookmarks = null;

    return (
        <Container>
            {bookmarks}
            <PlusButtonMenu/>
        </Container>
    );
};

export default ChannelBookmarks;

const PlusButtonMenu = () => {
    const {formatMessage} = useIntl();
    return (
        <PlusButton
            id={'channel-bookmarks-add'}
            aria-label={formatMessage({id: 'channel_header.addBookmark', defaultMessage: 'Add bookmark'})}
            className={'channel-bookmarks-plus'}
        >
            <PlusIcon size={18}/>
        </PlusButton>
    );
};

const Container = styled.div`
    height: 36px;
    display: flex;
    padding: 6px;
    align-items: center;
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.12);
`;

const PlusButton = styled.button`
    position: relative;
    display: flex;
    padding: 4px;
    border: none;
    background: transparent;
    border-radius: 4px;
    color: rgba(var(--center-channel-color-rgb), 0.56);

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: rgba(var(--center-channel-color-rgb), 0.72);
        fill: rgba(var(--center-channel-color-rgb), 0.72);
    }

    &:active,
    &--active,
    &--active:hover {
        background: rgba(var(--button-bg-rgb), 0.08);
        color: rgb(var(--button-bg-rgb));
        fill: rgb(var(--button-bg-rgb));

        .icon__text {
            color: rgb(var(--button-bg));
        }

        .icon {
            color: rgb(var(--button-bg));
        }
    }

    &--active-inverted,
    &--active-inverted:hover {
        background: rgb(var(--button-bg));
        color: rgb(var(--button-color));
        fill: rgb(var(--button-color));
    }
`;
