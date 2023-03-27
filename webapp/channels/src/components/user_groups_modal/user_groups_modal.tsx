// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useState} from 'react';

import {Modal} from 'react-bootstrap';

import Constants from 'utils/constants';

import * as Utils from 'utils/utils';
import {GetGroupsForUserParams, GetGroupsParams, Group, GroupSearachParams} from '@mattermost/types/groups';

import './user_groups_modal.scss';
import Input from 'components/widgets/inputs/input/input';
import NoResultsIndicator from 'components/no_results_indicator';
import {NoResultsVariant} from 'components/no_results_indicator/types';

import UserGroupsList from './user_groups_list';
import UserGroupsFilter from './user_groups_filter/user_groups_filter';
import UserGroupsModalHeader from './user_groups_modal_header';
import ADLDAPUpsellBanner from './ad_ldap_upsell_banner';

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
            params: GroupSearachParams,
        ) => Promise<{data: Group[]}>;
    };
}

const UserGroupsModal = (props: Props) => {
    const [searchTimeoutId, setSearchTimeoutId] = useState(0);
    const [page, setPage] = useState(0);
    const [myGroupsPage, setMyGroupsPage] = useState(0);
    const [archivedGroupsPage, setArchivedGroupsPage] = useState(0);
    const [loading, setLoading] = useState(false);
    const [show, setShow] = useState(true);
    const [selectedFilter, setSelectedFilter] = useState('all');
    const [groupsFull, setGroupsFull] = useState(false);
    const [groups, setGroups] = useState(props.groups);

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

    const getGroups = useCallback(async (page: number) => {
        const {actions} = props;
        setLoading(true);
        const groupsParams: GetGroupsParams = {
            filter_allow_reference: false,
            page,
            per_page: GROUPS_PER_PAGE,
            include_member_count: true,
            include_archived: true,
        };
        const data = await actions.getGroups(groupsParams);
        if (data.data.length === 0) {
            setGroupsFull(true);
        } else {
            setGroupsFull(false);
        }
        setLoading(false);
        setSelectedFilter('all');
    }, [props.actions.getGroups]);

    const getArchivedGroups = useCallback(async (page: number) => {
        const {actions} = props;
        setLoading(true);
        const groupsParams: GetGroupsParams = {
            filter_allow_reference: false,
            page,
            per_page: GROUPS_PER_PAGE,
            include_member_count: true,
            filter_archived: true,
        };
        const data = await actions.getGroups(groupsParams);
        if (data.data.length === 0) {
            setGroupsFull(true);
        } else {
            setGroupsFull(false);
        }
        setLoading(false);
        setSelectedFilter('archived');
    }, [props.actions.getGroups]);

    useEffect(() => {
        getGroups(0);
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
                const params: GroupSearachParams = {
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

    const getMyGroups = useCallback(async (page: number) => {
        const {actions, currentUserId} = props;

        setLoading(true);
        const groupsParams: GetGroupsForUserParams = {
            filter_allow_reference: false,
            page,
            per_page: GROUPS_PER_PAGE,
            include_member_count: true,
            filter_has_member: currentUserId,
            include_archived: true,
        };
        const data = await actions.getGroupsByUserIdPaginated(groupsParams);
        if (data.data.length === 0) {
            setGroupsFull(true);
        } else {
            setGroupsFull(false);
        }
        setLoading(false);
        setSelectedFilter('my');
    }, [props.actions.getGroupsByUserIdPaginated, props.currentUserId]);

    const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const term = e.target.value;
        props.actions.setModalSearchTerm(term);
    }, [props.actions.setModalSearchTerm]);

    const loadMoreGroups = useCallback(() => {
        if (selectedFilter === 'all' && !loading) {
            const newPage = page + 1;
            setPage(newPage);
            getGroups(newPage);
        }
        if (selectedFilter === 'my' && !loading) {
            const newPage = myGroupsPage + 1;
            setMyGroupsPage(newPage);
            getMyGroups(newPage);
        }
        if (selectedFilter === 'archived' && !loading) {
            const newPage = archivedGroupsPage + 1;
            setArchivedGroupsPage(newPage);
            getArchivedGroups(newPage);
        }
    }, [selectedFilter, myGroupsPage, page, archivedGroupsPage, getGroups, getMyGroups, getArchivedGroups, loading]);

    const inputPrefix = useMemo(() => {
        return <i className={'icon icon-magnify'}/>;
    }, []);

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
                {(groups.length === 0 && !props.searchTerm) ? <>
                    <NoResultsIndicator
                        variant={NoResultsVariant.UserGroups}
                    />
                    <ADLDAPUpsellBanner/>
                </> : <>
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
                        getMyGroups={getMyGroups}
                        getArchivedGroups={getArchivedGroups}
                    />
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
