// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {
    PlusIcon,
    AccountPlusOutlineIcon,
    FolderPlusOutlineIcon,
    AccountMultiplePlusOutlineIcon,
    GlobeIcon,
    AccountOutlineIcon,
} from '@mattermost/compass-icons/components';

import * as Menu from 'components/menu';
import {CreateAndJoinChannelsTour, InvitePeopleTour} from 'components/tours/onboarding_tour';

export const ELEMENT_ID_FOR_BROWSE_OR_ADD_CHANNEL_MENU = 'browserOrAddChannelMenuButton';

type Props = {
    canCreateChannel: boolean;
    onCreateNewChannelClick: () => void;
    canJoinPublicChannel: boolean;
    onBrowseChannelClick: () => void;
    onOpenDirectMessageClick: () => void;
    canCreateCustomGroups: boolean;
    onCreateNewUserGroupClick: () => void;
    unreadFilterEnabled: boolean;
    onCreateNewCategoryClick: () => void;
    onInvitePeopleClick: () => void;
    showCreateAndJoinChannelsTutorialTip: boolean;
    showInvitePeopleTutorialTip: boolean;
};

export default function BrowserOrAddChannelMenu(props: Props) {
    const {formatMessage} = useIntl();

    let createNewChannelMenuItem: JSX.Element | null = null;
    if (props.canCreateChannel) {
        createNewChannelMenuItem = (
            <Menu.Item
                id='createNewChannelMenuItem'
                onClick={props.onCreateNewChannelClick}
                leadingElement={<PlusIcon size={18}/>}
                labels={(
                    <FormattedMessage
                        id='sidebarLeft.browserOrCreateChannelMenu.createNewChannelMenuItem.primaryLabel'
                        defaultMessage='Create new channel'
                    />
                )}
                trailingElements={props.showCreateAndJoinChannelsTutorialTip && <CreateAndJoinChannelsTour/>}
            />
        );
    }

    let browseChannelsMenuItem: JSX.Element | null = null;
    if (props.canJoinPublicChannel) {
        browseChannelsMenuItem = (
            <Menu.Item
                id='browseChannelsMenuItem'
                onClick={props.onBrowseChannelClick}
                leadingElement={<GlobeIcon size={18}/>}
                labels={(
                    <FormattedMessage
                        id='sidebarLeft.browserOrCreateChannelMenu.browseChannelsMenuItem.primaryLabel'
                        defaultMessage='Browse channels'
                    />
                )}
            />
        );
    }

    const createDirectMessageMenuItem = (
        <Menu.Item
            id='openDirectMessageMenuItem'
            onClick={props.onOpenDirectMessageClick}
            leadingElement={<AccountOutlineIcon size={18}/>}
            labels={(
                <FormattedMessage
                    id='sidebarLeft.browserOrCreateChannelMenu.openDirectMessageMenuItem.primaryLabel'
                    defaultMessage='Open a direct message'
                />
            )}
        />
    );

    let createUserGroupMenuItem: JSX.Element | null = null;
    if (props.canCreateCustomGroups) {
        createUserGroupMenuItem = (
            <Menu.Item
                id='createUserGroupMenuItem'
                onClick={props.onCreateNewUserGroupClick}
                leadingElement={<AccountMultiplePlusOutlineIcon size={18}/>}
                labels={(
                    <FormattedMessage
                        id='sidebarLeft.browserOrCreateChannelMenu.createUserGroupMenuItem.primaryLabel'
                        defaultMessage='Create new user group'
                    />
                )}
            />
        );
    }

    let createNewCategoryMenuItem: JSX.Element | null = null;
    if (!props.unreadFilterEnabled) {
        createNewCategoryMenuItem = (
            <Menu.Item
                id='createCategoryMenuItem'
                onClick={props.onCreateNewCategoryClick}
                leadingElement={<FolderPlusOutlineIcon size={18}/>}
                labels={(
                    <FormattedMessage
                        id='sidebarLeft.browserOrCreateChannelMenu.createCategoryMenuItem.primaryLabel'
                        defaultMessage='Create new category'
                    />
                )}
            />
        );
    }

    const invitePeopleMenuItem = (
        <Menu.Item
            id='invitePeopleMenuItem'
            onClick={props.onInvitePeopleClick}
            leadingElement={<AccountPlusOutlineIcon size={18}/>}
            labels={(
                <>
                    <FormattedMessage
                        id='sidebarLeft.browserOrCreateChannelMenu.invitePeopleMenuItem.primaryLabel'
                        defaultMessage='Invite people'
                    />
                    <FormattedMessage
                        id='sidebarLeft.browserOrCreateChannelMenu.invitePeopleMenuItem.secondaryLabel'
                        defaultMessage='Add people to the team'
                    />
                </>
            )}
            trailingElements={props.showInvitePeopleTutorialTip && <InvitePeopleTour/>}
        />
    );

    return (
        <Menu.Container
            menuButton={{
                id: ELEMENT_ID_FOR_BROWSE_OR_ADD_CHANNEL_MENU,
                'aria-label': formatMessage({
                    id: 'sidebarLeft.browserOrCreateChannelMenuButton.arialLabel',
                    defaultMessage: 'Browse or create channels',
                }),
                class: 'btn btn-icon btn-sm btn-tertiary btn-inverted btn-round',
                children: <PlusIcon size={18}/>,
            }}
            menuButtonTooltip={{
                text: formatMessage({id: 'sidebarLeft.browserOrCreateChannelMenuButton.tooltip', defaultMessage: 'Browse or create channels'}),
            }}
            menu={{
                id: 'browserOrAddChannelMenu',
                'aria-label': formatMessage({id: 'sidebarLeft.browserOrCreateChannelMenu.ariaLabel', defaultMessage: 'Browse or create channels menu'}),
            }}
        >
            {createNewChannelMenuItem}
            {browseChannelsMenuItem}
            {createDirectMessageMenuItem}
            {createUserGroupMenuItem}
            {Boolean(createNewCategoryMenuItem) &&
                <Menu.Separator/>
            }
            {createNewCategoryMenuItem}
            <Menu.Separator/>
            {invitePeopleMenuItem}
        </Menu.Container>
    );
}
