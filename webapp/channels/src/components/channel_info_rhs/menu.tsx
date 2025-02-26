// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import type {Channel, ChannelStats} from '@mattermost/types/channels';

import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import {Constants} from 'utils/constants';

const MenuContainer = styled.nav`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 16px 0;

    font-size: 14px;
    line-height: 20px;
    color: rgb(var(--center-channel-color-rgb));
`;

const MenuItemButton = styled.button`
    display: flex;
    flex-direction: row;
    align-items: center;
    width: 100%;
    height: 40px;
    padding: 8px 16px;

    background: none;
    border: none;
    text-align: left;
    cursor: pointer;

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
    }
`;

const Icon = styled.div`
    color: rgba(var(--center-channel-color-rgb), var(--icon-opacity));
`;

const MenuItemText = styled.div`
    padding-left: 8px;
    flex: 1;
`;

const RightSide = styled.div`
    display: flex;
    color: rgba(var(--center-channel-color-rgb), 0.75);
`;

const Badge = styled.div`
    font-size: 12px;
    line-height: 18px;
    width: 20px;
    display: flex;
    place-content: center;
`;

interface MenuItemProps {
    icon: JSX.Element;
    text: string;
    opensSubpanel?: boolean;
    badge?: string | number | JSX.Element;
    onClick: () => void;
}

function MenuItem(props: MenuItemProps) {
    const {icon, text, opensSubpanel, badge, onClick} = props;
    const hasRightSide = (badge !== undefined) || opensSubpanel;

    return (
        <MenuItemButton
            onClick={onClick}
            aria-label={text}
            type='button'
        >
            <Icon>{icon}</Icon>
            <MenuItemText>{text}</MenuItemText>
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
        </MenuItemButton>
    );
}

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
        getChannelStats: (channelId: string, includeFileCount: boolean) => Promise<{data: ChannelStats}>;
    };
}

export default function Menu(props: MenuProps) {
    const {formatMessage} = useIntl();
    const {
        channel,
        channelStats,
        isArchived,
        className,
        actions,
    } = props;

    const [loadingStats, setLoadingStats] = useState(true);

    const showNotificationPreferences = channel.type !== Constants.DM_CHANNEL && !isArchived;
    const showMembers = channel.type !== Constants.DM_CHANNEL;
    const fileCount = channelStats?.files_count >= 0 ? channelStats?.files_count : 0;

    useEffect(() => {
        actions.getChannelStats(channel.id, true).then(() => {
            setLoadingStats(false);
        });
        return () => {
            setLoadingStats(true);
        };
    }, [channel.id]);

    return (
        <MenuContainer
            className={className}
            data-testid='channel_info_rhs-menu'
            aria-label={formatMessage({
                id: 'channel_info_rhs.menu.title',
                defaultMessage: 'Channel Info Actions',
            })}
        >
            {showNotificationPreferences && (
                <MenuItem
                    icon={<i className='icon icon-bell-outline'/>}
                    text={formatMessage({
                        id: 'channel_info_rhs.menu.notification_preferences',
                        defaultMessage: 'Notification Preferences',
                    })}
                    onClick={actions.openNotificationSettings}
                />
            )}
            {showMembers && (
                <MenuItem
                    icon={<i className='icon icon-account-outline'/>}
                    text={formatMessage({
                        id: 'channel_info_rhs.menu.members',
                        defaultMessage: 'Members',
                    })}
                    opensSubpanel={true}
                    badge={channelStats.member_count}
                    onClick={() => actions.showChannelMembers(channel.id)}
                />
            )}
            <MenuItem
                icon={<i className='icon icon-pin-outline'/>}
                text={formatMessage({
                    id: 'channel_info_rhs.menu.pinned',
                    defaultMessage: 'Pinned messages',
                })}
                opensSubpanel={true}
                badge={channelStats?.pinnedpost_count}
                onClick={() => actions.showPinnedPosts(channel.id)}
            />
            <MenuItem
                icon={<i className='icon icon-file-text-outline'/>}
                text={formatMessage({
                    id: 'channel_info_rhs.menu.files',
                    defaultMessage: 'Files',
                })}
                opensSubpanel={true}
                badge={loadingStats ? <LoadingSpinner/> : fileCount}
                onClick={() => actions.showChannelFiles(channel.id)}
            />
        </MenuContainer>
    );
}
