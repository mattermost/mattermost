// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, injectIntl} from 'react-intl';
import type {IntlShape} from 'react-intl';

import type {Channel} from '@mattermost/types/channels';
import {SyncableType} from '@mattermost/types/groups';
import type {Group} from '@mattermost/types/groups';

import AddGroupsToChannelModal from 'components/add_groups_to_channel_modal';
import ListModal, {DEFAULT_NUM_PER_PAGE} from 'components/list_modal';
import DropdownIcon from 'components/widgets/icons/fa_dropdown_icon';
import Menu from 'components/widgets/menu/menu';
import MenuWrapper from 'components/widgets/menu/menu_wrapper';

import groupsAvatar from 'images/groups-avatar.png';
import type {ModalData} from 'types/actions';
import {ModalIdentifiers} from 'utils/constants';
import * as Utils from 'utils/utils';

type Props = {
    channel: Channel;
    intl: IntlShape;
    actions: {
        getGroupsAssociatedToChannel: (channelId: string, searchTerm: string, pageNumber: number, perPage: number) => any;
        unlinkGroupSyncable: (itemId: string, channelId: string, groupsSyncableTypeChannel: string) => any;
        patchGroupSyncable: (itemId: string, channelId: string, groupsSyncableTypeChannel: string, params: {scheme_admin: boolean}) => any;
        getMyChannelMember: (channelId: string) => any;
        closeModal: (modalId: string) => void;
        openModal: <P>(modalData: ModalData<P>) => void;
    };
};

class ChannelGroupsManageModal extends React.PureComponent<Props> {
    public loadItems = async (pageNumber: number, searchTerm: string) => {
        const {data} = await this.props.actions.getGroupsAssociatedToChannel(this.props.channel.id, searchTerm, pageNumber, DEFAULT_NUM_PER_PAGE);
        return {
            items: data.groups,
            totalCount: data.totalGroupCount,
        };
    };

    public onClickRemoveGroup = (item: Group, listModal: any) => this.props.actions.unlinkGroupSyncable(item.id, this.props.channel.id, SyncableType.Channel).then(async () => {
        listModal.setState({loading: true});
        const {items, totalCount} = await listModal.props.loadItems(listModal.setState.page, listModal.state.searchTerm);
        listModal.setState({loading: false, items, totalCount});
    });

    public onHide = () => {
        this.props.actions.closeModal(ModalIdentifiers.MANAGE_CHANNEL_GROUPS);
    };

    public titleButtonOnClick = () => {
        this.onHide();
        this.props.actions.openModal({modalId: ModalIdentifiers.ADD_GROUPS_TO_TEAM, dialogType: AddGroupsToChannelModal});
    };

    public setChannelMemberStatus = async (item: Group, listModal: any, isChannelAdmin: boolean) => {
        this.props.actions.patchGroupSyncable(item.id, this.props.channel.id, SyncableType.Channel, {scheme_admin: isChannelAdmin}).then(async () => {
            listModal.setState({loading: true});
            const {items, totalCount} = await listModal.props.loadItems(listModal.setState.page, listModal.state.searchTerm);
            await this.props.actions.getMyChannelMember(this.props.channel.id);

            listModal.setState({loading: false, items, totalCount});
        });
    };

    public renderRow = (item: Group, listModal: any) => {
        let title;
        if (item.scheme_admin) {
            title = Utils.localizeMessage('channel_members_dropdown.channel_admins', 'Channel Admins');
        } else {
            title = Utils.localizeMessage('channel_members_dropdown.channel_members', 'Channel Members');
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
                    <div className='more-modal__name'>{item.display_name} {'-'}{' '}
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
                        >
                            <span>{title} </span>
                            <DropdownIcon/>
                        </button>
                        <Menu
                            openLeft={true}
                            ariaLabel={Utils.localizeMessage('channel_members_dropdown.menuAriaLabel', 'Change the role of channel member')}
                        >
                            <Menu.ItemAction
                                show={!item.scheme_admin}
                                onClick={() => this.setChannelMemberStatus(item, listModal, true)}
                                text={Utils.localizeMessage('channel_members_dropdown.make_channel_admins', 'Make Channel Admins')}
                            />
                            <Menu.ItemAction
                                show={Boolean(item.scheme_admin)}
                                onClick={() => this.setChannelMemberStatus(item, listModal, false)}
                                text={Utils.localizeMessage('channel_members_dropdown.make_channel_members', 'Make Channel Members')}
                            />
                            <Menu.ItemAction
                                onClick={() => this.onClickRemoveGroup(item, listModal)}
                                text={Utils.localizeMessage('group_list_modal.removeGroupButton', 'Remove Group')}
                            />
                        </Menu>
                    </MenuWrapper>
                </div>
            </div>
        );
    };

    render() {
        const {formatMessage} = this.props.intl;
        return (
            <ListModal
                titleText={formatMessage({id: 'channel_groups', defaultMessage: '{channel} Groups'}, {channel: this.props.channel.display_name})}
                searchPlaceholderText={formatMessage({id: 'manage_channel_groups_modal.search_placeholder', defaultMessage: 'Search groups'})}
                renderRow={this.renderRow}
                loadItems={this.loadItems}
                onHide={this.onHide}
                titleBarButtonText={formatMessage({id: 'group_list_modal.addGroupButton', defaultMessage: 'Add Groups'})}
                titleBarButtonOnClick={this.titleButtonOnClick}
            />
        );
    }
}

export default injectIntl(ChannelGroupsManageModal);
