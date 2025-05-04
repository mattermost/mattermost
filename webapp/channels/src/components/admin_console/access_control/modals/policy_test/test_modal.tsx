// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {AccessControlTestResult} from '@mattermost/types/access_control';
import type {UserProfile} from '@mattermost/types/users';

import type {ActionResult} from 'mattermost-redux/types/actions';

import SearchableUserList from 'components/searchable_user_list/searchable_user_list_container';

import type {ModalData} from 'types/actions';
import type {ActionFuncAsync} from 'types/store';

import './test_modal.scss';

const USERS_PER_PAGE = 10;

type Props = {
    onExited: () => void;
    actions: {
        searchUsers: (term: string, after: string, limit: number) => ActionFuncAsync<AccessControlTestResult>;
        openModal?: <P>(modalData: ModalData<P>) => void;
    };
}

function TestResultsModal({
    onExited,
    actions,
}: Props): JSX.Element {
    const dispatch = useDispatch<any>(); // Use any for dispatch type for simplicity, can be refined
    const [page, setPage] = useState<number>(0);
    const [after, setAfter] = useState<string>('');
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [total, setTotal] = useState<number>(0);

    useEffect(() => {
        dispatch(actions.searchUsers('', '', USERS_PER_PAGE)).
            then((result: ActionResult<AccessControlTestResult>) => {
                if (result?.data) {
                    setUsers(result.data.users || []);
                    setTotal(result.data.total || 0);
                }
            });
    }, [actions, dispatch]);

    const handleSearch = (term: string) => {
        dispatch(actions.searchUsers(term, after, USERS_PER_PAGE)).
            then((result: ActionResult<AccessControlTestResult>) => {
                if (result?.data) {
                    setUsers(result.data.users || []);
                    setTotal(result.data.total || 0);
                }
            });
    };

    const handleNextPage = () => {
        setPage(page + 1);
        setAfter(users[users.length - 1].id);
    };

    return (
        <Modal
            dialogClassName='a11y__modal test-results-modal'
            show={true}
            onHide={onExited}
            role='none'
            aria-labelledby='testResultsModalLabel'
            id='testResultsModal'
        >
            <Modal.Header closeButton={true}>
                <Modal.Title
                    componentClass='h1'
                    id='testResultsModalLabel'
                >
                    <FormattedMessage
                        id='admin.access_control.testResults'
                        defaultMessage='Access Rule Test Results'
                    />
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <SearchableUserList
                    users={users}
                    usersPerPage={USERS_PER_PAGE}
                    total={total}
                    nextPage={handleNextPage}
                    search={handleSearch}
                    actionUserProps={{}}
                />
            </Modal.Body>
        </Modal>
    );
}

export default TestResultsModal;
