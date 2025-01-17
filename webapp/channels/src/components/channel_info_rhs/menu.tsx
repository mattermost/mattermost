// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {KeyboardEvent} from 'react';
import React from 'react';
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

const MenuItemContainer = styled.div`
    padding: 8px 16px;
    flex: 1;
    display: flex;
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
    className?: string;
    icon: JSX.Element;
    text: string;
    opensSubpanel?: boolean;
    badge?: string|number|JSX.Element;
    onClick: () => void;
}

// handle keyboard activation by pressing Enter or Space.
function handleKeyDown(e: KeyboardEvent<HTMLDivElement>, onClick: () => void) {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
    }
}

const menuItem = ({icon, text, className, opensSubpanel, badge, onClick}: MenuItemProps) => {
    const hasRightSide = (badge !== undefined) || opensSubpanel;

    return (
        <div
            className={className}
            role='menuitem'
            tabIndex={0}
            aria-label={text}
            onKeyDown={(e) => handleKeyDown(e, onClick)}
        >
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
    width: 100%;
    height: 40px;
    flex-direction: row;
    align-items: center;
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
        getChannelStats: (channelId: string, includeFileCount: boolean) => Promise<{data: ChannelStats}>;
    };
}

const Menu = ({channel, channelStats, isArchived, className, actions}: MenuProps) => {
    const {formatMessage} = useIntl();
    const [loadingStats, setLoadingStats] = React.useState(true);

    const showNotificationPreferences = channel.type !== Constants.DM_CHANNEL && !isArchived;
    const showMembers = channel.type !== Constants.DM_CHANNEL;
    const fileCount = channelStats?.files_count >= 0 ? channelStats?.files_count : 0;

    React.useEffect(() => {
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
            role='menu'
            aria-label={formatMessage({id: 'channel_info_rhs.menu.title', defaultMessage: 'Channel Info Menu'})}
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
                text={formatMessage({id: 'channel_info_rhs.menu.pinned', defaultMessage: 'Pinned messages'})}
                opensSubpanel={true}
                badge={channelStats?.pinnedpost_count}
                onClick={() => actions.showPinnedPosts(channel.id)}
            />
            <MenuItem
                icon={<i className='icon icon-file-text-outline'/>}
                text={formatMessage({id: 'channel_info_rhs.menu.files', defaultMessage: 'Files'})}
                opensSubpanel={true}
                badge={loadingStats ? <LoadingSpinner/> : fileCount}
                onClick={() => actions.showChannelFiles(channel.id)}
            />
        </MenuContainer>
    );
};

export default Menu;
