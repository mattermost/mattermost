// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ReactNode} from 'react';
import React, {useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';

import {GlobeIcon, PlusIcon} from '@mattermost/compass-icons/components';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import Permissions from 'mattermost-redux/constants/permissions';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';
import {getBool} from 'mattermost-redux/selectors/entities/preferences';
import {haveICurrentChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {openModal} from 'actions/views/modals';

import BrowseChannels from 'components/browse_channels';
import * as Menu from 'components/menu';
import NewChannelModal from 'components/new_channel_modal/new_channel_modal';

import {ModalIdentifiers, Preferences, Touched} from 'utils/constants';

import type {GlobalState} from 'types/store';

// Left-align the menu with the icon in the LHS
const anchorOrigin = {vertical: 'bottom', horizontal: 'left'} as const;
const transformOrigin = {vertical: 'top', horizontal: -20} as const;

const AddChannelsCtaButton = (): JSX.Element | null => {
    const dispatch = useDispatch();
    const currentTeamId = useSelector(getCurrentTeamId);
    const intl = useIntl();
    const touchedAddChannelsCtaButton = useSelector((state: GlobalState) => getBool(state, Preferences.TOUCHED, Touched.ADD_CHANNELS_CTA));

    const canCreatePublicChannel = useSelector((state: GlobalState) => haveICurrentChannelPermission(state, Permissions.CREATE_PUBLIC_CHANNEL));
    const canCreatePrivateChannel = useSelector((state: GlobalState) => haveICurrentChannelPermission(state, Permissions.CREATE_PRIVATE_CHANNEL));
    const canCreateChannel = canCreatePrivateChannel || canCreatePublicChannel;
    const canJoinPublicChannel = useSelector((state: GlobalState) => haveICurrentChannelPermission(state, Permissions.JOIN_PUBLIC_CHANNELS));
    const currentUserId = useSelector(getCurrentUserId);

    let buttonClass = 'SidebarChannelNavigator__addChannelsCtaLhsButton';

    if (!touchedAddChannelsCtaButton) {
        buttonClass += ' SidebarChannelNavigator__addChannelsCtaLhsButton--untouched';
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
        const items: ReactNode[] = [];
        if (canJoinPublicChannel) {
            items.push(
                <Menu.Item
                    key='showMoreChannels'
                    id='showMoreChannels'
                    onClick={showMoreChannelsModal}
                    leadingElement={<GlobeIcon size={18}/>}
                    labels={
                        <FormattedMessage
                            id='sidebar_left.add_channel_dropdown.browseChannels'
                            defaultMessage='Browse channels'
                        />
                    }
                />,
            );
        }

        if (canCreateChannel) {
            items.push(
                <Menu.Item
                    key='showNewChannel'
                    id='showNewChannel'
                    onClick={showNewChannelModal}
                    leadingElement={<PlusIcon size={18}/>}
                    labels={
                        <FormattedMessage
                            id='sidebar_left.add_channel_dropdown.createNewChannel'
                            defaultMessage='Create new channel'
                        />
                    }
                />,
            );
        }

        return items;
    };

    const storePreferencesAndTrackEvent = useCallback(() => {
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
    }, [currentUserId, dispatch, touchedAddChannelsCtaButton]);

    const handleMenuToggle = useCallback((isOpen: boolean) => {
        if (isOpen) {
            storePreferencesAndTrackEvent();
        }
    }, [storePreferencesAndTrackEvent]);

    if ((!canCreateChannel && !canJoinPublicChannel) || !currentTeamId) {
        return null;
    }

    const buttonContents = (
        <>
            <i
                className='icon-plus-box'
                aria-hidden={true}
            />
            <FormattedMessage
                id='sidebar_left.addChannelsCta'
                defaultMessage='Add Channels'
            />
        </>
    );

    if (!canCreateChannel) {
        const browseChannelsAction = () => {
            showMoreChannelsModal();
            storePreferencesAndTrackEvent();
        };

        return (
            <button
                className={buttonClass}
                id={'addChannelsCta'}
                onClick={browseChannelsAction}
            >
                {buttonContents}
            </button>
        );
    }

    return (
        <Menu.Container
            anchorOrigin={anchorOrigin}
            transformOrigin={transformOrigin}
            menuButton={{
                id: 'addChannelsCta',
                class: buttonClass,
                children: buttonContents,
            }}
            menu={{
                id: 'AddChannelCtaDropdown',
                className: 'AddChannelsCtaDropdown',
                'aria-label': intl.formatMessage({id: 'sidebar_left.addChannelsCta', defaultMessage: 'Add Channels'}),
                onToggle: handleMenuToggle,
            }}
        >
            {renderDropdownItems()}
        </Menu.Container>
    );
};

export default AddChannelsCtaButton;
