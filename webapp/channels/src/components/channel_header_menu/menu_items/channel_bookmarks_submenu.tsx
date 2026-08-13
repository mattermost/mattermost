// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Purpose of this file to exists is only required until channel header dropdown is migrated to new menus
import React, {memo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {
    ChevronRightIcon,
    LinkVariantIcon,
    PaperclipIcon,
    BookmarkOutlineIcon,
} from '@mattermost/compass-icons/components';
import type {Channel} from '@mattermost/types/channels';

import {getChannelBookmarks} from 'mattermost-redux/selectors/entities/channel_bookmarks';

import {useBookmarkAddActions} from 'components/channel_bookmarks/channel_bookmarks_menu';
import {MAX_BOOKMARKS_PER_CHANNEL, useCanUploadFiles, useChannelBookmarkPermission} from 'components/channel_bookmarks/utils';
import * as Menu from 'components/menu';

import type {GlobalState} from 'types/store';

type Props = {
    channel: Channel;
};

const ChannelBookmarksSubmenu = (props: Props) => {
    const {formatMessage} = useIntl();

    const {handleCreateLink, handleCreateFile} = useBookmarkAddActions(props.channel.id);
    const canAdd = useChannelBookmarkPermission(props.channel.id, 'add');
    const canUploadFiles = useCanUploadFiles();

    const limitReached = useSelector((state: GlobalState) => {
        const bookmarks = getChannelBookmarks(state, props.channel.id);
        return bookmarks != null && Object.keys(bookmarks).length >= MAX_BOOKMARKS_PER_CHANNEL;
    });

    if (!canAdd) {
        return null;
    }

    const addItemLabels = (content: React.ReactNode): React.ReactElement => {
        if (limitReached) {
            return (
                <>
                    {content}
                    <FormattedMessage
                        id='channel_bookmarks.addBookmarkLimitReached'
                        defaultMessage='Cannot add more than {limit} bookmarks'
                        values={{limit: MAX_BOOKMARKS_PER_CHANNEL}}
                    />
                </>
            );
        }
        return (<>{content}</>);
    };

    const channelId = props.channel.id;

    return (
        <Menu.SubMenu
            id={`channel-menu-${channelId}-bookmarks`}
            leadingElement={<BookmarkOutlineIcon size={18}/>}
            labels={(
                <FormattedMessage
                    id='channel_menu.bookmarks'
                    defaultMessage='Bookmarks Bar'
                />
            )}
            trailingElements={(
                <ChevronRightIcon size={16}/>
            )}
            menuId={`channel-menu-${channelId}-menu`}
            menuAriaLabel={formatMessage({id: 'channel_menu.bookmarks', defaultMessage: 'Bookmarks Bar'})}
        >
            <Menu.Item
                id={`channel-menu-${channelId}-bookmarks-link`}
                leadingElement={<LinkVariantIcon size={18}/>}
                aria-disabled={limitReached}
                labels={addItemLabels(
                    <FormattedMessage
                        id='channel_menu.bookmarks.addLink'
                        defaultMessage='Add a link'
                    />,
                )}
                onClick={() => {
                    if (!limitReached) {
                        handleCreateLink();
                    }
                }}
            />
            {canUploadFiles && (
                <Menu.Item
                    id={`channel-menu-${channelId}-bookmarks-file`}
                    leadingElement={<PaperclipIcon size={18}/>}
                    aria-disabled={limitReached}
                    labels={addItemLabels(
                        <FormattedMessage
                            id='channel_menu.bookmarks.addFile'
                            defaultMessage='Attach a file'
                        />,
                    )}
                    onClick={() => {
                        if (!limitReached) {
                            handleCreateFile();
                        }
                    }}
                />
            )}
        </Menu.SubMenu>
    );
};

export default memo(ChannelBookmarksSubmenu);
