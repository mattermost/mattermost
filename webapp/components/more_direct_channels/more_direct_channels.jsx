// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import MultiSelect from 'components/multiselect/multiselect.jsx';
import ProfilePicture from 'components/profile_picture.jsx';

import {searchUsers} from 'actions/user_actions.jsx';
import {openDirectChannelToUser, openGroupChannelToUsers} from 'actions/channel_actions.jsx';

import UserStore from 'stores/user_store.jsx';
import TeamStore from 'stores/team_store.jsx';

import Constants from 'utils/constants.jsx';
import {displayEntireNameForUser} from 'utils/utils.jsx';
import {Client4} from 'mattermost-redux/client';

import PropTypes from 'prop-types';

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';
import {browserHistory} from 'react-router/es6';

import store from 'stores/redux_store.jsx';
import {searchProfiles, searchProfilesInCurrentTeam} from 'mattermost-redux/selectors/entities/users';

const USERS_PER_PAGE = 50;
const MAX_SELECTABLE_VALUES = Constants.MAX_USERS_IN_GM - 1;

export default class MoreDirectChannels extends React.Component {
    static propTypes = {
        startingUsers: PropTypes.arrayOf(PropTypes.object),
        onModalDismissed: PropTypes.func,
        actions: PropTypes.shape({
            getProfiles: PropTypes.func.isRequired,
            getProfilesInTeam: PropTypes.func.isRequired
        }).isRequired
    }

    constructor(props) {
        super(props);

        this.handleHide = this.handleHide.bind(this);
        this.handleExit = this.handleExit.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleDelete = this.handleDelete.bind(this);
        this.handlePageChange = this.handlePageChange.bind(this);
        this.onChange = this.onChange.bind(this);
        this.search = this.search.bind(this);
        this.addValue = this.addValue.bind(this);

        this.searchTimeoutId = 0;
        this.term = '';
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
            this.props.actions.getProfiles(0, USERS_PER_PAGE * 2);
        } else {
            this.props.actions.getProfilesInTeam(TeamStore.getCurrentId(), 0, USERS_PER_PAGE * 2);
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

    onChange() {
        let users;
        if (this.term) {
            if (this.listType === 'any') {
                users = Object.assign([], searchProfiles(store.getState(), this.term, true));
            } else {
                users = Object.assign([], searchProfilesInCurrentTeam(store.getState(), this.term, true));
            }
        } else if (this.listType === 'any') {
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
            if (this.listType === 'any') {
                this.props.actions.getProfiles(page + 1, USERS_PER_PAGE);
            } else {
                this.props.actions.getProfilesInTeam(page + 1, USERS_PER_PAGE);
            }
        }
    }

    resetPaging = () => {
        if (this.refs.multiselect) {
            this.refs.multiselect.resetPaging();
        }
    }

    search(term) {
        clearTimeout(this.searchTimeoutId);
        this.term = term;

        if (term === '') {
            this.resetPaging();
            this.onChange();
            return;
        }

        let teamId;
        if (this.listType === 'any') {
            teamId = '';
        } else {
            teamId = TeamStore.getCurrentId();
        }

        this.searchTimeoutId = setTimeout(
            () => {
                searchUsers(term, teamId, {}, this.resetPaging);
            },
            Constants.SEARCH_TIMEOUT_MILLISECONDS
        );
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
                    src={Client4.getProfilePictureUrl(option.id, option.last_picture_update)}
                    status={`${UserStore.getStatus(option.id)}`}
                    width='32'
                    height='32'
                />
                <div
                    className='more-modal__details'
                >
                    <div className='more-modal__name'>
                        {displayEntireNameForUser(option)}
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

        const buttonSubmitText = (
            <FormattedMessage
                id='multiselect.go'
                defaultMessage='Go'
            />
        );

        const numRemainingText = (
            <FormattedMessage
                id='multiselect.numPeopleRemaining'
                defaultMessage='Use ↑↓ to browse, ↵ to select. You can add {num, number} more {num, plural, one {person} other {people}}. '
                values={{
                    num: MAX_SELECTABLE_VALUES - this.state.values.length
                }}
            />
        );

        let users = [];
        if (this.state.users) {
            users = this.state.users.filter((user) => user.delete_at === 0);
        }

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
                        ref='multiselect'
                        options={users}
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
                        buttonSubmitText={buttonSubmitText}
                    />
                </Modal.Body>
            </Modal>
        );
    }
}
