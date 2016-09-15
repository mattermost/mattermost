// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import SearchableUserList from 'components/searchable_user_list.jsx';
import SpinnerButton from 'components/spinner_button.jsx';
import LoadingScreen from 'components/loading_screen.jsx';

import {getMoreDmList} from 'actions/user_actions.jsx';

import UserStore from 'stores/user_store.jsx';
import TeamStore from 'stores/team_store.jsx';

import * as AsyncClient from 'utils/async_client.jsx';
import * as Utils from 'utils/utils.jsx';

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';
import {browserHistory} from 'react-router/es6';

const USERS_PER_PAGE = 50;

export default class MoreDirectChannels extends React.Component {
    constructor(props) {
        super(props);

        this.handleHide = this.handleHide.bind(this);
        this.handleShowDirectChannel = this.handleShowDirectChannel.bind(this);
        this.onChange = this.onChange.bind(this);
        this.createJoinDirectChannelButton = this.createJoinDirectChannelButton.bind(this);
        this.toggleList = this.toggleList.bind(this);
        this.nextPage = this.nextPage.bind(this);

        this.state = {
            users: UserStore.getProfilesForTeam(),
            loadingDMChannel: -1,
            listType: 'team',
            usersLoaded: false
        };
    }

    componentDidMount() {
        AsyncClient.getProfilesForDirectMessageList();
        UserStore.addChangeListener(this.onChange);
        UserStore.addDmListChangeListener(this.onChange);
        TeamStore.addChangeListener(this.onChange);
    }

    componentWillUnmount() {
        UserStore.removeChangeListener(this.onChange);
        UserStore.removeDmListChangeListener(this.onChange);
        TeamStore.removeChangeListener(this.onChange);
    }

    shouldComponentUpdate(nextProps, nextState) {
        if (nextProps.show !== this.props.show) {
            return true;
        }

        if (nextState.listType !== this.state.listType) {
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

    onChange() {
        let users;
        if (this.state.listType === 'any') {
            users = UserStore.getProfilesForDmList();
        } else {
            users = UserStore.getProfilesForTeam();
        }

        this.setState({
            users,
            usersLoaded: true
        });
    }

    toggleList(e) {
        const listType = e.target.value;
        let users;
        if (listType === 'any') {
            users = UserStore.getProfilesForDmList();
        } else {
            users = UserStore.getProfilesForTeam();
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
            AsyncClient.getProfilesForDirectMessageList((page + 1) * USERS_PER_PAGE, USERS_PER_PAGE);
        } else {
            AsyncClient.getProfiles((page + 1) * USERS_PER_PAGE, USERS_PER_PAGE);
        }
    }

    render() {
        let maxHeight = 1000;
        if (Utils.windowHeight() <= 1200) {
            maxHeight = Utils.windowHeight() - 300;
        }

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

        let body;
        if (this.state.usersLoaded) {
            body = (
                <SearchableUserList
                    key={'moreDirectChannelsList_' + this.state.listType}
                    style={{maxHeight}}
                    users={this.state.users}
                    usersPerPage={USERS_PER_PAGE}
                    nextPage={this.nextPage}
                    actions={[this.createJoinDirectChannelButton]}
                />
            );
        } else {
            body = <LoadingScreen/>;
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
                    {teamToggle}
                    <br/>
                    <br/>
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
