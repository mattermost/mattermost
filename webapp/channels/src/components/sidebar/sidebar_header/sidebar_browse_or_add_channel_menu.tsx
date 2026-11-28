// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {type JSX} from 'react';
import {defineMessage, FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {
    PlusIcon,
    AccountPlusOutlineIcon,
    FolderPlusOutlineIcon,
    AccountMultiplePlusOutlineIcon,
    GlobeIcon,
    AccountOutlineIcon,
} from '@mattermost/compass-icons/components';
import {Icon} from '@mattermost/compass-ui/components/icon';

import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {getSidebarBrowseOrAddChannelMenuPluginComponents} from 'selectors/plugins';

import * as Menu from 'components/menu';
import {OnboardingTourSteps} from 'components/tours';
import {useShowOnboardingTutorialStep, CreateAndJoinChannelsTour, InvitePeopleTour} from 'components/tours/onboarding_tour';

import {useProductRailKind} from 'hooks/useProductRailKind';
import type {KindMessages} from 'utils/channel_kind';

import type {SidebarBrowseOrAddChannelMenuAction} from 'types/store/plugins';

export const ELEMENT_ID_FOR_BROWSE_OR_ADD_CHANNEL_MENU = 'browserOrAddChannelMenu';
export const ELEMENT_ID_FOR_BROWSE_OR_ADD_CHANNEL_MENU_BUTTON = 'browseOrAddChannelMenuButton';

const BrowseOrAddChannelMenuTrigger = Menu.createMenuIconButtonTrigger({
    size: 'small',
    style: 'inverted',
    rounded: true,
    className: 'browseOrAddChannelMenuTrigger',
});

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
};

/* eslint-disable formatjs/enforce-placeholders -- no placeholders */
const browseMessages: KindMessages = {
    channel: defineMessage({id: 'sidebarLeft.browserOrCreateChannelMenu.browseChannelsMenuItem.primaryLabel', defaultMessage: 'Browse channels'}),
    board: defineMessage({id: 'sidebarLeft.browserOrCreateChannelMenu.browseChannelsMenuItem.primaryLabel.board', defaultMessage: 'Browse boards'}),
};
/* eslint-enable formatjs/enforce-placeholders */

export default function SidebarBrowserOrAddChannelMenu(props: Props) {
    const {formatMessage} = useIntl();
    const productRailKind = useProductRailKind();
    const currentTeamId = useSelector(getCurrentTeamId);
    const pluginMenuItems = useSelector(getSidebarBrowseOrAddChannelMenuPluginComponents);

    const showCreateAndJoinChannelsTutorialTip = useShowOnboardingTutorialStep(OnboardingTourSteps.CREATE_AND_JOIN_CHANNELS);
    const showInvitePeopleTutorialTip = useShowOnboardingTutorialStep(OnboardingTourSteps.INVITE_PEOPLE);

    let createNewChannelMenuItem: JSX.Element | null = null;
    if (props.canCreateChannel) {
        createNewChannelMenuItem = (
            <Menu.Item
                id='createNewChannelMenuItem'
                data-testid='lhs.browse_or_add_menu.create_channel--menuitem'
                onClick={props.onCreateNewChannelClick}
                leadingElement={<PlusIcon size={18}/>}
                labels={(
                    <FormattedMessage
                        id='sidebarLeft.browserOrCreateChannelMenu.createNewChannelMenuItem.primaryLabel'
                        defaultMessage='Create new channel'
                    />
                )}
                trailingElements={showCreateAndJoinChannelsTutorialTip && <CreateAndJoinChannelsTour/>}
                aria-haspopup='true'
            />
        );
    }

    let browseChannelsMenuItem: JSX.Element | null = null;
    if (props.canJoinPublicChannel) {
        browseChannelsMenuItem = (
            <Menu.Item
                id='browseChannelsMenuItem'
                data-testid='lhs.browse_or_add_menu.browse_channels--menuitem'
                onClick={props.onBrowseChannelClick}
                leadingElement={<GlobeIcon size={18}/>}
                labels={<FormattedMessage {...browseMessages[productRailKind]}/>}
                aria-haspopup='true'
            />
        );
    }

    const createDirectMessageMenuItem = (
        <Menu.Item
            id='openDirectMessageMenuItem'
            data-testid='lhs.browse_or_add_menu.open_direct_message--menuitem'
            onClick={props.onOpenDirectMessageClick}
            leadingElement={<AccountOutlineIcon size={18}/>}
            labels={(
                <FormattedMessage
                    id='sidebarLeft.browserOrCreateChannelMenu.openDirectMessageMenuItem.primaryLabel'
                    defaultMessage='Open a direct message'
                />
            )}
            aria-haspopup='true'
        />
    );

    let createUserGroupMenuItem: JSX.Element | null = null;
    if (props.canCreateCustomGroups) {
        createUserGroupMenuItem = (
            <Menu.Item
                id='createUserGroupMenuItem'
                data-testid='lhs.browse_or_add_menu.create_user_group--menuitem'
                onClick={props.onCreateNewUserGroupClick}
                leadingElement={<AccountMultiplePlusOutlineIcon size={18}/>}
                labels={(
                    <FormattedMessage
                        id='sidebarLeft.browserOrCreateChannelMenu.createUserGroupMenuItem.primaryLabel'
                        defaultMessage='Create new user group'
                    />
                )}
                aria-haspopup='true'
            />
        );
    }

    let createNewCategoryMenuItem: JSX.Element | null = null;
    if (!props.unreadFilterEnabled) {
        createNewCategoryMenuItem = (
            <Menu.Item
                id='createCategoryMenuItem'
                data-testid='lhs.browse_or_add_menu.create_category--menuitem'
                onClick={props.onCreateNewCategoryClick}
                leadingElement={<FolderPlusOutlineIcon size={18}/>}
                labels={(
                    <FormattedMessage
                        id='sidebarLeft.browserOrCreateChannelMenu.createCategoryMenuItem.primaryLabel'
                        defaultMessage='Create new category'
                    />
                )}
                aria-haspopup='true'
            />
        );
    }

    const invitePeopleMenuItem = (
        <Menu.Item
            id='invitePeopleMenuItem'
            data-testid='lhs.browse_or_add_menu.invite_people--menuitem'
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
            trailingElements={showInvitePeopleTutorialTip && <InvitePeopleTour/>}
            aria-haspopup='true'
        />
    );

    let pluggableMenuItems: JSX.Element[] = [];
    let afterCreateChannelMenuItems: JSX.Element[] = [];
    if (pluginMenuItems) {
        const toMenuItem = (item: SidebarBrowseOrAddChannelMenuAction) => {
            const handlePluginItemClick = () => {
                if (item.action) {
                    item.action(currentTeamId);
                }
            };

            return (
                <Menu.Item
                    id={item.id + '_pluginmenuitem'}
                    key={item.id + '_pluginmenuitem'}
                    data-testid={`lhs.browse_or_add_menu.plugin:${item.pluginId}--menuitem`}
                    onClick={handlePluginItemClick}
                    leadingElement={item.icon}
                    labels={<span>{item.text}</span>}
                />
            );
        };
        afterCreateChannelMenuItems = pluginMenuItems.filter((item) => item.placement === 'afterCreateChannel').map(toMenuItem);
        pluggableMenuItems = pluginMenuItems.filter((item) => item.placement !== 'afterCreateChannel').map(toMenuItem);
    }

    return (
        <Menu.Container
            menuButton={{
                id: ELEMENT_ID_FOR_BROWSE_OR_ADD_CHANNEL_MENU_BUTTON,
                testId: 'lhs.header.open_browse_or_add_menu',
                'aria-label': formatMessage({
                    id: 'sidebarLeft.browserOrCreateChannelMenuButton.label',
                    defaultMessage: 'Browse or create channels',
                }),
                as: BrowseOrAddChannelMenuTrigger,
                children: <Icon glyph={<PlusIcon/>}/>,
            }}
            menuButtonTooltip={{
                text: formatMessage({id: 'sidebarLeft.browserOrCreateChannelMenuButton.label', defaultMessage: 'Browse or create channels'}),
            }}
            menu={{
                id: 'browserOrAddChannelMenu',
                'aria-labelledby': ELEMENT_ID_FOR_BROWSE_OR_ADD_CHANNEL_MENU_BUTTON,
            }}
        >
            {createNewChannelMenuItem}
            {afterCreateChannelMenuItems}
            {browseChannelsMenuItem}
            {createDirectMessageMenuItem}
            {createUserGroupMenuItem}
            {pluggableMenuItems}
            {Boolean(createNewCategoryMenuItem) &&
                <Menu.Separator/>
            }
            {createNewCategoryMenuItem}
            <Menu.Separator/>
            {invitePeopleMenuItem}
        </Menu.Container>
    );
}
