// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef, useState, useEffect, useCallback} from 'react';
import {Modal} from 'react-bootstrap';
import {defineMessage, FormattedMessage} from 'react-intl';

import {useFocusTrap} from '@mattermost/components/src/hooks/useFocusTrap';
import type {Group} from '@mattermost/types/groups';
import {GroupSource, PluginGroupSourcePrefix} from '@mattermost/types/groups';
import type {UserProfile} from '@mattermost/types/users';

import {debounce} from 'mattermost-redux/actions/helpers';
import type {ActionResult} from 'mattermost-redux/types/actions';

import LoadingScreen from 'components/loading_screen';
import NoResultsIndicator from 'components/no_results_indicator';
import {NoResultsVariant} from 'components/no_results_indicator/types';
import Input from 'components/widgets/inputs/input/input';

import Constants from 'utils/constants';

import ViewUserGroupListItem from './view_user_group_list_item';
import ViewUserGroupModalHeader from './view_user_group_modal_header';

import './view_user_group_modal.scss';

const USERS_PER_PAGE = 60;

export type Props = {
    onExited: () => void;
    searchTerm: string;
    groupId: string;
    group?: Group;
    users: UserProfile[];
    backButtonCallback: () => void;
    backButtonAction: () => void;
    actions: {
        getGroup: (groupId: string, includeMemberCount: boolean) => Promise<ActionResult<Group>>;
        getUsersInGroup: (groupId: string, page: number, perPage: number) => Promise<ActionResult<UserProfile[]>>;
        setModalSearchTerm: (term: string) => void;
        searchProfiles: (term: string, options: any) => Promise<ActionResult>;
    };
}

const ViewUserGroupModal: React.FC<Props> = ({
    onExited,
    searchTerm,
    groupId,
    group,
    users,
    backButtonCallback,
    backButtonAction,
    actions,
}) => {
    const divScrollRef = useRef<HTMLDivElement>(null);
    const searchTimeoutIdRef = useRef<number>(0);
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(true);
    const [show, setShow] = useState(true);
    const [memberCount, setMemberCount] = useState(group?.member_count || 0);

    const modalRef = useRef<HTMLDivElement>(null);
    useFocusTrap(show, modalRef);

    const incrementMemberCount = useCallback(() => {
        setMemberCount((prev) => prev + 1);
    }, []);

    const decrementMemberCount = useCallback(() => {
        setMemberCount((prev) => prev - 1);
    }, []);

    const doHide = useCallback(() => {
        setShow(false);
    }, []);

    const startLoad = useCallback(() => {
        setLoading(true);
    }, []);

    const loadComplete = useCallback(() => {
        setLoading(false);
    }, []);

    const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const term = e.target.value;
        actions.setModalSearchTerm(term);
    }, [actions]);

    const getGroupMembers = useCallback(
        debounce(
            async () => {
                const newPage = page + 1;
                setPage(newPage);
                startLoad();
                await actions.getUsersInGroup(groupId, newPage, USERS_PER_PAGE);
                loadComplete();
            },
            200,
            false,
            () => {},
        ),
        [page, groupId, actions, startLoad, loadComplete],
    );

    const onScroll = useCallback(() => {
        const scrollHeight = divScrollRef.current?.scrollHeight || 0;
        const scrollTop = divScrollRef.current?.scrollTop || 0;
        const clientHeight = divScrollRef.current?.clientHeight || 0;

        if (((scrollTop + clientHeight + 30) >= scrollHeight && group) && (users.length !== group.member_count && !loading)) {
            getGroupMembers();
        }
    }, [group, users.length, loading, getGroupMembers]);

    useEffect(() => {
        const fetchData = async () => {
            await Promise.all([
                actions.getGroup(groupId, true),
                actions.getUsersInGroup(groupId, 0, USERS_PER_PAGE),
            ]);
            loadComplete();
        };
        fetchData();

        return () => {
            actions.setModalSearchTerm('');
        };
    }, [groupId, actions, loadComplete]);

    useEffect(() => {
        if (group?.member_count !== undefined && group.member_count !== memberCount) {
            setMemberCount(group.member_count);
        }
    }, [group?.member_count]);

    useEffect(() => {
        if (searchTerm === '') {
            loadComplete();
            searchTimeoutIdRef.current = 0;
            return () => {};
        }

        clearTimeout(searchTimeoutIdRef.current);
        searchTimeoutIdRef.current = window.setTimeout(
            async () => {
                await actions.searchProfiles(searchTerm, {in_group_id: groupId});
            },
            Constants.SEARCH_TIMEOUT_MILLISECONDS,
        );

        return () => {
            clearTimeout(searchTimeoutIdRef.current);
        };
    }, [searchTerm, groupId, actions, loadComplete]);

    const mentionName = () => {
        if (group) {
            return (
                <div className='group-mention-name'>
                    <span className='group-name'>{`@${group.name}`}</span>
                    {
                        group.source.toLowerCase() === GroupSource.Ldap &&
                        <span className='group-source'>
                            <FormattedMessage
                                id='view_user_group_modal.ldapSynced'
                                defaultMessage='AD/LDAP SYNCED'
                            />
                        </span>
                    }
                    {
                        group.source.toLowerCase().startsWith(PluginGroupSourcePrefix.Plugin) &&
                        <span className='group-source'>
                            <FormattedMessage
                                id='view_user_group_modal.pluginSynced'
                                defaultMessage='Plugin SYNCED'
                            />
                        </span>
                    }
                </div>
            );
        }
        return (<></>);
    };

    return (
        <Modal
            dialogClassName='a11y__modal view-user-groups-modal'
            show={show}
            onHide={doHide}
            onExited={onExited}
            role='none'
            aria-labelledby='viewUserGroupModalLabel'
            enforceFocus={false}
        >
            <div ref={modalRef}>
                <ViewUserGroupModalHeader
                    onExited={onExited}
                    groupId={groupId}
                    backButtonCallback={backButtonCallback}
                    backButtonAction={backButtonAction}
                    incrementMemberCount={incrementMemberCount}
                    decrementMemberCount={decrementMemberCount}
                />
                <Modal.Body>
                    {mentionName()}
                    {((users.length === 0 && !searchTerm && !loading) || !group) ? (
                        <NoResultsIndicator
                            variant={NoResultsVariant.UserGroupMembers}
                        />
                    ) : (
                        <>
                            <div className='user-groups-search'>
                                <Input
                                    type='text'
                                    placeholder={defineMessage({id: 'search_bar.searchGroupMembers', defaultMessage: 'Search group members'})}
                                    onChange={handleSearch}
                                    value={searchTerm}
                                    data-testid='searchInput'
                                    className={'user-group-search-input'}
                                    inputPrefix={<i className={'icon icon-magnify'}/>}
                                />
                            </div>
                            <div
                                className='user-groups-modal__content group-member-list'
                                onScroll={onScroll}
                                ref={divScrollRef}
                            >
                                {(users.length !== 0) &&
                                <h2 className='group-member-count'>
                                    <FormattedMessage
                                        id='view_user_group_modal.memberCount'
                                        defaultMessage='{member_count} {member_count, plural, one {Member} other {Members}}'
                                        values={{
                                            member_count: memberCount,
                                        }}
                                    />
                                </h2>
                                }
                                {(users.length === 0 && searchTerm) &&
                                <NoResultsIndicator
                                    variant={NoResultsVariant.Search}
                                    titleValues={{channelName: `${searchTerm}`}}
                                />
                                }
                                {users.map((user) => (
                                    <ViewUserGroupListItem
                                        groupId={groupId}
                                        user={user}
                                        decrementMemberCount={decrementMemberCount}
                                        key={user.id}
                                    />
                                ))}
                                {
                                    loading &&
                                    <LoadingScreen/>
                                }
                            </div>
                        </>
                    )}
                </Modal.Body>
            </div>
        </Modal>
    );
};

export default ViewUserGroupModal;
