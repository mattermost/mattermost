// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import type {AccessControlTestResult} from '@mattermost/types/admin';
import type {TeamMembership} from '@mattermost/types/teams';

import type {ModalData} from 'types/actions';
import SearchableUserList from 'components/searchable_user_list/searchable_user_list_container';

import './test_modal.scss';

const USERS_PER_PAGE = 10;

type Props = {
    testResults: AccessControlTestResult | null;
    onExited: () => void;
    onLoad?: () => void;
    actions: {
        openModal: <P>(modalData: ModalData<P>) => void;
        setModalSearchTerm: (term: string) => void;
    };
}

const TestResultsModal: React.FC<Props> = ({testResults, onExited, onLoad, actions}) => {
    useEffect(() => {
        onLoad?.();
        return () => {
            actions.setModalSearchTerm('');
        };
    }, [onLoad, actions]);

    // TODO: Make search function actually work
    // Ideally we need to pass the expression here and filter the users based on the expression
    const users = Array.isArray(testResults?.users) ? testResults.users : [];
    const total = users.length;

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
                    nextPage={() => {}}
                    search={actions.setModalSearchTerm}
                    actionUserProps={{}}
                />
            </Modal.Body>
        </Modal>
    );
};

export default TestResultsModal;
