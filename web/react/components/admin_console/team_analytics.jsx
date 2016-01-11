// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Client from '../../utils/client.jsx';
import * as Utils from '../../utils/utils.jsx';
import Constants from '../../utils/constants.jsx';
import LineChart from './line_chart.jsx';

var Tooltip = ReactBootstrap.Tooltip;
var OverlayTrigger = ReactBootstrap.OverlayTrigger;

export default class TeamAnalytics extends React.Component {
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
                        label: 'Total Posts',
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
                        label: 'Active Users With Posts',
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
        var serverError = '';
        if (this.state.serverError) {
            serverError = <div className='form-group has-error'><label className='control-label'>{this.state.serverError}</label></div>;
        }

        var totalCount = (
            <div className='col-sm-3'>
                <div className='total-count'>
                    <div className='title'>{'Total Users'}<i className='fa fa-users'/></div>
                    <div className='content'>{this.state.users == null ? 'Loading...' : Object.keys(this.state.users).length}</div>
                </div>
            </div>
        );

        var openChannelCount = (
            <div className='col-sm-3'>
                <div className='total-count'>
                    <div className='title'>{'Public Channels'}<i className='fa fa-globe'/></div>
                    <div className='content'>{this.state.channel_open_count == null ? 'Loading...' : this.state.channel_open_count}</div>
                </div>
            </div>
        );

        var openPrivateCount = (
            <div className='col-sm-3'>
                <div className='total-count'>
                    <div className='title'>{'Private Groups'}<i className='fa fa-lock'/></div>
                    <div className='content'>{this.state.channel_private_count == null ? 'Loading...' : this.state.channel_private_count}</div>
                </div>
            </div>
        );

        var postCount = (
            <div className='col-sm-3'>
                <div className='total-count'>
                    <div className='title'>{'Total Posts'}<i className='fa fa-comment'/></div>
                    <div className='content'>{this.state.post_count == null ? 'Loading...' : this.state.post_count}</div>
                </div>
            </div>
        );

        var postCountsByDay = (
            <div className='col-sm-12'>
                <div className='total-count by-day'>
                    <div className='title'>{'Total Posts'}</div>
                    <div className='content'>{'Loading...'}</div>
                </div>
            </div>
        );

        if (this.state.post_counts_day != null) {
            postCountsByDay = (
                <div className='col-sm-12'>
                    <div className='total-count by-day'>
                        <div className='title'>{'Total Posts'}</div>
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
                    <div className='title'>{'Total Posts'}</div>
                    <div>{'Loading...'}</div>
                </div>
            </div>
        );

        if (this.state.user_counts_with_posts_day != null) {
            usersWithPostsByDay = (
                <div className='col-sm-12'>
                    <div className='total-count by-day'>
                        <div className='title'>{'Active Users With Posts'}</div>
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
                <div>{'Recent Active Users'}</div>
                <div>{'Loading...'}</div>
            </div>
        );

        if (this.state.recent_active_users != null) {
            recentActiveUser = (
                <div className='col-sm-6'>
                    <div className='total-count recent-active-users'>
                        <div className='title'>{'Recent Active Users'}</div>
                        <div className='content'>
                            <table>
                                <tbody>
                                    {
                                        this.state.recent_active_users.map((user) => {
                                            const tooltip = (
                                                <Tooltip id={'recent-user-email-tooltip-' + user.id}>
                                                    {user.email}
                                                </Tooltip>
                                            );

                                            return (
                                                <tr key={'recent-user-table-entry-' + user.id}>
                                                    <td>
                                                        <OverlayTrigger
                                                            delayShow={Constants.OVERLAY_TIME_DELAY}
                                                            placement='top'
                                                            overlay={tooltip}
                                                        >
                                                            <time>
                                                                {user.username}
                                                            </time>
                                                        </OverlayTrigger>
                                                    </td>
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
                <div>{'Newly Created Users'}</div>
                <div>{'Loading...'}</div>
            </div>
        );

        if (this.state.newly_created_users != null) {
            newUsers = (
                <div className='col-sm-6'>
                    <div className='total-count recent-active-users'>
                        <div className='title'>{'Newly Created Users'}</div>
                        <div className='content'>
                            <table>
                                <tbody>
                                    {
                                        this.state.newly_created_users.map((user) => {
                                            const tooltip = (
                                                <Tooltip id={'new-user-email-tooltip-' + user.id}>
                                                    {user.email}
                                                </Tooltip>
                                            );

                                            return (
                                                <tr key={'new-user-table-entry-' + user.id}>
                                                    <td>
                                                        <OverlayTrigger
                                                            delayShow={Constants.OVERLAY_TIME_DELAY}
                                                            placement='top'
                                                            overlay={tooltip}
                                                        >
                                                            <time>
                                                                {user.username}
                                                            </time>
                                                        </OverlayTrigger>
                                                    </td>
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
                <h3>{'Statistics for ' + this.props.team.name}</h3>
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
    team: React.PropTypes.object
};
