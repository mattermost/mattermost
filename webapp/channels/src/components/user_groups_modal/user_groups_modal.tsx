// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useDispatch} from 'react-redux';

import {Modal} from 'react-bootstrap';

import Constants from 'utils/constants';

import * as Utils from 'utils/utils';
import {GetGroupsForUserParams, GetGroupsParams, Group, GroupSearachParams} from '@mattermost/types/groups';

import './user_groups_modal.scss';
import MenuWrapper from 'components/widgets/menu/menu_wrapper';
import Menu from 'components/widgets/menu/menu';
import {debounce} from 'mattermost-redux/actions/helpers';
import Input from 'components/widgets/inputs/input/input';
import NoResultsIndicator from 'components/no_results_indicator';
import {NoResultsVariant} from 'components/no_results_indicator/types';

import UserGroupsList from './user_groups_list';
import UserGroupsModalHeader from './user_groups_modal_header';
import ADLDAPUpsellBanner from './ad_ldap_upsell_banner';

const GROUPS_PER_PAGE = 60;

export type Props = {
    onExited: () => void;
    groups: Group[];
    myGroups: Group[];
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

type State = {
    page: number;
    myGroupsPage: number;
    loading: boolean;
    show: boolean;
    selectedFilter: string;
    allGroupsFull: boolean;
    myGroupsFull: boolean;
}

const UserGroupsModal = (props: Props) => {
    const divScrollRef = useRef<HTMLDivElement>(null);
    const [searchTimeoutId, setSearchTimeoutId] = useState(0);
    const [page, setPage] = useState(0);
    const [myGroupsPage, setMyGroupsPage] = useState(0);
    const [loading, setLoading] = useState(true);
    const [show, setShow] = useState(true);
    const [selectedFilter, setSelectedFilter] = useState('all');
    const [allGroupsFull, setAllGroupsFull] = useState(false);
    const [myGroupsFull, setMyGroupsFull] = useState(false);

    const [groups, setGroups] = useState(props.groups);

    useEffect(() => {
        if (selectedFilter === 'all') {
            setGroups(props.groups);
        }
        if (selectedFilter === 'my') {
            setGroups(props.myGroups);
        }
    }, [selectedFilter, props.groups, props.myGroups]);

    const doHide = () => {
        setShow(false);
    }

    const getGroups = useCallback(async (page: number) => {
        const {actions} = props;
        setLoading(true);
        const groupsParams: GetGroupsParams = {
            filter_allow_reference: false,
            page: page,
            per_page: GROUPS_PER_PAGE,
            include_member_count: true,
            include_archived: true,
        };
        const data = await actions.getGroups(groupsParams);
        if (data.data.length === 0) {
            setAllGroupsFull(true);
        }
        setLoading(false);        
        setSelectedFilter('all');
    }, [props.actions.getGroups, page]);

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
                    page: page,
                    per_page: GROUPS_PER_PAGE,
                    include_archived: true,
                    include_member_count: true,
                };
                if (selectedFilter === 'all') {
                    await props.actions.searchGroups(params);
                } else {
                    params.filter_has_member = props.currentUserId;
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
            page: page,
            per_page: GROUPS_PER_PAGE,
            include_member_count: true,
            filter_has_member: currentUserId,
            include_archived: true,
        };
        const data = await actions.getGroupsByUserIdPaginated(groupsParams);
        if (data.data.length === 0) {
            setMyGroupsFull(true);
        }
        setLoading(false);
        setSelectedFilter('my');
    }, [props.actions.getGroupsByUserIdPaginated, props.currentUserId, page]);

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
    }, [selectedFilter, myGroupsPage, page, getGroups, getMyGroups]);

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
                    <div className='more-modal__dropdown'>
                        <MenuWrapper id='groupsFilterDropdown'>
                            <a>
                                <span>{selectedFilter === 'all' ? Utils.localizeMessage('user_groups_modal.showAllGroups', 'Show: All Groups') : Utils.localizeMessage('user_groups_modal.showMyGroups', 'Show: My Groups')}</span>
                                <span className='icon icon-chevron-down'/>
                            </a>
                            <Menu
                                openLeft={false}
                                ariaLabel={Utils.localizeMessage('user_groups_modal.filterAriaLabel', 'Groups Filter Menu')}
                            >
                                <Menu.Group>
                                    <Menu.ItemAction
                                        id='groupsDropdownAll'
                                        buttonClass='groups-filter-btn'
                                        onClick={() => {
                                            getGroups(0);
                                        }}
                                        text={Utils.localizeMessage('user_groups_modal.allGroups', 'All Groups')}
                                        rightDecorator={selectedFilter === 'all' && <i className='icon icon-check'/>}
                                    />
                                    <Menu.ItemAction
                                        id='groupsDropdownMy'
                                        buttonClass='groups-filter-btn'
                                        onClick={() => {
                                            getMyGroups(0);
                                        }}
                                        text={Utils.localizeMessage('user_groups_modal.myGroups', 'My Groups')}
                                        rightDecorator={selectedFilter !== 'all' && <i className='icon icon-check'/>}
                                    />
                                </Menu.Group>
                                <Menu.Group>
                                    <Menu.ItemAction
                                        id='groupsDropdownArchived'
                                        buttonClass='groups-filter-btn'
                                        onClick={() => {
                                            // getMyGroups(0);
                                        }}
                                        text={Utils.localizeMessage('user_groups_modal.myGroups', 'My Groups')}
                                        rightDecorator={selectedFilter !== 'all' && <i className='icon icon-check'/>}
                                    />
                                </Menu.Group>
                            </Menu>
                        </MenuWrapper>
                    </div>
                    <UserGroupsList
                        groups={groups}
                        searchTerm={props.searchTerm}
                        loading={loading}
                        hasNextPage={selectedFilter === 'all' ? !allGroupsFull : !myGroupsFull}
                        loadMoreGroups={loadMoreGroups}
                        ref={divScrollRef}
                        onExited={props.onExited}
                        backButtonAction={props.backButtonAction}
                    />
                </>
                }
            </Modal.Body>
        </Modal>
    );
}

export default React.memo(UserGroupsModal);
