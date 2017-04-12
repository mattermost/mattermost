// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import MultiSelect from 'components/multiselect/multiselect.jsx';
import ProfilePicture from 'components/profile_picture.jsx';

import {searchUsers} from 'actions/user_actions.jsx';
import {openDirectChannelToUser, openGroupChannelToUsers} from 'actions/channel_actions.jsx';

import UserStore from 'stores/user_store.jsx';
import TeamStore from 'stores/team_store.jsx';

import * as AsyncClient from 'utils/async_client.jsx';
import Constants from 'utils/constants.jsx';
import {displayUsernameForUser} from 'utils/utils.jsx';
import Client from 'client/web_client.jsx';

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';
import {browserHistory} from 'react-router/es6';

const USERS_PER_PAGE = 50;
const MAX_SELECTABLE_VALUES = Constants.MAX_USERS_IN_GM - 1;

export default class MoreDirectChannels extends React.Component {
    constructor(props) {
        super(props);

        this.handleHide = this.handleHide.bind(this);
        this.handleExit = this.handleExit.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleDelete = this.handleDelete.bind(this);
        this.onChange = this.onChange.bind(this);
        this.search = this.search.bind(this);
        this.addValue = this.addValue.bind(this);

        this.searchTimeoutId = 0;
        this.listType = global.window.mm_config.RestrictDirectMessage;

        const values = [];
        if (props.startingUsers) {
            for (let i = 0; i < props.startingUsers.length; i++) {
                const user = Object.assign({}, props.startingUsers[i]);
                user.value = user.id;
                user.label = '@' + user.username;
                values.push(user);
            }
        }

        this.state = {
            users: null,
            values,
            show: true,
            search: false,
            loadingChannel: -1
        };
    }

    componentDidMount() {
        UserStore.addChangeListener(this.onChange);
        UserStore.addInTeamChangeListener(this.onChange);
        UserStore.addStatusesChangeListener(this.onChange);

        if (this.listType === 'any') {
            AsyncClient.getProfiles(0, USERS_PER_PAGE * 2);
        } else {
            AsyncClient.getProfilesInTeam(TeamStore.getCurrentId(), 0, USERS_PER_PAGE * 2);
        }
    }

    componentWillUnmount() {
        UserStore.removeChangeListener(this.onChange);
        UserStore.removeInTeamChangeListener(this.onChange);
        UserStore.removeStatusesChangeListener(this.onChange);
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

    handleSubmit(e) {
        if (e) {
            e.preventDefault();
        }

        if (this.state.loadingChannel !== -1) {
            return;
        }

        const userIds = this.state.values.map((v) => v.id);
        if (userIds.length === 0) {
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

        if (userIds.length === 1) {
            openDirectChannelToUser(userIds[0], success, error);
        } else {
            openGroupChannelToUsers(userIds, success, error);
        }
    }

    addValue(value) {
        const values = Object.assign([], this.state.values);
        if (values.indexOf(value) === -1) {
            values.push(value);
        }

        this.setState({values});
    }

    onChange(force) {
        if (this.state.search && !force) {
            return;
        }

        let users;
        if (this.listType === 'any') {
            users = Object.assign([], UserStore.getProfileList(true));
        } else {
            users = Object.assign([], UserStore.getProfileListInTeam(TeamStore.getCurrentId(), true));
        }

        for (let i = 0; i < users.length; i++) {
            const user = Object.assign({}, users[i]);
            user.value = user.id;
            user.label = '@' + user.username;
            users[i] = user;
        }

        this.setState({
            users
        });
    }

    handlePageChange(page, prevPage) {
        if (page > prevPage) {
            AsyncClient.getProfiles((page + 1) * USERS_PER_PAGE, USERS_PER_PAGE);
        }
    }

    search(term) {
        clearTimeout(this.searchTimeoutId);

        if (term === '') {
            this.onChange(true);
            this.setState({search: false});
            this.searchTimeoutId = '';
            return;
        }

        let teamId;
        if (this.listType === 'any') {
            teamId = '';
        } else {
            teamId = TeamStore.getCurrentId();
        }

        const searchTimeoutId = setTimeout(
            () => {
                searchUsers(
                    term,
                    teamId,
                    {},
                    (users) => {
                        if (searchTimeoutId !== this.searchTimeoutId) {
                            return;
                        }

                        let indexToDelete = -1;
                        for (let i = 0; i < users.length; i++) {
                            if (users[i].id === UserStore.getCurrentId()) {
                                indexToDelete = i;
                            }
                            users[i].value = users[i].id;
                            users[i].label = '@' + users[i].username;
                        }

                        if (indexToDelete !== -1) {
                            users.splice(indexToDelete, 1);
                        }
                        this.setState({search: true, users});
                    }
                );
            },
            Constants.SEARCH_TIMEOUT_MILLISECONDS
        );

        this.searchTimeoutId = searchTimeoutId;
    }

    handleDelete(values) {
        this.setState({values});
    }

    renderOption(option, isSelected, onAdd) {
        var rowSelected = '';
        if (isSelected) {
            rowSelected = 'more-modal__row--selected';
        }

        return (
            <div
                key={option.id}
                ref={isSelected ? 'selected' : option.id}
                className={'more-modal__row clickable ' + rowSelected}
                onClick={() => onAdd(option)}
            >
                <ProfilePicture
                    src={`${Client.getUsersRoute()}/${option.id}/image?time=${option.last_picture_update}`}
                    width='32'
                    height='32'
                />
                <div
                    className='more-modal__details'
                >
                    <div className='more-modal__name'>
                        {displayUsernameForUser(option)}
                    </div>
                    <div className='more-modal__description'>
                        {option.email}
                    </div>
                </div>
                <div className='more-modal__actions'>
                    <div className='more-modal__actions--round'>
                        <i className='fa fa-plus'/>
                    </div>
                </div>
            </div>
        );
    }

    renderValue(user) {
        return user.username;
    }

    render() {
        let note;
        if (this.props.startingUsers) {
            if (this.state.values && this.state.values.length >= MAX_SELECTABLE_VALUES) {
                note = (
                    <FormattedMessage
                        id='more_direct_channels.new_convo_note.full'
                        defaultMessage='You’ve reached the maximum number of people for this conversation. Consider creating a private channel instead.'
                    />
                );
            } else {
                note = (
                    <FormattedMessage
                        id='more_direct_channels.new_convo_note'
                        defaultMessage='This will start a new conversation. If you’re adding a lot of people, consider creating a private channel instead.'
                    />
                );
            }
        }

        const numRemainingText = (
            <FormattedMessage
                id='multiselect.numPeopleRemaining'
                defaultMessage='You can add {num, number} more {num, plural, =0 {people} one {person} other {people}}. '
                values={{
                    num: MAX_SELECTABLE_VALUES - this.state.values.length
                }}
            />
        );

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
                <Modal.Body>
                    <MultiSelect
                        key='moreDirectChannelsList'
                        options={this.state.users}
                        optionRenderer={this.renderOption}
                        values={this.state.values}
                        valueRenderer={this.renderValue}
                        perPage={USERS_PER_PAGE}
                        handlePageChange={this.handlePageChange}
                        handleInput={this.search}
                        handleDelete={this.handleDelete}
                        handleAdd={this.addValue}
                        handleSubmit={this.handleSubmit}
                        noteText={note}
                        maxValues={MAX_SELECTABLE_VALUES}
                        numRemainingText={numRemainingText}
                    />
                </Modal.Body>
            </Modal>
        );
    }
}

MoreDirectChannels.propTypes = {
    startingUsers: React.PropTypes.arrayOf(React.PropTypes.object),
    onModalDismissed: React.PropTypes.func
};
