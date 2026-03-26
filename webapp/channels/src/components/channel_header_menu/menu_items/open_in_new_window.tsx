// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId, getUser} from 'mattermost-redux/selectors/entities/users';
import {getUserIdFromChannelName} from 'mattermost-redux/utils/channel_utils';

import {getPopoutChannelTitle} from 'components/channel_popout/channel_popout';
import * as Menu from 'components/menu';
import PopoutMenuItem from 'components/popout_menu_item';

import {getChannelRoutePathAndIdentifier} from 'utils/channel_utils';
import {Constants} from 'utils/constants';
import {isChannelPopoutWindow, popoutChannel} from 'utils/popouts/popout_windows';

import type {GlobalState} from 'types/store';

interface Props {
    channel: Channel;
}

const MenuItemOpenInNewWindow = ({channel}: Props) => {
    const intl = useIntl();
    const team = useSelector(getCurrentTeam);
    const currentUserId = useSelector(getCurrentUserId);
    const dmUser = useSelector((state: GlobalState) => {
        if (channel.type === Constants.DM_CHANNEL) {
            const dmUserId = getUserIdFromChannelName(currentUserId, channel.name);
            return getUser(state, dmUserId);
        }
        return undefined;
    });

    if (isChannelPopoutWindow()) {
        return null;
    }

    const handleClick = () => {
        if (!team) {
            return;
        }

        const {path, identifier} = getChannelRoutePathAndIdentifier(channel, dmUser?.username);
        popoutChannel(intl.formatMessage(getPopoutChannelTitle(channel.type)), team.name, path, identifier);
    };

    return (
        <>
            <PopoutMenuItem
                id='channelOpenInNewWindow'
                onClick={handleClick}
            />
            <Menu.Separator/>
        </>
    );
};

export default MenuItemOpenInNewWindow;
