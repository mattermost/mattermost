// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import type {AccessControlTestResult} from '@mattermost/types/admin';
import type {TeamMembership} from '@mattermost/types/teams';

import type {ModalData} from 'types/actions';
import SearchableUserList from 'components/searchable_user_list/searchable_user_list_container';

import './test_modal.scss';
import { ActionResult } from 'mattermost-redux/types/actions';

const USERS_PER_PAGE = 10;  

type Props = {
    testResults: AccessControlTestResult | null;
    onExited: () => void;
    onLoad?: () => void;
    actions: {
        openModal: <P>(modalData: ModalData<P>) => void;
        setModalSearchTerm: (term: string) => ActionResult;
    };
}

type State = {
    show: boolean;
}


export default class TestResultsModal extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            show: true,
        };
    }

    componentDidMount() {
        if (this.props.onLoad) {
            this.props.onLoad();
        }
    }

    componentWillUnmount() {
        this.props.actions.setModalSearchTerm('');
    }

    handleHide = () => {
        this.setState({show: false});
    };

    search = (term: string) => {
        this.props.actions.setModalSearchTerm(term);
    };

    render() {
        const actionUserProps: {
            [userId: string]: {
                teamMember: TeamMembership;
            };
        } = {};

        // Ensure users is always an array
        const users = Array.isArray(this.props.testResults?.users) ? this.props.testResults.users : [];
        const total = users.length;

        return (
            <Modal
                dialogClassName='a11y__modal test-results-modal'
                show={this.state.show}
                onHide={this.handleHide}
                onExited={this.props.onExited}
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
                        search={this.search}
                        actionUserProps={actionUserProps}
                    />
                </Modal.Body>
            </Modal>
        );
    }
}
