// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var Client = require('../../utils/client.jsx');
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
            recent_active_users: null
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
                        this.setState({channel_open_count: 55});
                    }

                    if (data[index].name === 'channel_private_count') {
                        this.setState({channel_private_count: data[index].value});
                        this.setState({channel_private_count: 12});
                    }

                    if (data[index].name === 'post_count') {
                        this.setState({post_count: data[index].value});
                        this.setState({post_count: 5332});
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
                data.push({name: '2015-10-24', value: 73});
                data.push({name: '2015-10-25', value: 84});
                data.push({name: '2015-10-26', value: 61});
                data.push({name: '2015-10-27', value: 97});
                data.push({name: '2015-10-28', value: 73});
                data.push({name: '2015-10-29', value: 84});
                data.push({name: '2015-10-30', value: 61});
                data.push({name: '2015-10-31', value: 97});

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
                data.push({name: '2015-10-24', value: 22});
                data.push({name: '2015-10-25', value: 31});
                data.push({name: '2015-10-26', value: 25});
                data.push({name: '2015-10-27', value: 12});
                data.push({name: '2015-10-28', value: 22});
                data.push({name: '2015-10-29', value: 31});
                data.push({name: '2015-10-30', value: 25});
                data.push({name: '2015-10-31', value: 12});

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

                var recentActive = [];
                recentActive.push({email: 'corey@spinpunch.com', date: '2015-10-23'});
                recentActive.push({email: 'bill@spinpunch.com', date: '2015-10-22'});
                recentActive.push({email: 'bob@spinpunch.com', date: '2015-10-22'});
                recentActive.push({email: 'jones@spinpunch.com', date: '2015-10-21'});
                this.setState({recent_active_users: recentActive});

                // var memberList = [];
                // for (var id in users) {
                //     if (users.hasOwnProperty(id)) {
                //         memberList.push(users[id]);
                //     }
                // }

                // memberList.sort((a, b) => {
                //     if (a.username < b.username) {
                //         return -1;
                //     }

                //     if (a.username > b.username) {
                //         return 1;
                //     }

                //     return 0;
                // });
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
            recent_active_users: null
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
                <div>{this.state.users == null ? 'Loading...' : Object.keys(this.state.users).length + 23}</div>
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
                        <tr><td className='recent-active-users-td'>corey@spinpunch.com</td><td className='recent-active-users-td'>2015-12-23</td></tr>
                        <tr><td className='recent-active-users-td'>bob@spinpunch.com</td><td className='recent-active-users-td'>2015-12-22</td></tr>
                        <tr><td className='recent-active-users-td'>jimmy@spinpunch.com</td><td className='recent-active-users-td'>2015-12-22</td></tr>
                        <tr><td className='recent-active-users-td'>jones@spinpunch.com</td><td className='recent-active-users-td'>2015-12-21</td></tr>
                        <tr><td className='recent-active-users-td'>steve@spinpunch.com</td><td className='recent-active-users-td'>2015-12-20</td></tr>
                        <tr><td className='recent-active-users-td'>aspen@spinpunch.com</td><td className='recent-active-users-td'>2015-12-19</td></tr>
                        <tr><td className='recent-active-users-td'>scott@spinpunch.com</td><td className='recent-active-users-td'>2015-12-19</td></tr>
                        <tr><td className='recent-active-users-td'>grant@spinpunch.com</td><td className='recent-active-users-td'>2015-12-19</td></tr>
                        <tr><td className='recent-active-users-td'>sienna@spinpunch.com</td><td className='recent-active-users-td'>2015-12-18</td></tr>
                        <tr><td className='recent-active-users-td'>jessica@spinpunch.com</td><td className='recent-active-users-td'>2015-12-18</td></tr>
                        <tr><td className='recent-active-users-td'>davy@spinpunch.com</td><td className='recent-active-users-td'>2015-12-16</td></tr>
                        <tr><td className='recent-active-users-td'>steve@spinpunch.com</td><td className='recent-active-users-td'>2015-12-11</td></tr>
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

        if (this.state.recent_active_users != null) {
            newUsers = (
                <div className='recent-active-users'>
                    <div>{'Newly Created Users'}</div>
                    <table width='90%'>
                        <tr><td className='recent-active-users-td'>bob@spinpunch.com</td><td className='recent-active-users-td'>2015-12-11</td></tr>
                        <tr><td className='recent-active-users-td'>corey@spinpunch.com</td><td className='recent-active-users-td'>2015-12-10</td></tr>
                
                        <tr><td className='recent-active-users-td'>jimmy@spinpunch.com</td><td className='recent-active-users-td'>2015-12-8</td></tr>
                        
                        
                        <tr><td className='recent-active-users-td'>aspen@spinpunch.com</td><td className='recent-active-users-td'>2015-12-5</td></tr>

                        <tr><td className='recent-active-users-td'>jones@spinpunch.com</td><td className='recent-active-users-td'>2015-12-5</td></tr>
                        <tr><td className='recent-active-users-td'>steve@spinpunch.com</td><td className='recent-active-users-td'>2015-12-5</td></tr>
                    </table>
                </div>
            );
        }

        return (
            <div className='wrapper--fixed'>
                <h2>{'Analytics for ' + this.props.team.name}</h2>
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
