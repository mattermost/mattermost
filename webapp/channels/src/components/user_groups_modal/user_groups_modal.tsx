// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Modal} from 'react-bootstrap';

import type {GetGroupsForUserParams, GetGroupsParams, Group, GroupSearchParams} from '@mattermost/types/groups';

import './user_groups_modal.scss';
import NoResultsIndicator from 'components/no_results_indicator';
import {NoResultsVariant} from 'components/no_results_indicator/types';
import Input from 'components/widgets/inputs/input/input';

import Constants from 'utils/constants';
import * as Utils from 'utils/utils';

import ADLDAPUpsellBanner from './ad_ldap_upsell_banner';
import {usePagingMeta} from './hooks';
import UserGroupsFilter from './user_groups_filter/user_groups_filter';
import UserGroupsList from './user_groups_list';
import UserGroupsModalHeader from './user_groups_modal_header';

const GROUPS_PER_PAGE = 60;

export type Props = {
    onExited: () => void;
    groups: Group[];
    myGroups: Group[];
    archivedGroups: Group[];
    searchTerm: string;
    currentUserId: string;
    backButtonAction: () => void;
    actions: {
        getGroups: (
            opts: GetGroupsParams,
        ) => Promise<{data: Group[]}>;
        setModalSearchTerm: (term: string) => void;
        getGroupsByUserIdPaginated: (
            opts: GetGroupsForUserParams,
        ) => Promise<{data: Group[]}>;
        searchGroups: (
            params: GroupSearchParams,
        ) => Promise<{data: Group[]}>;
    };
}

const UserGroupsModal = (props: Props) => {
    const [searchTimeoutId, setSearchTimeoutId] = useState(0);
    const [loading, setLoading] = useState(false);
    const [show, setShow] = useState(true);
    const [selectedFilter, setSelectedFilter] = useState('all');
    const [groupsFull, setGroupsFull] = useState(false);
    const [groups, setGroups] = useState(props.groups);

    const [page, setPage] = usePagingMeta(selectedFilter);

    useEffect(() => {
        if (selectedFilter === 'all') {
            setGroups(props.groups);
        }
        if (selectedFilter === 'my') {
            setGroups(props.myGroups);
        }
        if (selectedFilter === 'archived') {
            setGroups(props.archivedGroups);
        }
    }, [selectedFilter, props.groups, props.myGroups]);

    const doHide = () => {
        setShow(false);
    };

    const getGroups = useCallback(async (page: number, groupType: string) => {
        const {actions, currentUserId} = props;
        setLoading(true);
        const groupsParams: GetGroupsParams = {
            filter_allow_reference: false,
            page,
            per_page: GROUPS_PER_PAGE,
            include_member_count: true,
        };
        let data: {data: Group[]} = {data: []};

        if (groupType === 'all') {
            groupsParams.include_archived = true;
            data = await actions.getGroups(groupsParams);
        } else if (groupType === 'my') {
            const groupsUserParams = {
                ...groupsParams,
                filter_has_member: currentUserId,
                include_archived: true,
            } as GetGroupsForUserParams;
            data = await actions.getGroupsByUserIdPaginated(groupsUserParams);
        } else if (groupType === 'archived') {
            groupsParams.filter_archived = true;
            data = await actions.getGroups(groupsParams);
        }

        if (data && data.data.length === 0) {
            setGroupsFull(true);
        } else {
            setGroupsFull(false);
        }
        setLoading(false);
        setSelectedFilter(groupType);
    }, [props.actions.getGroups, props.actions.getGroupsByUserIdPaginated, props.currentUserId]);

    useEffect(() => {
        getGroups(0, 'all');
        return () => {
            props.actions.setModalSearchTerm('');
        };
    }, []);

    useEffect(() => {
        clearTimeout(searchTimeoutId);
        const searchTerm = props.searchTerm;

        if (searchTerm === '') {
            setLoading(false);
            setSearchTimeoutId(0);
            return;
        }

        const timeoutId = window.setTimeout(
            async () => {
                const params: GroupSearchParams = {
                    q: searchTerm,
                    filter_allow_reference: true,
                    page,
                    per_page: GROUPS_PER_PAGE,
                    include_archived: true,
                    include_member_count: true,
                };
                if (selectedFilter === 'all') {
                    await props.actions.searchGroups(params);
                } else if (selectedFilter === 'my') {
                    params.filter_has_member = props.currentUserId;
                    await props.actions.searchGroups(params);
                } else if (selectedFilter === 'archived') {
                    params.filter_archived = true;
                    await props.actions.searchGroups(params);
                }
            },
            Constants.SEARCH_TIMEOUT_MILLISECONDS,
        );

        setSearchTimeoutId(timeoutId);
    }, [props.searchTerm, setSearchTimeoutId]);

    const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const term = e.target.value;
        props.actions.setModalSearchTerm(term);
    }, [props.actions.setModalSearchTerm]);

    const loadMoreGroups = useCallback(() => {
        const newPage = page + 1;
        setPage(newPage);
        if (selectedFilter === 'all' && !loading) {
            getGroups(newPage, 'all');
        }
        if (selectedFilter === 'my' && !loading) {
            getGroups(newPage, 'my');
        }
        if (selectedFilter === 'archived' && !loading) {
            getGroups(newPage, 'archived');
        }
    }, [selectedFilter, page, getGroups, loading]);

    const inputPrefix = useMemo(() => {
        return <i className={'icon icon-magnify'}/>;
    }, []);

    const noResultsType = useMemo(() => {
        if (selectedFilter === 'archived') {
            return NoResultsVariant.UserGroupsArchived;
        }
        return NoResultsVariant.UserGroups;
    }, [selectedFilter]);

    return (
        <Modal
            dialogClassName='a11y__modal user-groups-modal'
            show={show}
            onHide={doHide}
            onExited={props.onExited}
            role='dialog'
            aria-labelledby='userGroupsModalLabel'
            id='userGroupsModal'
        >
            <UserGroupsModalHeader
                onExited={props.onExited}
                backButtonAction={props.backButtonAction}
            />
            <Modal.Body>
                <div className='user-groups-search'>
                    <Input
                        type='text'
                        placeholder={Utils.localizeMessage('user_groups_modal.searchGroups', 'Search Groups')}
                        onChange={handleSearch}
                        value={props.searchTerm}
                        data-testid='searchInput'
                        className={'user-group-search-input'}
                        inputPrefix={inputPrefix}
                    />
                </div>
                <UserGroupsFilter
                    selectedFilter={selectedFilter}
                    getGroups={getGroups}
                />
                {(groups.length === 0 && !props.searchTerm) ? <>
                    <NoResultsIndicator
                        variant={noResultsType}
                    />
                    <ADLDAPUpsellBanner/>
                </> : <>
                    <UserGroupsList
                        groups={groups}
                        searchTerm={props.searchTerm}
                        loading={loading}
                        hasNextPage={!groupsFull}
                        loadMoreGroups={loadMoreGroups}
                        onExited={props.onExited}
                        backButtonAction={props.backButtonAction}
                    />
                </>
                }
            </Modal.Body>
        </Modal>
    );
};

export default React.memo(UserGroupsModal);
