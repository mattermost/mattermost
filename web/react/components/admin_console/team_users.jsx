// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import LoadingScreen from '../loading_screen.jsx';
import UserItem from './user_item.jsx';
import ResetPasswordModal from './reset_password_modal.jsx';

import AnalyticsStore from '../../stores/analytics_store.jsx';

import * as Client from '../../utils/client.jsx';
import * as AsyncClient from '../../utils/async_client.jsx';
import Constants from '../../utils/constants.jsx';
const StatTypes = Constants.StatTypes;

import {FormattedMessage} from 'mm-intl';

export default class UserList extends React.Component {
    constructor(props) {
        super(props);

        this.getTeamProfiles = this.getTeamProfiles.bind(this);
        this.getCurrentTeamProfiles = this.getCurrentTeamProfiles.bind(this);
        this.doPasswordReset = this.doPasswordReset.bind(this);
        this.doPasswordResetDismiss = this.doPasswordResetDismiss.bind(this);
        this.doPasswordResetSubmit = this.doPasswordResetSubmit.bind(this);
        this.doLoadMore = this.doLoadMore.bind(this);
        this.onAnalyticsChange = this.onAnalyticsChange.bind(this);

        this.state = {
            teamId: props.team.id,
            users: null,
            serverError: null,
            showPasswordModal: false,
            user: null,
            usersCount: AnalyticsStore.getTeamStat(props.team.id, StatTypes.TOTAL_USERS)
        };
    }

    componentDidMount() {
        AnalyticsStore.addChangeListener(this.onAnalyticsChange);
        this.getCurrentTeamProfiles();
        AsyncClient.getStandardAnalytics(this.props.team.id);
    }

    componentWillUnmount() {
        AnalyticsStore.removeChangeListener(this.onAnalyticsChange);
    }

    componentWillReceiveProps(newProps) {
        this.getTeamProfiles(newProps.team.id);
    }

    getCurrentTeamProfiles() {
        this.getTeamProfiles(this.props.team.id);
    }

    onAnalyticsChange() {
        this.setState({usersCount: AnalyticsStore.getTeamStat(this.props.team.id, StatTypes.TOTAL_USERS)});
    }

    getTeamProfiles(teamId) {
        const userList = this.state.users || [];

        Client.getProfilesForTeam(
            teamId,
            userList.length,
            Constants.USER_CHUNK_SIZE,
            (users) => {
                const memberList = [];
                for (var id in users) {
                    if (users.hasOwnProperty(id)) {
                        memberList.push(users[id]);
                    }
                }

                const newList = userList.concat(memberList);

                this.setState({
                    users: newList,
                    atEnd: memberList.length < Constants.USER_CHUNK_SIZE
                });
            },
            (err) => {
                this.setState({
                    serverError: err.message
                });
            }
        );
    }

    doPasswordReset(user) {
        this.setState({
            showPasswordModal: true,
            user
        });
    }

    doPasswordResetDismiss() {
        this.setState({
            showPasswordModal: false,
            user: null
        });
    }

    doPasswordResetSubmit() {
        this.setState({
            showPasswordModal: false,
            user: null
        });
    }

    doLoadMore(e) {
        e.preventDefault();
        this.getTeamProfiles(this.props.team.id);
    }

    render() {
        let serverError = '';
        if (this.state.serverError) {
            serverError = <div className='form-group has-error'><label className='control-label'>{this.state.serverError}</label></div>;
        }

        if (this.state.users == null) {
            return (
                <div className='wrapper--fixed'>
                    <h3>
                        <FormattedMessage
                            id='admin.userList.title'
                            defaultMessage='Users for {team}'
                            values={{
                                team: this.props.team.name
                            }}
                        />
                    </h3>
                    {serverError}
                    <LoadingScreen/>
                </div>
            );
        }

        const memberList = this.state.users.map((user) => {
            return (
                <UserItem
                    key={'user_' + user.id}
                    user={user}
                    refreshProfiles={this.getCurrentTeamProfiles}
                    doPasswordReset={this.doPasswordReset}
                />);
        });

        let loadButton;
        if (!this.state.atEnd) {
            loadButton = (
                <tr>
                    <td className='row member-div padding--equal'>
                        <a
                            href='#'
                            onClick={this.doLoadMore}
                        >
                            <FormattedMessage
                                id='admin.userList.loadMore'
                                defaultMessage='Load more users'
                            />
                        </a>
                    </td>
                </tr>
            );
        }

        return (
            <div className='wrapper--fixed'>
                <h3>
                    <FormattedMessage
                        id='admin.userList.title2'
                        defaultMessage='Users for {team} ({count})'
                        values={{
                            team: this.props.team.name,
                            count: this.state.usersCount
                        }}
                    />
                </h3>
                {serverError}
                <form
                    className='form-horizontal'
                    role='form'
                >
                    <table className='table more-table member-list-holder'>
                        <tbody>
                            {memberList}
                            {loadButton}
                        </tbody>
                    </table>
                </form>
                <ResetPasswordModal
                    user={this.state.user}
                    show={this.state.showPasswordModal}
                    team={this.props.team}
                    onModalSubmit={this.doPasswordResetSubmit}
                    onModalDismissed={this.doPasswordResetDismiss}
                />
            </div>
        );
    }
}

UserList.propTypes = {
    team: React.PropTypes.object
};
