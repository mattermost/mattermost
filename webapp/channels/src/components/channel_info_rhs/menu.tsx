// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';

import {Constants} from 'utils/constants';

import {Channel, ChannelStats} from '@mattermost/types/channels';

const MenuItemContainer = styled.div`
    padding: 8px 16px;
    flex: 1;
    display: flex;
`;

const Icon = styled.div`
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;

const MenuItemText = styled.div`
    padding-left: 8px;
    flex: 1;
`;

const RightSide = styled.div`
    display: flex;
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;

const Badge = styled.div`
    font-size: 12px;
    line-height: 18px;
`;

interface MenuItemProps {
    className?: string;
    icon: JSX.Element;
    text: string;
    opensSubpanel?: boolean;
    badge?: string|number;
    onClick: () => void;
}

const menuItem = ({icon, text, className, opensSubpanel, badge, onClick}: MenuItemProps) => {
    const hasRightSide = (badge !== undefined) || opensSubpanel;

    return (
        <div className={className}>
            <MenuItemContainer onClick={onClick}>
                <Icon>{icon}</Icon>
                <MenuItemText>
                    {text}
                </MenuItemText>

                {hasRightSide && (
                    <RightSide>
                        {badge !== undefined && (
                            <Badge>{badge}</Badge>
                        )}
                        {opensSubpanel && (
                            <Icon><i className='icon icon-chevron-right'/></Icon>
                        )}
                    </RightSide>
                )}
            </MenuItemContainer>
        </div>
    );
};

const MenuItem = styled(menuItem)`
    display: flex;
    flex-direction: row;
    align-items: center;
    cursor: pointer;
    width: 100%;
    height: 40px;

    &:hover {
       background: rgba(var(--center-channel-color-rgb), 0.08);
    }
`;

interface MenuProps {
    channel: Channel;
    channelStats: ChannelStats;
    isArchived: boolean;

    className?: string;

    actions: {
        openNotificationSettings: () => void;
        showChannelFiles: (channelId: string) => void;
        showPinnedPosts: (channelId: string | undefined) => void;
        showChannelMembers: (channelId: string) => void;
    };
}

const Menu = ({channel, channelStats, isArchived, className, actions}: MenuProps) => {
    const {formatMessage} = useIntl();

    const showNotificationPreferences = channel.type !== Constants.DM_CHANNEL && !isArchived;
    const showMembers = channel.type !== Constants.DM_CHANNEL;

    return (
        <div
            className={className}
            data-testid='channel_info_rhs-menu'
        >
            {showNotificationPreferences && (
                <MenuItem
                    icon={<i className='icon icon-bell-outline'/>}
                    text={formatMessage({id: 'channel_info_rhs.menu.notification_preferences', defaultMessage: 'Notification Preferences'})}
                    onClick={actions.openNotificationSettings}
                />
            )}
            {showMembers && (
                <MenuItem
                    icon={<i className='icon icon-account-outline'/>}
                    text={formatMessage({id: 'channel_info_rhs.menu.members', defaultMessage: 'Members'})}
                    opensSubpanel={true}
                    badge={channelStats.member_count}
                    onClick={() => actions.showChannelMembers(channel.id)}
                />
            )}
            <MenuItem
                icon={<i className='icon icon-pin-outline'/>}
                text={formatMessage({id: 'channel_info_rhs.menu.pinned', defaultMessage: 'Pinned Messages'})}
                opensSubpanel={true}
                badge={channelStats?.pinnedpost_count}
                onClick={() => actions.showPinnedPosts(channel.id)}
            />
            <MenuItem
                icon={<i className='icon icon-file-text-outline'/>}
                text={formatMessage({id: 'channel_info_rhs.menu.files', defaultMessage: 'Files'})}
                opensSubpanel={true}
                badge={channelStats?.files_count}
                onClick={() => actions.showChannelFiles(channel.id)}
            />
        </div>
    );
};

const StyledMenu = styled(Menu)`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 16px 0;

    font-size: 14px;
    line-height: 20px;
    color: rgb(var(--center-channel-color-rgb));
`;

export default StyledMenu;
