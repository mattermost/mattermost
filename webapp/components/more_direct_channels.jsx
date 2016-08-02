// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import FilteredUserList from 'components/filtered_user_list.jsx';
import SpinnerButton from 'components/spinner_button.jsx';
import LoadingScreen from 'components/loading_screen.jsx';

import {getMoreDmList} from 'actions/user_actions.jsx';

import UserStore from 'stores/user_store.jsx';
import TeamStore from 'stores/team_store.jsx';

import * as Utils from 'utils/utils.jsx';

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';
import {browserHistory} from 'react-router/es6';

export default class MoreDirectChannels extends React.Component {
    constructor(props) {
        super(props);

        this.handleHide = this.handleHide.bind(this);
        this.handleShowDirectChannel = this.handleShowDirectChannel.bind(this);
        this.handleUserChange = this.handleUserChange.bind(this);
        this.onTeamChange = this.onTeamChange.bind(this);
        this.createJoinDirectChannelButton = this.createJoinDirectChannelButton.bind(this);

        this.state = {
            users: UserStore.getProfilesForDmList(),
            teamMembers: TeamStore.getMembersForTeam(),
            loadingDMChannel: -1,
            usersLoaded: false,
            teamMembersLoaded: false
        };
    }

    componentDidMount() {
        UserStore.addDmListChangeListener(this.handleUserChange);
        TeamStore.addChangeListener(this.onTeamChange);
    }

    componentWillUnmount() {
        UserStore.removeDmListChangeListener(this.handleUserChange);
        TeamStore.removeChangeListener(this.onTeamChange);
    }

    shouldComponentUpdate(nextProps, nextState) {
        if (nextProps.show !== this.props.show) {
            return true;
        }

        if (nextProps.onModalDismissed.toString() !== this.props.onModalDismissed.toString()) {
            return true;
        }

        if (nextState.loadingDMChannel !== this.state.loadingDMChannel) {
            return true;
        }

        if (!Utils.areObjectsEqual(nextState.users, this.state.users)) {
            return true;
        }

        if (!Utils.areObjectsEqual(nextState.teamMembers, this.state.teamMembers)) {
            return true;
        }

        return false;
    }

    handleHide() {
        if (this.props.onModalDismissed) {
            this.props.onModalDismissed();
        }
    }

    handleShowDirectChannel(teammate, e) {
        e.preventDefault();

        if (this.state.loadingDMChannel !== -1) {
            return;
        }

        this.setState({loadingDMChannel: teammate.id});
        Utils.openDirectChannelToUser(
            teammate,
            (channel) => {
                browserHistory.push(TeamStore.getCurrentTeamUrl() + '/channels/' + channel.name);
                this.setState({loadingDMChannel: -1});
                this.handleHide();
            },
            () => {
                this.setState({loadingDMChannel: -1});
            }
        );
    }

    handleUserChange() {
        this.setState({
            users: UserStore.getProfilesForDmList(),
            usersLoaded: true
        });
    }

    onTeamChange() {
        this.setState({
            teamMembers: TeamStore.getMembersForTeam(),
            teamMembersLoaded: true
        });
    }

    createJoinDirectChannelButton({user}) {
        return (
            <SpinnerButton
                className='btn btm-sm btn-primary'
                spinning={this.state.loadingDMChannel === user.id}
                onClick={this.handleShowDirectChannel.bind(this, user)}
            >
                <FormattedMessage
                    id='more_direct_channels.message'
                    defaultMessage='Message'
                />
            </SpinnerButton>
        );
    }

    render() {
        let maxHeight = 1000;
        if (Utils.windowHeight() <= 1200) {
            maxHeight = Utils.windowHeight() - 300;
        }

        var body = null;
        if (!this.state.usersLoaded || !this.state.teamMembersLoaded) {
            body = (<LoadingScreen/>);
        } else {
            var showTeamToggle = false;
            if (global.window.mm_config.RestrictDirectMessage === 'any') {
                showTeamToggle = true;
            }

            body = (
                <FilteredUserList
                    style={{maxHeight}}
                    users={this.state.users}
                    teamMembers={this.state.teamMembers}
                    actions={[this.createJoinDirectChannelButton]}
                    showTeamToggle={showTeamToggle}
                />
            );
        }

        return (
            <Modal
                dialogClassName='more-modal more-direct-channels'
                show={this.props.show}
                onHide={this.handleHide}
                onEntered={getMoreDmList}
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title>
                        <FormattedMessage
                            id='more_direct_channels.title'
                            defaultMessage='Direct Messages'
                        />
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {body}
                </Modal.Body>
                <Modal.Footer>
                    <button
                        type='button'
                        className='btn btn-default'
                        onClick={this.handleHide}
                    >
                        <FormattedMessage
                            id='more_direct_channels.close'
                            defaultMessage='Close'
                        />
                    </button>
                </Modal.Footer>
            </Modal>
        );
    }
}

MoreDirectChannels.propTypes = {
    show: React.PropTypes.bool.isRequired,
    onModalDismissed: React.PropTypes.func
};
