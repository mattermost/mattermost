// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Purpose of this file to exists is only required until channel header dropdown is migrated to new menus
import type {ComponentProps} from 'react';
import React, {memo} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {
    LinkVariantIcon,
    PaperclipIcon,
} from '@mattermost/compass-icons/components';
import type {Channel} from '@mattermost/types/channels';

import {getChannelBookmarks} from 'mattermost-redux/selectors/entities/channel_bookmarks';

import {useBookmarkAddActions} from 'components/channel_bookmarks/channel_bookmarks_menu';
import {MAX_BOOKMARKS_PER_CHANNEL, useCanUploadFiles, useChannelBookmarkPermission} from 'components/channel_bookmarks/utils';
import Menu from 'components/widgets/menu/menu';

import type {GlobalState} from 'types/store';

type Props = {
    channel: Channel;
    inHeaderDropdown?: boolean;
};

const ChannelBookmarksSubmenu = (props: Props) => {
    const {formatMessage} = useIntl();

    const {handleCreateLink, handleCreateFile} = useBookmarkAddActions(props.channel.id);
    const canAdd = useChannelBookmarkPermission(props.channel.id, 'add');
    const canUploadFiles = useCanUploadFiles();
    const limitReached = useSelector((state: GlobalState) => {
        const bookmarks = getChannelBookmarks(state, props.channel.id);
        return bookmarks && Object.keys(bookmarks).length >= MAX_BOOKMARKS_PER_CHANNEL;
    });

    if (!canAdd || limitReached) {
        return null;
    }

    const items: ComponentProps<typeof Menu.ItemSubMenu>['subMenu'] = [
        {
            id: 'channelBookmarksAddLink',
            icon: <LinkVariantIcon size={16}/>,
            direction: 'right',
            text: formatMessage({id: 'channel_bookmarks.addLink', defaultMessage: 'Add a link'}),
            action: handleCreateLink,
        },
    ];

    if (canUploadFiles) {
        items.push({
            id: 'channelBookmarksAttachFile',
            icon: <PaperclipIcon size={16}/>,
            direction: 'right',
            text: formatMessage({id: 'channel_bookmarks.attachFile', defaultMessage: 'Attach a file'}),
            action: handleCreateFile,
        });
    }

    return (
        <Menu.ItemSubMenu
            id={`channel-menu-${props.channel.id}-bookmarks`}
            subMenu={items}
            text={formatMessage({id: 'sidebar_left.sidebar_channel_menu.bookmarks', defaultMessage: 'Bookmarks Bar'})}
            direction={'right'}
            styleSelectableItem={true}
        />
    );
};

export default memo(ChannelBookmarksSubmenu);
