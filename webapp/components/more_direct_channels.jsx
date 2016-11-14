// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import SearchableUserList from 'components/searchable_user_list.jsx';
import SpinnerButton from 'components/spinner_button.jsx';

import {searchUsers} from 'actions/user_actions.jsx';
import {openDirectChannelToUser} from 'actions/channel_actions.jsx';

import UserStore from 'stores/user_store.jsx';
import TeamStore from 'stores/team_store.jsx';

import * as AsyncClient from 'utils/async_client.jsx';
import * as UserAgent from 'utils/user_agent.jsx';
import Constants from 'utils/constants.jsx';

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';
import {browserHistory} from 'react-router/es6';

const USERS_PER_PAGE = 50;

export default class MoreDirectChannels extends React.Component {
    constructor(props) {
        super(props);

        this.handleHide = this.handleHide.bind(this);
        this.handleExit = this.handleExit.bind(this);
        this.handleShowDirectChannel = this.handleShowDirectChannel.bind(this);
        this.onChange = this.onChange.bind(this);
        this.createJoinDirectChannelButton = this.createJoinDirectChannelButton.bind(this);
        this.toggleList = this.toggleList.bind(this);
        this.nextPage = this.nextPage.bind(this);
        this.search = this.search.bind(this);

        this.state = {
            users: null,
            loadingDMChannel: -1,
            listType: 'team',
            show: true,
            search: false
        };
    }

    componentDidMount() {
        UserStore.addChangeListener(this.onChange);
        UserStore.addInTeamChangeListener(this.onChange);
        UserStore.addStatusesChangeListener(this.onChange);
        TeamStore.addChangeListener(this.onChange);

        AsyncClient.getProfiles(0, Constants.PROFILE_CHUNK_SIZE);
        AsyncClient.getProfilesInTeam(TeamStore.getCurrentId(), 0, Constants.PROFILE_CHUNK_SIZE);
    }

    componentWillUnmount() {
        UserStore.removeChangeListener(this.onChange);
        UserStore.removeInTeamChangeListener(this.onChange);
        UserStore.removeStatusesChangeListener(this.onChange);
        TeamStore.removeChangeListener(this.onChange);
    }

    handleHide() {
        this.setState({show: false});
    }

    handleExit() {
        if (this.exitToDirectChannel) {
            browserHistory.push(this.exitToDirectChannel);
        }

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
        openDirectChannelToUser(
            teammate,
            (channel) => {
                // Due to how react-overlays Modal handles focus, we delay pushing
                // the new channel information until the modal is fully exited.
                // The channel information will be pushed in `handleExit`
                this.exitToDirectChannel = TeamStore.getCurrentTeamRelativeUrl() + '/channels/' + channel.name;
                this.setState({loadingDMChannel: -1});
                this.handleHide();
            },
            () => {
                this.setState({loadingDMChannel: -1});
            }
        );
    }

    onChange(force) {
        if (this.state.search && !force) {
            return;
        }

        let users;
        if (this.state.listType === 'any') {
            users = UserStore.getProfileList();
        } else {
            users = UserStore.getProfileListInTeam(TeamStore.getCurrentId(), true, true);
        }

        this.setState({
            users
        });
    }

    toggleList(e) {
        const listType = e.target.value;
        let users;
        if (listType === 'any') {
            users = UserStore.getProfileList();
        } else {
            users = UserStore.getProfileListInTeam(TeamStore.getCurrentId(), true, true);
        }

        this.setState({
            users,
            listType
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

    nextPage(page) {
        if (this.state.listType === 'any') {
            AsyncClient.getProfiles((page + 1) * USERS_PER_PAGE, USERS_PER_PAGE);
        } else {
            AsyncClient.getProfilesInTeam(TeamStore.getCurrentId(), (page + 1) * USERS_PER_PAGE, USERS_PER_PAGE);
        }
    }

    search(term) {
        if (term === '') {
            this.onChange(true);
            this.setState({search: false});
            return;
        }

        let teamId;
        if (this.state.listType === 'any') {
            teamId = '';
        } else {
            teamId = TeamStore.getCurrentId();
        }

        searchUsers(
            term,
            teamId,
            {},
            (users) => {
                for (let i = 0; i < users.length; i++) {
                    if (users[i].id === UserStore.getCurrentId()) {
                        users.splice(i, 1);
                        break;
                    }
                }
                this.setState({search: true, users});
            }
        );
    }

    render() {
        let teamToggle;
        if (global.window.mm_config.RestrictDirectMessage === 'any') {
            teamToggle = (
                <div className='member-select__container'>
                    <select
                        className='form-control'
                        id='restrictList'
                        ref='restrictList'
                        defaultValue='team'
                        onChange={this.toggleList}
                    >
                        <option value='any'>
                            <FormattedMessage
                                id='filtered_user_list.any_team'
                                defaultMessage='All Users'
                            />
                        </option>
                        <option value='team'>
                            <FormattedMessage
                                id='filtered_user_list.team_only'
                                defaultMessage='Members of this Team'
                            />
                        </option>
                    </select>
                    <span
                        className='member-show'
                    >
                        <FormattedMessage
                            id='filtered_user_list.show'
                            defaultMessage='Filter:'
                        />
                    </span>
                </div>
            );
        }

        return (
            <Modal
                dialogClassName='more-modal more-direct-channels'
                show={this.state.show}
                onHide={this.handleHide}
                onExited={this.handleExit}
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
                    {teamToggle}
                    <SearchableUserList
                        key={'moreDirectChannelsList_' + this.state.listType}
                        users={this.state.users}
                        usersPerPage={USERS_PER_PAGE}
                        nextPage={this.nextPage}
                        search={this.search}
                        actions={[this.createJoinDirectChannelButton]}
                        focusOnMount={!UserAgent.isMobile()}
                    />
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
    onModalDismissed: React.PropTypes.func
};
