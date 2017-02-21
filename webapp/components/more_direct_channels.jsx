// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import ProfilePicture from 'components/profile_picture.jsx';

import {searchUsers, loadProfiles} from 'actions/user_actions.jsx';
import {openDirectChannelToUser, openGroupChannelToUsers} from 'actions/channel_actions.jsx';

import UserStore from 'stores/user_store.jsx';
import TeamStore from 'stores/team_store.jsx';

import Client from 'client/web_client.jsx';
import * as Utils from 'utils/utils.jsx';

import React from 'react';
import ReactSelect from 'react-select';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';
import {browserHistory} from 'react-router/es6';

const USERS_PER_PAGE = 50;

export default class MoreDirectChannels extends React.Component {
    constructor(props) {
        super(props);

        this.handleHide = this.handleHide.bind(this);
        this.handleExit = this.handleExit.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleChange = this.handleChange.bind(this);

        this.searchTimeoutId = 0;

        this.state = {
            users: null,
            loadingChannel: -1,
            show: true,
            values: []
        };
    }

    componentDidMount() {
        this.refs.select.focus();
    }

    handleHide() {
        this.setState({show: false});
    }

    handleExit() {
        if (this.exitToChannel) {
            browserHistory.push(this.exitToChannel);
        }

        if (this.props.onModalDismissed) {
            this.props.onModalDismissed();
        }
    }

    handleChange(users) {
        const values = users.map((n) => {
            return n.value;
        });

        this.setState({values});
    }

    handleSubmit(e) {
        e.preventDefault();

        if (this.state.loadingChannel !== -1) {
            return;
        }

        this.setState({loadingChannel: 1});

        const success = (channel) => {
            // Due to how react-overlays Modal handles focus, we delay pushing
            // the new channel information until the modal is fully exited.
            // The channel information will be pushed in `handleExit`
            this.exitToChannel = TeamStore.getCurrentTeamRelativeUrl() + '/channels/' + channel.name;
            this.setState({loadingChannel: -1});
            this.handleHide();
        };

        const error = () => {
            this.setState({loadingChannel: -1});
        };

        const userIds = this.state.values;
        if (userIds.length === 1) {
            openDirectChannelToUser(userIds[0], success, error);
        } else {
            openGroupChannelToUsers(userIds, success, error);
        }
    }

    search(input, callback) {
        if (input === '') {
            loadProfiles(
                0,
                USERS_PER_PAGE,
                (users) => {
                    const userList = [];
                    for (const key in users) {
                        if (!users.hasOwnProperty(key)) {
                            continue;
                        }

                        const user = users[key];
                        if (user.id !== UserStore.getCurrentId()) {
                            user.value = user.id;
                            user.label = '@' + user.username;
                            userList.push(user);
                        }
                    }

                    callback(null, {
                        options: userList,
                        complete: true
                    });
                }
            );
        } else {
            searchUsers(
                input,
                '',
                {},
                (users) => {
                    let indexToDelete = -1;
                    for (let i = 0; i < users.length; i++) {
                        if (users[i].id === UserStore.getCurrentId()) {
                            indexToDelete = i;
                        }
                        users[i].value = users[i].username.id;
                        users[i].label = '@' + users[i].username;
                    }

                    users.splice(indexToDelete, 1);

                    callback(null, {
                        options: users,
                        complete: true
                    });
                }
            );
        }
    }

    renderOption(user) {
        return (
            <div
                key={user.id}
                className='asaad-please-fix'
            >
                <ProfilePicture
                    src={`${Client.getUsersRoute()}/${user.id}/image?time=${user.last_picture_update}`}
                    width='32'
                    height='32'
                />
                <div
                    className='asaad-please-fix'
                >
                    <div className='asaad-please-fix'>
                        {Utils.displayUsernameForUser(user)}
                    </div>
                    <div className='asaad-please-fix'>
                        {user.email}
                    </div>
                </div>
            </div>
        );
    }

    renderValue(user) {
        return user.username;
    }

    render() {
        return (
            <Modal
                dialogClassName={'more-modal more-direct-channels'}
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
                <Modal.Body style={{overflow: 'visible'}}>
                    <ReactSelect.Async
                        ref='select'
                        multi={true}
                        loadOptions={this.search}
                        optionRenderer={this.renderOption}
                        joinValues={true}
                        clearable={false}
                        openOnFocus={true}
                        onChange={this.handleChange}
                        value={this.state.values}
                        valueRenderer={this.renderValue}
                    />
                    <button
                        className='btn btn-primary pull-right'
                        onClick={this.handleSubmit}
                        disabled={this.state.values.length === 0}
                    >
                        <FormattedMessage
                            id='dm.list.go'
                            defaultMessage='Go'
                        />
                    </button>
                </Modal.Body>
            </Modal>
        );
    }
}

MoreDirectChannels.propTypes = {
    onModalDismissed: React.PropTypes.func
};
