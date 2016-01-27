// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Analytics from './analytics.jsx';
import * as Client from '../../utils/client.jsx';

import {injectIntl, intlShape, defineMessages} from 'mm-intl';

const labels = defineMessages({
    totalPosts: {
        id: 'admin.team_analytics.totalPosts',
        defaultMessage: 'Total Posts'
    },
    activeUsers: {
        id: 'admin.team_analytics.activeUsers',
        defaultMessage: 'Active Users With Posts'
    }
});

class TeamAnalytics extends React.Component {
    constructor(props) {
        super(props);

        this.getData = this.getData.bind(this);

        this.state = { // most of this state should be from a store in the future
            users: null,
            serverError: null,
            channel_open_count: null,
            channel_private_count: null,
            post_count: null,
            post_counts_day: null,
            user_counts_with_posts_day: null,
            recent_active_users: null,
            newly_created_users: null,
            unique_user_count: null
        };
    }

    componentDidMount() {
        this.getData(this.props.team.id);
    }

    getData(teamId) { // should be moved to an action creator eventually
        const {formatMessage} = this.props.intl;
        Client.getTeamAnalytics(
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

                    if (data[index].name === 'unique_user_count') {
                        this.setState({unique_user_count: data[index].value});
                    }
                }
            },
            (err) => {
                this.setState({serverError: err.message});
            }
        );

        Client.getTeamAnalytics(
            teamId,
            'post_counts_day',
            (data) => {
                data.reverse();

                var chartData = {
                    labels: [],
                    datasets: [{
                        label: formatMessage(labels.totalPosts),
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

        Client.getTeamAnalytics(
            teamId,
            'user_counts_with_posts_day',
            (data) => {
                data.reverse();

                var chartData = {
                    labels: [],
                    datasets: [{
                        label: formatMessage(labels.activeUsers),
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
                    if (usersList[i].last_activity_at == null) {
                        continue;
                    }

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
            newly_created_users: null,
            unique_user_count: null
        });

        this.getData(newProps.team.id);
    }

    render() {
        return (
            <div>
                <Analytics
                    title={this.props.team.name}
                    users={this.state.users}
                    channelOpenCount={this.state.channel_open_count}
                    channelPrivateCount={this.state.channel_private_count}
                    postCount={this.state.post_count}
                    postCountsDay={this.state.post_counts_day}
                    userCountsWithPostsDay={this.state.user_counts_with_posts_day}
                    recentActiveUsers={this.state.recent_active_users}
                    newlyCreatedUsers={this.state.newly_created_users}
                    uniqueUserCount={this.state.unique_user_count}
                    serverError={this.state.serverError}
                />
            </div>
        );
    }
}

TeamAnalytics.propTypes = {
    intl: intlShape.isRequired,
    team: React.PropTypes.object
};

export default injectIntl(TeamAnalytics);