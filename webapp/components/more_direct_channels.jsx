// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {Modal} from 'react-bootstrap';
import FilteredUserList from './filtered_user_list.jsx';
import UserStore from 'stores/user_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import * as Utils from 'utils/utils.jsx';
import * as GlobalActions from 'action_creators/global_actions.jsx';

import {FormattedMessage} from 'react-intl';
import {browserHistory} from 'react-router';
import SpinnerButton from 'components/spinner_button.jsx';
import LoadingScreen from 'components/loading_screen.jsx';

import React from 'react';

export default class MoreDirectChannels extends React.Component {
    constructor(props) {
        super(props);

        this.handleHide = this.handleHide.bind(this);
        this.handleOnEnter = this.handleOnEnter.bind(this);
        this.handleShowDirectChannel = this.handleShowDirectChannel.bind(this);
        this.handleUserChange = this.handleUserChange.bind(this);
        this.onTeamChange = this.onTeamChange.bind(this);
        this.createJoinDirectChannelButton = this.createJoinDirectChannelButton.bind(this);

        this.state = {
            users: null,
            teamMembers: null,
            loadingDMChannel: -1
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

    handleOnEnter() {
        this.setState({
            users: null,
            teamMembers: null
        });
    }

    handleOnEntered() {
        GlobalActions.emitProfilesForDmList();
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
                browserHistory.push(Utils.getTeamURLNoOriginFromAddressBar() + '/channels/' + channel.name);
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
            users: UserStore.getProfilesForDmList()
        });
    }

    onTeamChange() {
        this.setState({
            teamMembers: TeamStore.getMembersForTeam()
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
        if (this.state.users == null || this.state.teamMembers == null) {
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
                onEnter={this.handleOnEnter}
                onEntered={this.handleOnEntered}
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
