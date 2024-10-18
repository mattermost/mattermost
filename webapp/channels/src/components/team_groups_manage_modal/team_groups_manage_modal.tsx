// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, injectIntl} from 'react-intl';
import type {IntlShape} from 'react-intl';

import {SyncableType} from '@mattermost/types/groups';
import type {Group, SyncablePatch} from '@mattermost/types/groups';
import type {Team} from '@mattermost/types/teams';

import type {ActionResult} from 'mattermost-redux/types/actions';

import AddGroupsToTeamModal from 'components/add_groups_to_team_modal';
import ConfirmModal from 'components/confirm_modal';
import Nbsp from 'components/html_entities/nbsp';
import ListModal, {DEFAULT_NUM_PER_PAGE} from 'components/list_modal';
import DropdownIcon from 'components/widgets/icons/fa_dropdown_icon';
import Menu from 'components/widgets/menu/menu';
import MenuWrapper from 'components/widgets/menu/menu_wrapper';

import groupsAvatar from 'images/groups-avatar.png';
import {ModalIdentifiers} from 'utils/constants';
import * as Utils from 'utils/utils';

import type {ModalData} from 'types/actions';

type Props = {
    intl: IntlShape;
    team: Team;
    actions: {
        getGroupsAssociatedToTeam: (teamID: string, q: string, page: number, perPage: number, filterAllowReference: boolean) => Promise<ActionResult<{groups: Group[]; totalGroupCount: number}>>;
        closeModal: (modalId: string) => void;
        openModal: <P>(modalData: ModalData<P>) => void;
        unlinkGroupSyncable: (groupID: string, syncableID: string, syncableType: SyncableType) => Promise<ActionResult>;
        patchGroupSyncable: (groupID: string, syncableID: string, syncableType: SyncableType, patch: Partial<SyncablePatch>) => Promise<ActionResult>;
        getMyTeamMembers: () => void;
    };
};

type State = {
    showConfirmModal: boolean;
    item: Group;
    listModal?: ListModal;
}

class TeamGroupsManageModal extends React.PureComponent<Props, State> {
    state = {
        showConfirmModal: false,
        item: {
            member_count: 0,
        },
    } as State;

    loadItems = async (pageNumber: number, searchTerm: string) => {
        const {data} = await this.props.actions.getGroupsAssociatedToTeam(this.props.team.id, searchTerm, pageNumber, DEFAULT_NUM_PER_PAGE, true);

        return {
            items: data!.groups,
            totalCount: data!.totalGroupCount,
        };
    };

    handleDeleteCanceled = () => {
        this.setState({showConfirmModal: false});
    };

    handleDeleteConfirmed = () => {
        this.setState({showConfirmModal: false});
        const {item, listModal} = this.state;
        this.props.actions.unlinkGroupSyncable(item.id, this.props.team.id, SyncableType.Team).then(async () => {
            if (listModal) {
                listModal.setState({loading: true});
                const {items, totalCount} = await listModal.props.loadItems(listModal.state.page, listModal.state.searchTerm);

                listModal.setState({loading: false, items, totalCount});
            }
        });
    };

    onClickRemoveGroup = (item: Group, listModal: ListModal) => {
        this.setState({showConfirmModal: true, item, listModal});
    };

    onClickConfirmRemoveGroup = (item: Group, listModal: ListModal) => this.props.actions.unlinkGroupSyncable(item.id, this.props.team.id, SyncableType.Team).then(async () => {
        listModal.setState({loading: true});
        const {items, totalCount} = await listModal.props.loadItems(listModal.state.page, listModal.state.searchTerm);
        listModal.setState({loading: false, items, totalCount});
    });

    onHide = () => {
        this.props.actions.closeModal(ModalIdentifiers.MANAGE_TEAM_GROUPS);
    };

    titleButtonOnClick = () => {
        this.onHide();
        this.props.actions.openModal({modalId: ModalIdentifiers.ADD_GROUPS_TO_TEAM, dialogType: AddGroupsToTeamModal});
    };

    setTeamMemberStatus = async (item: Group, listModal: ListModal, isTeamAdmin: boolean) => {
        this.props.actions.patchGroupSyncable(item.id, this.props.team.id, SyncableType.Team, {scheme_admin: isTeamAdmin}).then(async () => {
            listModal.setState({loading: true});
            const {items, totalCount} = await listModal.props.loadItems(listModal.state.page, listModal.state.searchTerm);

            this.props.actions.getMyTeamMembers();

            listModal.setState({loading: false, items, totalCount});
        });
    };

    renderRow = (item: Group, listModal: ListModal) => {
        let title;
        if (item.scheme_admin) {
            title = (
                <FormattedMessage
                    id='team_members_dropdown.teamAdmins'
                    defaultMessage='Team Admins'
                />
            );
        } else {
            title = (
                <FormattedMessage
                    id='team_members_dropdown.teamMembers'
                    defaultMessage='Team Members'
                />
            );
        }

        return (
            <div
                key={item.id}
                className='more-modal__row'
            >
                <img
                    className='more-modal__image'
                    src={groupsAvatar}
                    alt='group picture'
                    width='32'
                    height='32'
                />
                <div className='more-modal__details'>
                    <div
                        className='more-modal__name'
                        data-testid='group-name'
                    >{item.display_name} <Nbsp/> {'-'} <Nbsp/>
                        <span className='more-modal__name_count'>
                            <FormattedMessage
                                id='numMembers'
                                defaultMessage='{num, number} {num, plural, one {member} other {members}}'
                                values={{
                                    num: item.member_count,
                                }}
                            />
                        </span>
                    </div>
                </div>
                <div className='more-modal__actions'>
                    <MenuWrapper>
                        <button
                            id={`teamGroupsDropdown_${item.display_name}`}
                            className='dropdown-toggle theme color--link style--none'
                            type='button'
                            aria-expanded='true'
                            data-testid='menu-button'
                        >
                            <span>{title} </span>
                            <DropdownIcon/>
                        </button>
                        <Menu
                            openLeft={true}
                            ariaLabel={Utils.localizeMessage({id: 'team_members_dropdown.menuAriaLabel', defaultMessage: 'Change the role of a team member'})}
                        >
                            <Menu.ItemAction
                                show={!item.scheme_admin}
                                onClick={() => this.setTeamMemberStatus(item, listModal, true)}
                                text={Utils.localizeMessage({id: 'team_members_dropdown.makeTeamAdmins', defaultMessage: 'Make Team Admins'})}
                            />
                            <Menu.ItemAction
                                show={Boolean(item.scheme_admin)}
                                onClick={() => this.setTeamMemberStatus(item, listModal, false)}
                                text={Utils.localizeMessage({id: 'team_members_dropdown.makeTeamMembers', defaultMessage: 'Make Team Members'})}
                            />
                            <Menu.ItemAction
                                id='remove-group'
                                onClick={() => this.onClickRemoveGroup(item, listModal)}
                                text={Utils.localizeMessage({id: 'group_list_modal.removeGroupButton', defaultMessage: 'Remove Group'})}
                            />
                        </Menu>
                    </MenuWrapper>
                </div>
            </div>
        );
    };

    render() {
        const {formatMessage} = this.props.intl;
        const memberCount = this.state.item.member_count;
        return (
            <>
                <ListModal
                    show={!this.state.showConfirmModal}
                    titleText={formatMessage({id: 'team_groups', defaultMessage: '{team} Groups'}, {team: this.props.team.display_name})}
                    searchPlaceholderText={formatMessage({id: 'manage_team_groups_modal.search_placeholder', defaultMessage: 'Search groups'})}
                    renderRow={this.renderRow}
                    loadItems={this.loadItems}
                    onHide={this.onHide}
                    titleBarButtonText={formatMessage({id: 'group_list_modal.addGroupButton', defaultMessage: 'Add Groups'})}
                    titleBarButtonOnClick={this.titleButtonOnClick}
                    data-testid='list-modal'
                />
                <ConfirmModal
                    show={this.state.showConfirmModal}
                    title={formatMessage({id: 'remove_group_confirm_title', defaultMessage: 'Remove Group and {memberCount, number} {memberCount, plural, one {Member} other {Members}}'}, {memberCount})}
                    message={formatMessage({id: 'remove_group_confirm_message', defaultMessage: '{memberCount, number} {memberCount, plural, one {member} other {members}} associated to this group will be removed from the team. Are you sure you wish to remove this group and {memberCount} {memberCount, plural, one {member} other {members}}?'}, {memberCount})}
                    confirmButtonText={formatMessage({id: 'remove_group_confirm_button', defaultMessage: 'Yes, Remove Group and {memberCount, plural, one {Member} other {Members}}'}, {memberCount})}
                    onConfirm={this.handleDeleteConfirmed}
                    onCancel={this.handleDeleteCanceled}
                    id='confirm-modal'
                />
            </>
        );
    }
}

export default injectIntl(TeamGroupsManageModal);
