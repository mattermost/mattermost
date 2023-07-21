// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Group, GroupPermissions} from '@mattermost/types/groups';
import React, {useCallback, useEffect, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import {ActionResult} from 'mattermost-redux/types/actions';

import LoadingScreen from 'components/loading_screen';
import NoResultsIndicator from 'components/no_results_indicator';
import {NoResultsVariant} from 'components/no_results_indicator/types';
import ViewUserGroupModal from 'components/view_user_group_modal';
import Menu from 'components/widgets/menu/menu';
import MenuWrapper from 'components/widgets/menu/menu_wrapper';

import ADLDAPUpsellBanner from '../ad_ldap_upsell_banner';
import {ModalData} from 'types/actions';
import {ModalIdentifiers} from 'utils/constants';
import * as Utils from 'utils/utils';

export type Props = {
    groups: Group[];
    searchTerm: string;
    loading: boolean;
    groupPermissionsMap: Record<string, GroupPermissions>;
    onScroll: () => void;
    onExited: () => void;
    backButtonAction: () => void;
    actions: {
        archiveGroup: (groupId: string) => Promise<ActionResult>;
        openModal: <P>(modalData: ModalData<P>) => void;
    };
}

const UserGroupsList = React.forwardRef((props: Props, ref?: React.Ref<HTMLDivElement>) => {
    const {
        groups,
        searchTerm,
        loading,
        groupPermissionsMap,
        onScroll,
        backButtonAction,
        onExited,
        actions,
    } = props;

    const [overflowState, setOverflowState] = useState('overlay');

    useEffect(() => {
        if (groups.length === 1) {
            setOverflowState('visible');
        }
    }, [groups]);

    const archiveGroup = useCallback(async (groupId: string) => {
        await actions.archiveGroup(groupId);
    }, [actions.archiveGroup]);

    const goToViewGroupModal = useCallback((group: Group) => {
        actions.openModal({
            modalId: ModalIdentifiers.VIEW_USER_GROUP,
            dialogType: ViewUserGroupModal,
            dialogProps: {
                groupId: group.id,
                backButtonCallback: backButtonAction,
                backButtonAction: () => {
                    goToViewGroupModal(group);
                },
            },
        });
        onExited();
    }, [actions.openModal, onExited, backButtonAction]);

    const groupListOpenUp = (groupListItemIndex: number): boolean => {
        if (groups.length > 1 && groupListItemIndex === 0) {
            return false;
        }

        return true;
    };

    return (
        <div
            className='user-groups-modal__content user-groups-list'
            onScroll={onScroll}
            ref={ref}
            style={{overflow: overflowState}}
        >
            {(groups.length === 0 && searchTerm) &&
                <NoResultsIndicator
                    variant={NoResultsVariant.ChannelSearch}
                    titleValues={{channelName: `"${searchTerm}"`}}
                />
            }
            {groups.map((group, i) => {
                return (
                    <div
                        className='group-row'
                        key={group.id}
                        onClick={() => {
                            goToViewGroupModal(group);
                        }}
                    >
                        <span className='group-display-name'>
                            {group.display_name}
                        </span>
                        <span className='group-name'>
                            {'@'}{group.name}
                        </span>
                        <div className='group-member-count'>
                            <FormattedMessage
                                id='user_groups_modal.memberCount'
                                defaultMessage='{member_count} {member_count, plural, one {member} other {members}}'
                                values={{
                                    member_count: group.member_count,
                                }}
                            />
                        </div>
                        <div className='group-action'>
                            <MenuWrapper
                                isDisabled={false}
                                stopPropagationOnToggle={true}
                                id={`customWrapper-${group.id}`}
                            >
                                <button className='action-wrapper'>
                                    <i className='icon icon-dots-vertical'/>
                                </button>
                                <Menu
                                    openLeft={true}
                                    openUp={groupListOpenUp(i)}
                                    className={'group-actions-menu'}
                                    ariaLabel={Utils.localizeMessage('admin.user_item.menuAriaLabel', 'User Actions Menu')}
                                >
                                    <Menu.Group>
                                        <Menu.ItemAction
                                            onClick={() => {
                                                goToViewGroupModal(group);
                                            }}
                                            icon={<i className='icon-account-multiple-outline'/>}
                                            text={Utils.localizeMessage('user_groups_modal.viewGroup', 'View Group')}
                                            disabled={false}
                                        />
                                    </Menu.Group>
                                    <Menu.Group>
                                        <Menu.ItemAction
                                            show={groupPermissionsMap[group.id].can_delete}
                                            onClick={() => {
                                                archiveGroup(group.id);
                                            }}
                                            icon={<i className='icon-archive-outline'/>}
                                            text={Utils.localizeMessage('user_groups_modal.archiveGroup', 'Archive Group')}
                                            disabled={false}
                                            isDangerous={true}
                                        />
                                    </Menu.Group>
                                </Menu>
                            </MenuWrapper>
                        </div>
                    </div>
                );
            })}
            {
                (loading) &&
                <LoadingScreen/>
            }
            <ADLDAPUpsellBanner/>
        </div>
    );
});

export default React.memo(UserGroupsList);
