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

import {getChannelTabs} from 'mattermost-redux/selectors/entities/channel_tabs';

import {useTabAddActions} from 'components/channel_tabs/channel_tabs_menu';
import {MAX_TABS_PER_CHANNEL, useCanUploadFiles, useChannelTabPermission} from 'components/channel_tabs/utils';
import * as Menu from 'components/menu';

import type {GlobalState} from 'types/store';

type Props = {
    channel: Channel;
};

const ChannelTabsSubmenu = (props: Props) => {
    const {formatMessage} = useIntl();

    const {handleCreateLink, handleCreateFile} = useTabAddActions(props.channel.id);
    const canAdd = useChannelTabPermission(props.channel.id, 'add');
    const canUploadFiles = useCanUploadFiles();

    useSelector((state: GlobalState) => {
        const tabs = getChannelTabs(state, props.channel.id);
        return tabs && Object.keys(tabs).length >= MAX_TABS_PER_CHANNEL;
    });

    if (!canAdd) {
        return null;
    }
    return (
        <Menu.SubMenu
            id={`channel-menu-${props.channel.id}-bookmarks`}
            leadingElement={<BookmarkOutlineIcon size={18}/>}
            labels={(
                <FormattedMessage
                    id='channel_menu.bookmarks'
                    defaultMessage='Tabs Bar'
                />
            )}
            trailingElements={(
                <ChevronRightIcon size={16}/>
            )}
            menuId={`channel-menu-${props.channel.id}-menu`}
            menuAriaLabel={formatMessage({id: 'channel_menu.bookmarks', defaultMessage: 'Tabs Bar'})}
        >
            <Menu.Item
                id={`channel-menu-${props.channel.id}-bookmarks-link`}
                leadingElement={<LinkVariantIcon size={18}/>}
                labels={(
                    <FormattedMessage
                        id='channel_menu.bookmarks.addLink'
                        defaultMessage='Add a link'
                    />
                )}
                onClick={() => handleCreateLink()}
            />
            {canUploadFiles && (
                <Menu.Item
                    id={`channel-menu-${props.channel.id}-bookmarks-file`}
                    leadingElement={<PaperclipIcon size={18}/>}
                    labels={(
                        <FormattedMessage
                            id='channel_menu.bookmarks.addFile'
                            defaultMessage='Attach a file'
                        />
                    )}
                    onClick={() => handleCreateFile()}
                />
            )}
        </Menu.SubMenu>
    );
};

export default memo(ChannelTabsSubmenu);
