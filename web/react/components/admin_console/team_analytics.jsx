// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import * as Client from '../../utils/client.jsx';
import * as Utils from '../../utils/utils.jsx';
import LineChart from './line_chart.jsx';

const messages = defineMessages({
    totalPosts: {
        id: 'admin.team_analytics.totalPosts',
        defaultMessage: 'Total Posts'
    },
    usrWithPosts: {
        id: 'admin.team_analytics.usrWithPosts',
        defaultMessage: 'Active Users With Posts'
    },
    loading: {
        id: 'admin.team_analytics.loading',
        defaultMessage: 'Loading...'
    },
    totalUsers: {
        id: 'admin.team_analytics.totalUsers',
        defaultMessage: 'Total Users'
    },
    totalChannels: {
        id: 'admin.team_analytics.totalChannels',
        defaultMessage: 'Channels'
    },
    totalGroups: {
        id: 'admin.team_analytics.totalGroups',
        defaultMessage: 'Private Groups'
    },
    recentUsers: {
        id: 'admin.team_analytics.recentUsers',
        defaultMessage: 'Recent Active Users'
    },
    newUsers: {
        id: 'admin.team_analytics.newUsers',
        defaultMessage: 'Newly Created Users'
    },
    title: {
        id: 'admin.team_analytics.title',
        defaultMessage: 'Statistics for '
    }
});

class TeamAnalytics extends React.Component {
    constructor(props) {
        super(props);

        this.getData = this.getData.bind(this);

        this.state = {
            users: null,
            serverError: null,
            channel_open_count: null,
            channel_private_count: null,
            post_count: null,
            post_counts_day: null,
            user_counts_with_posts_day: null,
            recent_active_users: null,
            newly_created_users: null
        };
    }

    componentDidMount() {
        this.getData(this.props.team.id);
    }

    getData(teamId) {
        const {formatMessage} = this.props.intl;

        Client.getAnalytics(
            teamId,
            'standard',
            (data) => {
                for (var index in data) {
                    if (data[index].name === 'channel_open_count') {
                        this.setState({channel_open_count: data[index].value});
                    }

                    if (data[index].name === 'channel_private_count') {
                        this.setState({channel_private_count: data[index].value});
                    }

                    if (data[index].name === 'post_count') {
                        this.setState({post_count: data[index].value});
                    }
                }
            },
            (err) => {
                this.setState({serverError: err.message});
            }
        );

        Client.getAnalytics(
            teamId,
            'post_counts_day',
            (data) => {
                data.reverse();

                var chartData = {
                    labels: [],
                    datasets: [{
                        label: formatMessage(messages.totalPosts),
                        fillColor: 'rgba(151,187,205,0.2)',
                        strokeColor: 'rgba(151,187,205,1)',
                        pointColor: 'rgba(151,187,205,1)',
                        pointStrokeColor: '#fff',
                        pointHighlightFill: '#fff',
                        pointHighlightStroke: 'rgba(151,187,205,1)',
                        data: []
                    }]
                };

                for (var index in data) {
                    if (data[index]) {
                        var row = data[index];
                        chartData.labels.push(row.name);
                        chartData.datasets[0].data.push(row.value);
                    }
                }

                this.setState({post_counts_day: chartData});
            },
            (err) => {
                this.setState({serverError: err.message});
            }
        );

        Client.getAnalytics(
            teamId,
            'user_counts_with_posts_day',
            (data) => {
                data.reverse();

                var chartData = {
                    labels: [],
                    datasets: [{
                        label: formatMessage(messages.usrWithPosts),
                        fillColor: 'rgba(151,187,205,0.2)',
                        strokeColor: 'rgba(151,187,205,1)',
                        pointColor: 'rgba(151,187,205,1)',
                        pointStrokeColor: '#fff',
                        pointHighlightFill: '#fff',
                        pointHighlightStroke: 'rgba(151,187,205,1)',
                        data: []
                    }]
                };

                for (var index in data) {
                    if (data[index]) {
                        var row = data[index];
                        chartData.labels.push(row.name);
                        chartData.datasets[0].data.push(row.value);
                    }
                }

                this.setState({user_counts_with_posts_day: chartData});
            },
            (err) => {
                this.setState({serverError: err.message});
            }
        );

        Client.getProfilesForTeam(
            teamId,
            (users) => {
                this.setState({users});

                var usersList = [];
                for (var id in users) {
                    if (users.hasOwnProperty(id)) {
                        usersList.push(users[id]);
                    }
                }

                usersList.sort((a, b) => {
                    if (a.last_activity_at < b.last_activity_at) {
                        return 1;
                    }

                    if (a.last_activity_at > b.last_activity_at) {
                        return -1;
                    }

                    return 0;
                });

                var recentActive = [];
                for (let i = 0; i < usersList.length; i++) {
                    recentActive.push(usersList[i]);
                    if (i > 19) {
                        break;
                    }
                }

                this.setState({recent_active_users: recentActive});

                usersList.sort((a, b) => {
                    if (a.create_at < b.create_at) {
                        return 1;
                    }

                    if (a.create_at > b.create_at) {
                        return -1;
                    }

                    return 0;
                });

                var newlyCreated = [];
                for (let i = 0; i < usersList.length; i++) {
                    newlyCreated.push(usersList[i]);
                    if (i > 19) {
                        break;
                    }
                }

                this.setState({newly_created_users: newlyCreated});
            },
            (err) => {
                this.setState({serverError: err.message});
            }
        );
    }

    componentWillReceiveProps(newProps) {
        this.setState({
            users: null,
            serverError: null,
            channel_open_count: null,
            channel_private_count: null,
            post_count: null,
            post_counts_day: null,
            user_counts_with_posts_day: null,
            recent_active_users: null,
            newly_created_users: null
        });

        this.getData(newProps.team.id);
    }

    componentWillUnmount() {
    }

    render() {
        const {formatMessage} = this.props.intl;
        var serverError = '';
        if (this.state.serverError) {
            serverError = <div className='form-group has-error'><label className='control-label'>{this.state.serverError}</label></div>;
        }

        var totalCount = (
            <div className='col-sm-3'>
                <div className='total-count'>
                    <div className='title'>{formatMessage(messages.totalUsers)}<i className='fa fa-users'/></div>
                    <div className='content'>{this.state.users == null ? formatMessage(messages.loading) : Object.keys(this.state.users).length}</div>
                </div>
            </div>
        );

        var openChannelCount = (
            <div className='col-sm-3'>
                <div className='total-count'>
                    <div className='title'>{formatMessage(messages.totalChannels)}<i className='fa fa-globe'/></div>
                    <div className='content'>{this.state.channel_open_count == null ? formatMessage(messages.loading) : this.state.channel_open_count}</div>
                </div>
            </div>
        );

        var openPrivateCount = (
            <div className='col-sm-3'>
                <div className='total-count'>
                    <div className='title'>{formatMessage(messages.totalGroups)}<i className='fa fa-lock'/></div>
                    <div className='content'>{this.state.channel_private_count == null ? formatMessage(messages.loading) : this.state.channel_private_count}</div>
                </div>
            </div>
        );

        var postCount = (
            <div className='col-sm-3'>
                <div className='total-count'>
                    <div className='title'>{formatMessage(messages.totalPosts)}<i className='fa fa-comment'/></div>
                    <div className='content'>{this.state.post_count == null ? formatMessage(messages.loading) : this.state.post_count}</div>
                </div>
            </div>
        );

        var postCountsByDay = (
            <div className='col-sm-12'>
                <div className='total-count by-day'>
                    <div className='title'>{formatMessage(messages.totalPosts)}</div>
                    <div className='content'>{formatMessage(messages.loading)}</div>
                </div>
            </div>
        );

        if (this.state.post_counts_day != null) {
            postCountsByDay = (
                <div className='col-sm-12'>
                    <div className='total-count by-day'>
                        <div className='title'>{formatMessage(messages.totalPosts)}</div>
                        <div className='content'>
                            <LineChart
                                data={this.state.post_counts_day}
                                width='740'
                                height='225'
                            />
                        </div>
                    </div>
                </div>
            );
        }

        var usersWithPostsByDay = (
            <div className='col-sm-12'>
                <div className='total-count by-day'>
                    <div className='title'>{formatMessage(messages.totalPosts)}</div>
                    <div>{formatMessage(messages.loading)}</div>
                </div>
            </div>
        );

        if (this.state.user_counts_with_posts_day != null) {
            usersWithPostsByDay = (
                <div className='col-sm-12'>
                    <div className='total-count by-day'>
                        <div className='title'>{formatMessage(messages.usrWithPosts)}</div>
                        <div className='content'>
                            <LineChart
                                data={this.state.user_counts_with_posts_day}
                                width='740'
                                height='225'
                            />
                        </div>
                    </div>
                </div>
            );
        }

        var recentActiveUser = (
            <div className='recent-active-users'>
                <div>{formatMessage(messages.recentUsers)}</div>
                <div>{formatMessage(messages.loading)}</div>
            </div>
        );

        if (this.state.recent_active_users != null) {
            recentActiveUser = (
                <div className='col-sm-6'>
                    <div className='total-count recent-active-users'>
                        <div className='title'>{formatMessage(messages.recentUsers)}</div>
                        <div className='content'>
                            <table>
                                <tbody>
                                    {
                                        this.state.recent_active_users.map((user) => {
                                            return (
                                                <tr key={user.id}>
                                                    <td>{user.email}</td>
                                                    <td>{Utils.displayDateTime(user.last_activity_at)}</td>
                                                </tr>
                                            );
                                        })
                                    }
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            );
        }

        var newUsers = (
            <div className='recent-active-users'>
                <div>{formatMessage(messages.newUsers)}</div>
                <div>{formatMessage(messages.loading)}</div>
            </div>
        );

        if (this.state.newly_created_users != null) {
            newUsers = (
                <div className='col-sm-6'>
                    <div className='total-count recent-active-users'>
                        <div className='title'>{formatMessage(messages.newUsers)}</div>
                        <div className='content'>
                            <table>
                                <tbody>
                                    {
                                        this.state.newly_created_users.map((user) => {
                                            return (
                                                <tr key={user.id}>
                                                    <td>{user.email}</td>
                                                    <td>{Utils.displayDateTime(user.create_at)}</td>
                                                </tr>
                                            );
                                        })
                                    }
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className='wrapper--fixed team_statistics'>
                <h3>{formatMessage(messages.title) + this.props.team.name}</h3>
                {serverError}
                <div className='row'>
                    {totalCount}
                    {postCount}
                    {openChannelCount}
                    {openPrivateCount}
                </div>
                <div className='row'>
                    {postCountsByDay}
                </div>
                <div className='row'>
                    {usersWithPostsByDay}
                </div>
                <div className='row'>
                    {recentActiveUser}
                    {newUsers}
                </div>
            </div>
        );
    }
}

TeamAnalytics.propTypes = {
    team: React.PropTypes.object,
    intl: intlShape.isRequired
};

export default injectIntl(TeamAnalytics);