// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import isNil from 'lodash/isNil';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import ConfirmModal from 'components/confirm_modal';
import GlobeIcon from 'components/widgets/icons/globe_icon';
import LockIcon from 'components/widgets/icons/lock_icon';
import Menu from 'components/widgets/menu/menu';
import MenuWrapper from 'components/widgets/menu/menu_wrapper';

import {localizeMessage} from 'utils/utils';

type Props = {
    id: string;
    type: string;
    name: string;
    hasChildren?: boolean;
    collapsed?: boolean;
    onRemoveItem: (id: string, type: string) => void;
    onToggleCollapse: (id: string) => void;
    onChangeRoles: (id: string, type: string, schemeAdmin: boolean) => void;
    schemeAdmin?: boolean;
    isDisabled?: boolean;
};

type State = {
    showConfirmationModal: boolean;
};

export default class GroupTeamsAndChannelsRow extends React.PureComponent<
Props,
State
> {
    constructor(props: Props) {
        super(props);
        this.state = {
            showConfirmationModal: false,
        };
    }

    removeItem = () => {
        this.props.onRemoveItem(this.props.id, this.props.type);
        this.setState({showConfirmationModal: false});
    };

    changeRoles = () => {
        this.props.onChangeRoles(
            this.props.id,
            this.props.type,
            !this.props.schemeAdmin,
        );
    };

    toggleCollapse = () => {
        this.props.onToggleCollapse(this.props.id);
    };

    displayAssignedRolesDropdown = () => {
        const {schemeAdmin, name, isDisabled} = this.props;
        const channelAdmin = (
            <FormattedMessage
                id='admin.group_teams_and_channels_row.channelAdmin'
                defaultMessage='Channel Admin'
            />
        );
        const teamAdmin = (
            <FormattedMessage
                id='admin.group_teams_and_channels_row.teamAdmin'
                defaultMessage='Team Admin'
            />
        );
        const member = (
            <FormattedMessage
                id='admin.group_teams_and_channels_row.member'
                defaultMessage='Member'
            />
        );
        let dropDown = null;
        if (!isNil(schemeAdmin)) {
            let currentRole = member;
            let roleToBe = this.props.type.includes('team') ? teamAdmin : channelAdmin;
            if (schemeAdmin) {
                currentRole = this.props.type.includes('team') ? teamAdmin : channelAdmin;
                roleToBe = member;
            }
            dropDown = (
                <div>
                    <MenuWrapper isDisabled={isDisabled}>
                        <div data-testid={`${name}_current_role`}>
                            <a>
                                <span>{currentRole} </span>
                                <span className='caret'/>
                            </a>
                        </div>
                        <Menu
                            openLeft={true}
                            openUp={true}
                            ariaLabel={localizeMessage(
                                'admin.team_channel_settings.group_row.memberRole',
                                'Member Role',
                            )}
                            id={`${name}_change_role_options`}
                        >
                            <Menu.ItemAction
                                testid={`${name}_role_to_be`}
                                onClick={this.changeRoles}
                                text={roleToBe}
                            />
                        </Menu>
                    </MenuWrapper>
                </div>
            );
        }

        return dropDown;
    };

    render = () => {
        let extraClasses = '';
        let arrowIcon = null;
        if (this.props.hasChildren) {
            arrowIcon = (
                <i
                    className={
                        'fa ' +
                        (this.props.collapsed ? 'fa-caret-right' : 'fa-caret-down')
                    }
                    onClick={this.toggleCollapse}
                />
            );
            extraClasses += ' has-children';
        }

        if (this.props.collapsed) {
            extraClasses += ' collapsed';
        }

        let channelIcon = null;
        let typeText = null;
        switch (this.props.type) {
        case 'public-team':
            typeText = (
                <FormattedMessage
                    id='admin.group_settings.group_details.group_teams_and_channels_row.publicTeam'
                    defaultMessage='Team'
                />
            );
            break;
        case 'private-team':
            typeText = (
                <FormattedMessage
                    id='admin.group_settings.group_details.group_teams_and_channels_row.privateTeam'
                    defaultMessage='Team (Private)'
                />
            );
            break;
        }

        switch (this.props.type) {
        case 'public-channel':
            channelIcon = (
                <span className='channel-icon'>
                    <GlobeIcon className='icon icon__globe'/>
                </span>
            );
            typeText = (
                <FormattedMessage
                    id='admin.group_settings.group_details.group_teams_and_channels_row.publicChannel'
                    defaultMessage='Channel'
                />
            );
            break;
        case 'private-channel':
            channelIcon = (
                <span className='channel-icon'>
                    <LockIcon className='icon icon__lock'/>
                </span>
            );
            typeText = (
                <FormattedMessage
                    id='admin.group_settings.group_details.group_teams_and_channels_row.privateChannel'
                    defaultMessage='Channel (Private)'
                />
            );
            break;
        }

        const displayType = this.props.type.split('-')[1];

        return (
            <tr className={'group-teams-and-channels-row' + extraClasses}>
                <ConfirmModal
                    show={this.state.showConfirmationModal}
                    title={
                        <FormattedMessage
                            id='admin.group_settings.group_details.group_teams_and_channels_row.remove.confirm_header'
                            defaultMessage='Remove Membership from the {name} {displayType}?'
                            values={{name: this.props.name, displayType}}
                        />
                    }
                    message={
                        <FormattedMessage
                            id='admin.group_settings.group_details.group_teams_and_channels_row.remove.confirm_body'
                            defaultMessage='Removing this membership will prevent future users in this group from being added to the {name} {displayType}.'
                            values={{name: this.props.name, displayType}}
                        />
                    }
                    confirmButtonText={
                        <FormattedMessage
                            id='admin.group_settings.group_details.group_teams_and_channels_row.remove.confirm_button'
                            defaultMessage='Yes, Remove'
                        />
                    }
                    onConfirm={this.removeItem}
                    onCancel={() =>
                        this.setState({showConfirmationModal: false})
                    }
                />
                <td>
                    <span className='arrow-icon'>{arrowIcon}</span>
                    {channelIcon}
                    <span
                        className={classNames({
                            'name-no-arrow':
                                isNil(arrowIcon) && isNil(channelIcon),
                        })}
                    >
                        {this.props.name}
                    </span>
                </td>
                <td className='type'>{typeText}</td>
                <td>{this.displayAssignedRolesDropdown()}</td>
                <td className='text-right'>
                    <button
                        type='button'
                        className='btn btn-tertiary'
                        onClick={() =>
                            this.setState({showConfirmationModal: true})
                        }
                        data-testid={`${this.props.name}_groupsyncable_remove`}
                        disabled={this.props.isDisabled}
                    >
                        <FormattedMessage
                            id='admin.group_settings.group_details.group_teams_and_channels_row.remove'
                            defaultMessage='Remove'
                        />
                    </button>
                </td>
            </tr>
        );
    };
}
