// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import type {ListChildComponentProps} from 'react-window';
import {VariableSizeList} from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';

import {AccountMultipleOutlineIcon, ArchiveOutlineIcon, RestoreIcon} from '@mattermost/compass-icons/components';
import type {Group, GroupPermissions} from '@mattermost/types/groups';

import type {ActionResult} from 'mattermost-redux/types/actions';

import LoadingScreen from 'components/loading_screen';
import * as Menu from 'components/menu';
import NoResultsIndicator from 'components/no_results_indicator';
import {NoResultsVariant} from 'components/no_results_indicator/types';
import ViewUserGroupModal from 'components/view_user_group_modal';

import {ModalIdentifiers} from 'utils/constants';

import type {ModalData} from 'types/actions';

import ADLDAPUpsellBanner from '../ad_ldap_upsell_banner';

export type Props = {
    groups: Group[];
    searchTerm: string;
    loading: boolean;
    groupPermissionsMap: Record<string, GroupPermissions>;
    loadMoreGroups: () => void;
    onExited: () => void;
    backButtonAction: () => void;
    hasNextPage: boolean;
    onToggle: (isOpen: boolean) => void;
    actions: {
        archiveGroup: (groupId: string) => Promise<ActionResult>;
        restoreGroup: (groupId: string) => Promise<ActionResult>;
        openModal: <P>(modalData: ModalData<P>) => void;
    };
}

const UserGroupsList = (props: Props) => {
    const {
        groups,
        searchTerm,
        loading,
        groupPermissionsMap,
        hasNextPage,
        loadMoreGroups,
        backButtonAction,
        onExited,
        actions,
        onToggle,
    } = props;

    const infiniteLoaderRef = useRef<InfiniteLoader | null>(null);
    const variableSizeListRef = useRef<VariableSizeList | null>(null);
    const [hasMounted, setHasMounted] = useState(false);
    const [overflowState, setOverflowState] = useState('overlay');
    const {formatMessage} = useIntl();

    useEffect(() => {
        if (groups.length === 1) {
            setOverflowState('visible');
        }
    }, [groups]);

    useEffect(() => {
        if (hasMounted) {
            if (infiniteLoaderRef.current) {
                infiniteLoaderRef.current.resetloadMoreItemsCache();
            }
            if (variableSizeListRef.current) {
                variableSizeListRef.current.resetAfterIndex(0);
            }
        }
        setHasMounted(true);
    }, [searchTerm, groups.length, hasMounted]);

    const itemCount = hasNextPage ? groups.length + 1 : groups.length;

    const loadMoreItems = loading ? () => {} : loadMoreGroups;

    const isItemLoaded = (index: number) => {
        return !hasNextPage || index < groups.length;
    };

    const archiveGroup = useCallback(async (groupId: string) => {
        await actions.archiveGroup(groupId);
    }, [actions.archiveGroup]);

    const restoreGroup = useCallback(async (groupId: string) => {
        await actions.restoreGroup(groupId);
    }, [actions.restoreGroup]);

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

    const Item = ({index, style}: ListChildComponentProps) => {
        if (groups.length === 0 && searchTerm) {
            return (
                <NoResultsIndicator
                    variant={NoResultsVariant.Search}
                    titleValues={{channelName: `${searchTerm}`}}
                />
            );
        }
        if (isItemLoaded(index)) {
            const group = groups[index] as Group;
            if (!group) {
                return null;
            }

            return (
                <button
                    className='group-row'
                    style={style}
                    key={group.id}
                    onClick={() => {
                        goToViewGroupModal(group);
                    }}
                    aria-label={formatMessage({id: 'user_groups_list.groupAriaLabel', defaultMessage: '{group_name} group'}, {group_name: group.display_name})}
                >
                    <span className='group-display-name'>
                        {
                            group.delete_at > 0 &&
                            <ArchiveOutlineIcon size={16}/>
                        }
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
                        <Menu.Container
                            menuButton={{
                                id: `customWrapper-${group.id}`,
                                class: 'btn btn-icon btn-xs',
                                children: <i className='icon icon-dots-vertical'/>,
                                'aria-label': formatMessage({id: 'user_groups_list.menuAriaLabel', defaultMessage: '{group_name} actions'}, {group_name: group.display_name}),
                            }}
                            menu={{
                                id: 'group-actions-menu',
                                onToggle,
                                'aria-label': formatMessage({id: 'user_groups_list.menuAriaLabel', defaultMessage: '{group_name} actions'}, {group_name: group.display_name}),
                                className: 'group-actions-menu',
                            }}
                        >
                            <Menu.Item
                                id='view-group'
                                onClick={() => {
                                    goToViewGroupModal(group);
                                }}
                                labels={
                                    <FormattedMessage
                                        id='user_groups_modal.viewGroup'
                                        defaultMessage='View Group'
                                    />
                                }
                                leadingElement={<AccountMultipleOutlineIcon size={18}/>}
                            />
                            <Menu.Separator/>
                            {groupPermissionsMap[group.id].can_delete && (
                                <Menu.Item
                                    id='archive-group'
                                    onClick={() => {
                                        archiveGroup(group.id);
                                    }}
                                    labels={
                                        <FormattedMessage
                                            id='user_groups_modal.archiveGroup'
                                            defaultMessage='Archive Group'
                                        />
                                    }
                                    leadingElement={<ArchiveOutlineIcon size={18}/>}
                                    isDestructive={true}
                                />
                            )}
                            {groupPermissionsMap[group.id].can_restore && (
                                <Menu.Item
                                    id='restore-group'
                                    onClick={() => {
                                        restoreGroup(group.id);
                                    }}
                                    labels={
                                        <FormattedMessage
                                            id='user_groups_modal.restoreGroup'
                                            defaultMessage='Restore Group'
                                        />
                                    }
                                    leadingElement={<RestoreIcon size={18}/>}
                                />
                            )}
                        </Menu.Container>
                    </div>
                </button>
            );
        }
        if (loading) {
            return <LoadingScreen/>;
        }
        return null;
    };

    return (
        <div
            className='user-groups-modal__content user-groups-list'
            style={{overflow: overflowState}}
        >
            <InfiniteLoader
                ref={infiniteLoaderRef}
                isItemLoaded={isItemLoaded}
                itemCount={100000}
                loadMoreItems={loadMoreItems}
            >
                {({onItemsRendered, ref}) => (
                    <VariableSizeList
                        itemCount={itemCount}
                        onItemsRendered={onItemsRendered}
                        ref={ref}
                        itemSize={() => 52}
                        height={groups.length >= 8 ? 416 : Math.max(groups.length, 3) * 52}
                        width={'100%'}
                    >
                        {Item}
                    </VariableSizeList>)}
            </InfiniteLoader>
            <ADLDAPUpsellBanner/>
        </div>
    );
};

export default React.memo(UserGroupsList);
