// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Analytics from './analytics.jsx';
import * as Client from '../../utils/client.jsx';

import {injectIntl, intlShape, defineMessages} from 'mm-intl';

const labels = defineMessages({
    totalPosts: {
        id: 'admin.system_analytics.totalPosts',
        defaultMessage: 'Total Posts'
    },
    activeUsers: {
        id: 'admin.system_analytics.activeUsers',
        defaultMessage: 'Active Users With Posts'
    },
    title: {
        id: 'admin.system_analytics.title',
        defaultMessage: 'the System'
    }
});

class SystemAnalytics extends React.Component {
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
        this.getData();
    }

    getData() { // should be moved to an action creator eventually
        const {formatMessage} = this.props.intl;
        Client.getSystemAnalytics(
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

        Client.getSystemAnalytics(
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

        Client.getSystemAnalytics(
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
    }

    componentWillReceiveProps() {
        this.setState({
            serverError: null,
            channel_open_count: null,
            channel_private_count: null,
            post_count: null,
            post_counts_day: null,
            user_counts_with_posts_day: null,
            unique_user_count: null
        });

        this.getData();
    }

    render() {
        return (
            <div>
                <Analytics
                    title={this.props.intl.formatMessage(labels.title)}
                    channelOpenCount={this.state.channel_open_count}
                    channelPrivateCount={this.state.channel_private_count}
                    postCount={this.state.post_count}
                    postCountsDay={this.state.post_counts_day}
                    userCountsWithPostsDay={this.state.user_counts_with_posts_day}
                    uniqueUserCount={this.state.unique_user_count}
                    serverError={this.state.serverError}
                />
            </div>
        );
    }
}

SystemAnalytics.propTypes = {
    intl: intlShape.isRequired,
    team: React.PropTypes.object
};

export default injectIntl(SystemAnalytics);