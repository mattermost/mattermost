// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import Permissions from 'mattermost-redux/constants/permissions';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';
import {getBool} from 'mattermost-redux/selectors/entities/preferences';
import {haveICurrentChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {setAddChannelCtaDropdown} from 'actions/views/add_channel_dropdown';
import {openModal} from 'actions/views/modals';
import {isAddChannelCtaDropdownOpen} from 'selectors/views/add_channel_dropdown';

import BrowseChannels from 'components/browse_channels';
import NewChannelModal from 'components/new_channel_modal/new_channel_modal';
import Menu from 'components/widgets/menu/menu';
import MenuWrapper from 'components/widgets/menu/menu_wrapper';

import {ModalIdentifiers, Preferences, Touched} from 'utils/constants';

import type {GlobalState} from 'types/store';

const AddChannelsCtaButton = (): JSX.Element | null => {
    const dispatch = useDispatch();
    const currentTeamId = useSelector(getCurrentTeamId);
    const intl = useIntl();
    const touchedAddChannelsCtaButton = useSelector((state: GlobalState) => getBool(state, Preferences.TOUCHED, Touched.ADD_CHANNELS_CTA));

    const canCreatePublicChannel = useSelector((state: GlobalState) => haveICurrentChannelPermission(state, Permissions.CREATE_PUBLIC_CHANNEL));
    const canCreatePrivateChannel = useSelector((state: GlobalState) => haveICurrentChannelPermission(state, Permissions.CREATE_PRIVATE_CHANNEL));
    const canCreateChannel = canCreatePrivateChannel || canCreatePublicChannel;
    const canJoinPublicChannel = useSelector((state: GlobalState) => haveICurrentChannelPermission(state, Permissions.JOIN_PUBLIC_CHANNELS));
    const isAddChannelCtaOpen = useSelector(isAddChannelCtaDropdownOpen);
    const currentUserId = useSelector(getCurrentUserId);
    const openAddChannelsCtaOpen = useCallback((open: boolean) => {
        dispatch(setAddChannelCtaDropdown(open));
    }, []);

    let buttonClass = 'SidebarChannelNavigator__addChannelsCtaLhsButton';

    if (!touchedAddChannelsCtaButton) {
        buttonClass += ' SidebarChannelNavigator__addChannelsCtaLhsButton--untouched';
    }

    if ((!canCreateChannel && !canJoinPublicChannel) || !currentTeamId) {
        return null;
    }

    const showMoreChannelsModal = () => {
        dispatch(openModal({
            modalId: ModalIdentifiers.MORE_CHANNELS,
            dialogType: BrowseChannels,
        }));
    };

    const showNewChannelModal = () => {
        dispatch(openModal({
            modalId: ModalIdentifiers.NEW_CHANNEL_MODAL,
            dialogType: NewChannelModal,
        }));
    };

    const renderDropdownItems = () => {
        let joinPublicChannel;
        if (canJoinPublicChannel) {
            joinPublicChannel = (
                <Menu.ItemAction
                    id='showMoreChannels'
                    onClick={showMoreChannelsModal}
                    icon={<i className='icon-globe'/>}
                    text={intl.formatMessage({id: 'sidebar_left.add_channel_dropdown.browseChannels', defaultMessage: 'Browse channels'})}
                />
            );
        }

        let createChannel;
        if (canCreateChannel) {
            createChannel = (
                <Menu.ItemAction
                    id='showNewChannel'
                    onClick={showNewChannelModal}
                    icon={<i className='icon-plus'/>}
                    text={intl.formatMessage({id: 'sidebar_left.add_channel_dropdown.createNewChannel', defaultMessage: 'Create new channel'})}
                />
            );
        }

        return (
            <>
                <Menu.Group>
                    {createChannel}
                    {joinPublicChannel}
                </Menu.Group>
            </>
        );
    };

    const addChannelsButton = (btnCallback?: () => void) => {
        const handleClick = () => btnCallback?.();
        return (
            <button
                className={buttonClass}
                id={'addChannelsCta'}
                aria-label={intl.formatMessage({id: 'sidebar_left.add_channel_dropdown.dropdownAriaLabel', defaultMessage: 'Add Channel Dropdown'})}
                onClick={handleClick}
            >
                <div
                    aria-label={intl.formatMessage({id: 'sidebar_left.sidebar_channel_navigator.addChannelsCta', defaultMessage: 'Add channels'})}
                >
                    <i className='icon-plus-box'/>
                    <span>
                        {intl.formatMessage({id: 'sidebar_left.addChannelsCta', defaultMessage: 'Add Channels'})}
                    </span>
                </div>
            </button>
        );
    };

    const storePreferencesAndTrackEvent = () => {
        if (!touchedAddChannelsCtaButton) {
            dispatch(savePreferences(
                currentUserId,
                [{
                    category: Preferences.TOUCHED,
                    user_id: currentUserId,
                    name: Touched.ADD_CHANNELS_CTA,
                    value: 'true',
                }],
            ));
        }
    };

    const trackOpen = (opened: boolean) => {
        openAddChannelsCtaOpen(opened);
        storePreferencesAndTrackEvent();
    };

    if (!canCreateChannel) {
        const browseChannelsAction = () => {
            showMoreChannelsModal();
            storePreferencesAndTrackEvent();
        };
        return addChannelsButton(browseChannelsAction);
    }

    return (
        <MenuWrapper
            className='AddChannelsCtaDropdown'
            onToggle={trackOpen}
            open={isAddChannelCtaOpen}
        >
            {addChannelsButton()}
            <Menu
                id='AddChannelCtaDropdown'
                ariaLabel={intl.formatMessage({id: 'sidebar_left.add_channel_cta_dropdown.dropdownAriaLabel', defaultMessage: 'Add Channels Dropdown'})}
            >
                {renderDropdownItems()}
            </Menu>
        </MenuWrapper>
    );
};

export default AddChannelsCtaButton;
