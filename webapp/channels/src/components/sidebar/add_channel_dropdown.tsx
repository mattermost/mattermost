// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {trackEvent} from 'actions/telemetry_actions';

import MenuWrapper from 'components/widgets/menu/menu_wrapper';
import Menu from 'components/widgets/menu/menu';
import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';
import {CreateAndJoinChannelsTour, InvitePeopleTour} from 'components/tours/onboarding_tour';
import {ModalIdentifiers} from 'utils/constants';
import WorkTemplateModal from 'components/work_templates';

type Props = {
    canCreateChannel: boolean;
    canJoinPublicChannel: boolean;
    userGroupsEnabled: boolean;
    showMoreChannelsModal: () => void;
    showCreateUserGroupModal: () => void;
    invitePeopleModal: () => void;
    showNewChannelModal: () => void;
    showCreateCategoryModal: () => void;
    handleOpenDirectMessagesModal: (e: Event) => void;
    unreadFilterEnabled: boolean;
    showCreateTutorialTip: boolean;
    showInviteTutorialTip: boolean;
    isAddChannelOpen: boolean;
    openAddChannelOpen: (open: boolean) => void;
    canCreateCustomGroups: boolean;
    showWorkTemplateButton: boolean;
};

const AddChannelDropdown = ({
    canCreateChannel,
    canJoinPublicChannel,
    showMoreChannelsModal,
    showCreateUserGroupModal,
    invitePeopleModal,
    showNewChannelModal,
    showCreateCategoryModal,
    handleOpenDirectMessagesModal,
    unreadFilterEnabled,
    showCreateTutorialTip,
    showInviteTutorialTip,
    isAddChannelOpen,
    openAddChannelOpen,
    canCreateCustomGroups,
    showWorkTemplateButton,
}: Props) => {
    const intl = useIntl();

    const renderDropdownItems = () => {
        const invitePeople = (
            <Menu.Group>
                <Menu.ItemAction
                    id='invitePeople'
                    onClick={invitePeopleModal}
                    icon={<i className='icon-account-plus-outline'/>}
                    text={intl.formatMessage({id: 'sidebar_left.add_channel_dropdown.invitePeople', defaultMessage: 'Invite People'})}
                    extraText={intl.formatMessage({id: 'sidebar_left.add_channel_dropdown.invitePeopleExtraText', defaultMessage: 'Add people to the team'})}
                />
                {showInviteTutorialTip && <InvitePeopleTour/>}
            </Menu.Group>
        );

        let workTemplate;
        if (showWorkTemplateButton) {
            workTemplate = (
                <Menu.ItemToggleModalRedux
                    id='work-template'
                    modalId={ModalIdentifiers.WORK_TEMPLATE}
                    dialogType={WorkTemplateModal}
                    text={intl.formatMessage({id: 'sidebar_left.add_channel_dropdown.work_template', defaultMessage: 'Create from a template'})}
                    extraText={intl.formatMessage({id: 'sidebar_left.add_channel_dropdown.work_template_extra', defaultMessage: 'Set up a channel with linked boards, and playbooks'})}
                    icon={<i className='icon-layers-outline'/>}
                    className='work-template'
                />
            );
        }

        let joinPublicChannel;
        if (canJoinPublicChannel) {
            joinPublicChannel = (
                <Menu.ItemAction
                    id='showMoreChannels'
                    onClick={showMoreChannelsModal}
                    icon={<i className='icon-globe'/>}
                    text={intl.formatMessage({id: 'sidebar_left.add_channel_dropdown.browseChannels', defaultMessage: 'Browse Channels'})}
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
                    text={intl.formatMessage({id: 'sidebar_left.add_channel_dropdown.createNewChannel', defaultMessage: 'Create New Channel'})}
                />
            );
        }

        let createCategory;
        if (!unreadFilterEnabled) {
            createCategory = (
                <Menu.Group>
                    <Menu.ItemAction
                        id='createCategory'
                        onClick={showCreateCategoryModal}
                        icon={<i className='icon-folder-plus-outline'/>}
                        text={intl.formatMessage({id: 'sidebar_left.add_channel_dropdown.createCategory', defaultMessage: 'Create New Category'})}
                    />
                </Menu.Group>);
        }

        const createDirectMessage = (
            <Menu.ItemAction
                id={'openDirectMessageMenuItem'}
                onClick={handleOpenDirectMessagesModal}
                icon={<i className='icon-account-outline'/>}
                text={intl.formatMessage({id: 'sidebar.openDirectMessage', defaultMessage: 'Open a direct message'})}
            />
        );

        let createUserGroup;
        if (canCreateCustomGroups) {
            createUserGroup = (
                <Menu.ItemAction
                    id={'createUserGroup'}
                    onClick={showCreateUserGroupModal}
                    icon={<i className='icon-account-multiple-plus-outline'/>}
                    text={intl.formatMessage({id: 'sidebar.createUserGroup', defaultMessage: 'Create New User Group'})}
                />
            );
        }

        return (
            <>
                <Menu.Group>
                    {workTemplate}
                    {joinPublicChannel}
                    {createChannel}
                    {createDirectMessage}
                    {showCreateTutorialTip && <CreateAndJoinChannelsTour/>}
                    {createUserGroup}
                </Menu.Group>
                {createCategory}
                {invitePeople}
            </>
        );
    };

    const trackOpen = (opened: boolean) => {
        openAddChannelOpen(opened);
        if (opened) {
            trackEvent('ui', 'ui_add_channel_dropdown_opened');
        }
    };

    if (!(canCreateChannel || canJoinPublicChannel)) {
        return null;
    }

    const tooltip = (
        <Tooltip
            id='new-group-tooltip'
            className='hidden-xs'
        >
            <FormattedMessage
                id={'sidebar_left.add_channel_dropdown.browseOrCreateChannels'}
                defaultMessage='Browse or create channels'
            />
        </Tooltip>
    );

    return (
        <MenuWrapper
            className='AddChannelDropdown'
            onToggle={trackOpen}
            open={isAddChannelOpen}
        >
            <OverlayTrigger
                delayShow={500}
                placement='top'
                overlay={tooltip}
            >
                <>
                    <button
                        className={'AddChannelDropdown_dropdownButton'}
                        aria-label={intl.formatMessage({id: 'sidebar_left.add_channel_dropdown.dropdownAriaLabel', defaultMessage: 'Add Channel Dropdown'})}
                    >
                        <i className='icon-plus'/>
                    </button>
                </>
            </OverlayTrigger>
            <Menu
                id='AddChannelDropdown'
                ariaLabel={intl.formatMessage({id: 'sidebar_left.add_channel_dropdown.dropdownAriaLabel', defaultMessage: 'Add Channel Dropdown'})}
            >
                {renderDropdownItems()}
            </Menu>
        </MenuWrapper>
    );
};

export default AddChannelDropdown;
