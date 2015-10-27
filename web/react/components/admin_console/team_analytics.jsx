// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var Client = require('../../utils/client.jsx');
var Utils = require('../../utils/utils.jsx');
var LineChart = require('./line_chart.jsx');

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
            <div className='total-count text-center'>
                <div>{'Total Users'}</div>
                <div>{this.state.users == null ? 'Loading...' : Object.keys(this.state.users).length}</div>
            </div>
        );

        var openChannelCount = (
            <div className='total-count text-center'>
                <div>{'Public Groups'}</div>
                <div>{this.state.channel_open_count == null ? 'Loading...' : this.state.channel_open_count}</div>
            </div>
        );

        var openPrivateCount = (
            <div className='total-count text-center'>
                <div>{'Private Groups'}</div>
                <div>{this.state.channel_private_count == null ? 'Loading...' : this.state.channel_private_count}</div>
            </div>
        );

        var postCount = (
            <div className='total-count text-center'>
                <div>{'Total Posts'}</div>
                <div>{this.state.post_count == null ? 'Loading...' : this.state.post_count}</div>
            </div>
        );

        var postCountsByDay = (
            <div className='total-count-by-day'>
                <div>{'Total Posts'}</div>
                <div>{'Loading...'}</div>
            </div>
        );

        if (this.state.post_counts_day != null) {
            postCountsByDay = (
                <div className='total-count-by-day'>
                    <div>{'Total Posts'}</div>
                    <LineChart
                        data={this.state.post_counts_day}
                        width='740'
                        height='225'
                    />
                </div>
            );
        }

        var usersWithPostsByDay = (
            <div className='total-count-by-day'>
                <div>{'Total Posts'}</div>
                <div>{'Loading...'}</div>
            </div>
        );

        if (this.state.user_counts_with_posts_day != null) {
            usersWithPostsByDay = (
                <div className='total-count-by-day'>
                    <div>{'Active Users With Posts'}</div>
                    <LineChart
                        data={this.state.user_counts_with_posts_day}
                        width='740'
                        height='225'
                    />
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
                <div className='recent-active-users'>
                    <div>{'Recent Active Users'}</div>
                    <table width='90%'>
                        <tbody>
                            {
                                this.state.recent_active_users.map((user) => {
                                    return (
                                        <tr key={user.id}>
                                            <td className='recent-active-users-td'>{user.email}</td>
                                            <td className='recent-active-users-td'>{Utils.displayDateTime(user.last_activity_at)}</td>
                                        </tr>
                                    );
                                })
                            }
                        </tbody>
                    </table>
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
                <div className='recent-active-users'>
                    <div>{'Newly Created Users'}</div>
                    <table width='90%'>
                        <tbody>
                            {
                                this.state.newly_created_users.map((user) => {
                                    return (
                                        <tr key={user.id}>
                                            <td className='recent-active-users-td'>{user.email}</td>
                                            <td className='recent-active-users-td'>{Utils.displayDateTime(user.create_at)}</td>
                                        </tr>
                                    );
                                })
                            }
                        </tbody>
                    </table>
                </div>
            );
        }

        return (
            <div className='wrapper--fixed'>
                <h2>{'Statistics for ' + this.props.team.name}</h2>
                {serverError}
                {totalCount}
                {postCount}
                {openChannelCount}
                {openPrivateCount}
                {postCountsByDay}
                {usersWithPostsByDay}
                {recentActiveUser}
                {newUsers}
            </div>
        );
    }
}

TeamAnalytics.propTypes = {
    team: React.PropTypes.object
};
