// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import MemberListTeam from './member_list_team.jsx';
import TeamStore from 'stores/team_store.jsx';

import {FormattedMessage} from 'react-intl';

import {Modal} from 'react-bootstrap';

import React from 'react';

export default class TeamMembersModal extends React.Component {
    constructor(props) {
        super(props);

        this.teamChanged = this.teamChanged.bind(this);
        this.onHide = this.onHide.bind(this);

        this.state = {
            team: TeamStore.getCurrent(),
            show: true
        };
    }

    componentDidMount() {
        TeamStore.addChangeListener(this.teamChanged);
    }

    componentWillUnmount() {
        TeamStore.removeChangeListener(this.teamChanged);
    }

    teamChanged() {
        this.setState({team: TeamStore.getCurrent()});
    }

    onHide() {
        this.setState({show: false});
    }

    render() {
        let teamDisplayName = '';
        if (this.state.team) {
            teamDisplayName = this.state.team.display_name;
        }

        return (
            <Modal
                dialogClassName='more-modal'
                show={this.state.show}
                onHide={this.onHide}
                onExited={this.props.onHide}
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title>
                        <FormattedMessage
                            id='team_member_modal.members'
                            defaultMessage='{team} Members'
                            values={{
                                team: teamDisplayName
                            }}
                        />
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <MemberListTeam
                        isAdmin={this.props.isAdmin}
                    />
                </Modal.Body>
                <Modal.Footer>
                    <button
                        type='button'
                        className='btn btn-default'
                        onClick={this.onHide}
                    >
                        <FormattedMessage
                            id='team_member_modal.close'
                            defaultMessage='Close'
                        />
                    </button>
                </Modal.Footer>
            </Modal>
        );
    }
}

TeamMembersModal.propTypes = {
    onHide: React.PropTypes.func.isRequired,
    isAdmin: React.PropTypes.bool.isRequired
};
