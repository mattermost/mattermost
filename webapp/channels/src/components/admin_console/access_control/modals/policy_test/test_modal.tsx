// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState, useCallback} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import type {AccessControlTestResult} from '@mattermost/types/access_control';
import type {UserProfile} from '@mattermost/types/users';

import type {ActionResult} from 'mattermost-redux/types/actions';

import SearchableUserList from 'components/searchable_user_list/searchable_user_list_container';

import type {ModalData} from 'types/actions';
import type {ActionFuncAsync} from 'types/store';

import './test_modal.scss';

const USERS_TO_FETCH = 50;
const USERS_PER_PAGE = 10;

type Props = {
    onExited: () => void;
    isStacked?: boolean;
    actions: {
        searchUsers: (term: string, after: string, limit: number) => ActionFuncAsync<AccessControlTestResult>;
        openModal?: <P>(modalData: ModalData<P>) => void;
    };
}

function TestResultsModal({
    onExited,
    isStacked = false,
    actions,
}: Props): JSX.Element {
    const dispatch = useDispatch();
    const [term, setTerm] = useState<string>('');
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [total, setTotal] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);
    const [cursorHistory, setCursorHistory] = useState<string[]>([]); // Stores the 'after' cursor for page 1, page 2, etc.

    const fetchUsers = useCallback(async (searchTerm: string, cursor: string, reset: boolean = false) => {
        setLoading(true);
        const result: ActionResult<AccessControlTestResult> = await dispatch(actions.searchUsers(searchTerm, cursor, USERS_TO_FETCH));
        if (result?.data) {
            const newUsers = result.data.users;
            if (reset) {
                setUsers(newUsers);
            } else {
                setUsers((prevUsers) => [...prevUsers, ...newUsers]);
            }
            setTotal(result.data.total);
        } else {
            setUsers([]);
            setTotal(0);
        }
        setLoading(false);
    }, [dispatch, actions]);

    useEffect(() => {
        fetchUsers(term, '');
    }, []);

    const handleSearch = (newTerm: string) => {
        setCursorHistory([]);
        setTerm(newTerm);
        fetchUsers(newTerm, '', true);
    };

    const handleNextPage = (page: number) => {
        if (loading || !users.length) {
            return;
        }
        if (page * USERS_PER_PAGE < USERS_TO_FETCH) {
            return;
        }
        const cursorForNextPage = users[users.length - 1].id;
        setCursorHistory([...cursorHistory, cursorForNextPage]);
        fetchUsers(term, cursorForNextPage);
    };

    const modalTitle = (
        <FormattedMessage
            id='admin.access_control.testResults'
            defaultMessage='Access Rule Test Results'
        />
    );

    return (
        <GenericModal
            className='TestResultsModal a11y__modal'
            id='testResultsModal'
            show={true}
            onHide={onExited}
            onExited={onExited}
            modalHeaderText={modalTitle}
            showCloseButton={true}
            bodyPadding={true}
            compassDesign={true}
            ariaLabel='Access Rule Test Results'
            isStacked={isStacked}
        >
            <SearchableUserList
                users={users}
                usersPerPage={USERS_PER_PAGE}
                total={total}
                nextPage={handleNextPage}
                search={handleSearch}
                actionUserProps={{}}
            />
        </GenericModal>
    );
}

export default TestResultsModal;
