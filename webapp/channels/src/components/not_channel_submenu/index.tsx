// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch} from 'react-redux';

import {CogOutlineIcon} from '@mattermost/compass-icons/components';
import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import {openModal} from 'actions/views/modals';

import type {Actions} from 'components/convert_gm_to_channel_modal';
import ConvertGmToChannelModal from 'components/convert_gm_to_channel_modal';
import EditChannelHeaderModal from 'components/edit_channel_header_modal';
import Menu from 'components/widgets/menu/menu';

import {Constants, ModalIdentifiers} from 'utils/constants';
import {localizeMessage} from 'utils/utils';

import type {Menu as ChannelMenu} from 'types/store/plugins';
type Props = {
    channel: Channel;
    isArchived: boolean;
    isReadonly: boolean;
    isGuest: boolean;
    onExited: () => void;
    actions: Actions;
    profilesInChannel: UserProfile[];
    teammateNameDisplaySetting: string;
    currentUserId: string;

}
export const NotChannelSubMenu: React.FC<Props> = ({channel, isArchived, isReadonly, isGuest, onExited, actions, profilesInChannel, teammateNameDisplaySetting, currentUserId}) => {
    const dispatch = useDispatch();
    const menuItems: ChannelMenu[] = [
        {
            id: 'channelEditHeader',
            text: localizeMessage({id: 'channel_header.setConversationHeader', defaultMessage: 'Edit Header'}),
            filter: () => channel.type === Constants.GM_CHANNEL && !isArchived && !isReadonly,
            action: () => {
                dispatch(openModal({
                    modalId: ModalIdentifiers.EDIT_CHANNEL_HEADER,
                    dialogType: EditChannelHeaderModal,
                    dialogProps: {channel},
                }));
            },
        },
        {
            id: 'convertGMPrivateChannel',
            text: localizeMessage({id: 'sidebar_left.sidebar_channel_menu_convert_to_channel', defaultMessage: 'Convert to Private Channel'}),
            filter: () => channel.type === Constants.GM_CHANNEL && !isArchived && !isReadonly && !isGuest,
            action: () => {
                dispatch(openModal({
                    modalId: ModalIdentifiers.CONVERT_GM_TO_CHANNEL,
                    dialogType: ConvertGmToChannelModal,
                    dialogProps: {channel, onExited, actions, profilesInChannel, teammateNameDisplaySetting, currentUserId},
                }));
            },
        },
    ];
    return (
        <Menu.ItemSubMenu
            id='groupChannelActions'
            text={localizeMessage({id: 'channel_header.Settings', defaultMessage: ' Settings'})}
            subMenuClass='group-channel-actions-submenu'
            subMenu={menuItems.
                filter((item) => (item.filter ? item.filter() : false)).
                map((item) => ({
                    id: item.id,
                    text: item.text,
                    action: item.action,
                }))}
            direction='right'
            icon={
                <span style={{fontSize: '1.25rem', verticalAlign: 'middle', marginLeft: '2'}}>
                    <CogOutlineIcon
                        size={18}
                    />
                </span>}

        />
    );
};
export default (NotChannelSubMenu);
