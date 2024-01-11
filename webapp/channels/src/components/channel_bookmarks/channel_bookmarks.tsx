// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import styled from 'styled-components';

import {
    LinkVariantIcon,
    PaperclipIcon,
    PlusIcon,
} from '@mattermost/compass-icons/components';

import * as Menu from 'components/menu';

import BookmarkItem from './bookmark_item';
import {useChannelBookmarks, useIsChannelBookmarksEnabled} from './utils';

import './menu_overrides.scss';

type Props = {
    channelId: string;
}

const ChannelBookmarks = ({
    channelId,
}: Props) => {
    const show = useIsChannelBookmarksEnabled();
    const {order} = useChannelBookmarks(channelId);

    if (!show) {
        return null;
    }

    return (
        <Container>
            {order.map((id) => {
                return (
                    <BookmarkItem
                        key={id}
                        id={id}
                        channelId={channelId}
                    />
                );
            })}
            <PlusButtonMenu hasBookmarks={Boolean(order?.length)}/>
        </Container>
    );
};

export default ChannelBookmarks;

const PlusButtonMenu = (props: {hasBookmarks: boolean}) => {
    const {formatMessage} = useIntl();
    const label = formatMessage({id: 'channel_bookmarks.addBookmarkLabel', defaultMessage: 'Add a bookmark'});

    const button = (
        <>
            <PlusIcon size={18}/>
            {!props.hasBookmarks && label}
        </>
    );

    return (
        <Menu.Container
            anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'left',
            }}
            transformOrigin={{
                vertical: 'top',
                horizontal: 'left',
            }}
            menuButton={{
                id: 'channelBookmarksPlusMenuButton',
                children: button,
                'aria-label': label,
            }}
            menu={{
                id: 'channelBookmarksPlusMenuDropdown',
            }}
        >
            <Menu.Item
                key='channelBookmarksAddLink'
                id='channelBookmarksAddLink'
                onClick={() => {

                }}
                leadingElement={<LinkVariantIcon size={16}/>}
                labels={
                    <FormattedMessage
                        id='channel_bookmarks.addLinkLabel'
                        defaultMessage='Add a link'
                    />
                }
                aria-label={formatMessage({id: 'channel_bookmarks.addLinkLabel', defaultMessage: 'Add a link'})}
            />
            <Menu.Item
                key='channelBookmarksAttachFile'
                id='channelBookmarksAttachFile'
                onClick={() => {

                }}
                leadingElement={<PaperclipIcon size={16}/>}
                labels={
                    <FormattedMessage
                        id='channel_bookmarks.attachFileLabel'
                        defaultMessage='Attach an image'
                    />
                }
                aria-label={formatMessage({id: 'channel_bookmarks.attachFileLabel', defaultMessage: 'Attach an image'})}
            />
        </Menu.Container>
    );
};

const Container = styled.div`
    height: 36px;
    display: flex;
    padding: 6px;
    align-items: center;
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.12);
`;
