// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {ActionTypes, WebrtcActionTypes} from 'utils/constants.jsx';
import * as GlobalActions from 'actions/global_actions.jsx';
import ModalStore from 'stores/modal_store.jsx';
import UserStore from 'stores/user_store.jsx';
import WebrtcStore from 'stores/webrtc_store.jsx';

import {intlShape, injectIntl, FormattedMessage} from 'react-intl';

import {Modal} from 'react-bootstrap';

import React from 'react';

class LeaveTeamModal extends React.Component {
    constructor(props) {
        super(props);

        this.handleToggle = this.handleToggle.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleHide = this.handleHide.bind(this);
        this.handleKeyPress = this.handleKeyPress.bind(this);

        this.state = {
            show: false
        };
    }

    componentDidMount() {
        ModalStore.addModalListener(ActionTypes.TOGGLE_LEAVE_TEAM_MODAL, this.handleToggle);
        document.addEventListener('keypress', this.handleKeyPress);
    }

    componentWillUnmount() {
        ModalStore.removeModalListener(ActionTypes.TOGGLE_LEAVE_TEAM_MODAL, this.handleToggle);
        document.removeEventListener('keypress', this.handleKeyPress);
    }

    handleKeyPress(e) {
        if (e.key === 'Enter' && this.state.show) {
            this.handleSubmit(e);
        }
    }

    handleToggle(value) {
        this.setState({
            show: value
        });
    }

    handleSubmit(e) {
        this.setState({
            show: false
        });

        if (WebrtcStore.isBusy()) {
            WebrtcStore.emitChanged({action: WebrtcActionTypes.IN_PROGRESS});
            e.preventDefault();
            return;
        }

        GlobalActions.emitLeaveTeam();
        GlobalActions.toggleSideBarRightMenuAction();
    }

    handleHide() {
        this.setState({
            show: false
        });
    }

    render() {
        var currentUser = UserStore.getCurrentUser();

        if (currentUser != null) {
            return (
                <Modal
                    className='modal-confirm'
                    show={this.state.show}
                    onHide={this.handleHide}
                >
                    <Modal.Header closeButton={false}>
                        <Modal.Title>
                            <FormattedMessage
                                id='leave_team_modal.title'
                                defaultMessage='Leave the team?'
                            />
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <FormattedMessage
                            id='leave_team_modal.desc'
                            defaultMessage='You will be removed from all public and private channels.  If the team is private you will not be able to rejoin the team.  Are you sure?'
                        />
                    </Modal.Body>
                    <Modal.Footer>
                        <button
                            type='button'
                            className='btn btn-default'
                            onClick={this.handleHide}
                        >
                            <FormattedMessage
                                id='leave_team_modal.no'
                                defaultMessage='No'
                            />
                        </button>
                        <button
                            type='button'
                            className='btn btn-danger'
                            onClick={this.handleSubmit}
                        >
                            <FormattedMessage
                                id='leave_team_modal.yes'
                                defaultMessage='Yes'
                            />
                        </button>
                    </Modal.Footer>
                </Modal>
            );
        }

        return null;
    }
}

LeaveTeamModal.propTypes = {
    intl: intlShape.isRequired
};

export default injectIntl(LeaveTeamModal);
