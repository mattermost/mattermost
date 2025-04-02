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
                        <div className='attributes-container'>
                        {this.props.testResults?.attributes?.map((attribute, index) => (
                            <span
                                key={index}
                                className='attribute-pill'
                                style={{
                                    backgroundColor: `hsl(${Math.random() * 360}, 70%, 85%)`,
                                }}
                            >
                                {attribute}
                            </span>
                        ))}
                    </div>
                    </Modal.Title>

                </Modal.Header>
                <Modal.Body>
                    <SearchableUserList
                 users={this.props.testResults?.users || []}
                usersPerPage={USERS_PER_PAGE}
                total={this.props.testResults?.users.length || 0}
                nextPage={() => {}}
                search={this.search}
                actionUserProps={actionUserProps}
            />
                </Modal.Body>
            </Modal>
        );
    }
}
