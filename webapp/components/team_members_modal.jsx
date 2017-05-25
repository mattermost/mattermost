// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import MemberListTeam from 'components/member_list_team';
import TeamStore from 'stores/team_store.jsx';

import {FormattedMessage} from 'react-intl';

import {Modal} from 'react-bootstrap';

import PropTypes from 'prop-types';

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
        if (this.props.onLoad) {
            this.props.onLoad();
        }
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
            </Modal>
        );
    }
}

TeamMembersModal.propTypes = {
    onHide: PropTypes.func.isRequired,
    isAdmin: PropTypes.bool.isRequired,
    onLoad: PropTypes.func
};
