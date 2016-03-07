// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import LineChart from './line_chart.jsx';
import StatisticCount from './statistic_count.jsx';
import TableChart from './table_chart.jsx';

import AnalyticsStore from '../../stores/analytics_store.jsx';

import * as Utils from '../../utils/utils.jsx';
import * as AsyncClient from '../../utils/async_client.jsx';
import Constants from '../../utils/constants.jsx';
const StatTypes = Constants.StatTypes;

import {formatPostsPerDayData, formatUsersWithPostsPerDayData} from './system_analytics.jsx';
import {injectIntl, intlShape, FormattedMessage, FormattedDate} from 'mm-intl';

class TeamAnalytics extends React.Component {
    constructor(props) {
        super(props);

        this.onChange = this.onChange.bind(this);

        this.state = {stats: AnalyticsStore.getAllTeam(this.props.team.id)};
    }

    componentDidMount() {
        AnalyticsStore.addChangeListener(this.onChange);

        this.getData(this.props.team.id);
    }

    getData(id) {
        AsyncClient.getStandardAnalytics(id);
        AsyncClient.getPostsPerDayAnalytics(id);
        AsyncClient.getUsersPerDayAnalytics(id);
        AsyncClient.getRecentAndNewUsersAnalytics(id);
    }

    componentWillUnmount() {
        AnalyticsStore.removeChangeListener(this.onChange);
    }

    componentWillReceiveProps(nextProps) {
        this.getData(nextProps.team.id);
        this.setState({stats: AnalyticsStore.getAllTeam(nextProps.team.id)});
    }

    shouldComponentUpdate(nextProps, nextState) {
        if (!Utils.areObjectsEqual(nextState.stats, this.state.stats)) {
            return true;
        }

        if (!Utils.areObjectsEqual(nextProps.team, this.props.team)) {
            return true;
        }

        return false;
    }

    onChange() {
        this.setState({stats: AnalyticsStore.getAllTeam(this.props.team.id)});
    }

    render() {
        const stats = this.state.stats;
        const postCountsDay = formatPostsPerDayData(stats[StatTypes.POST_PER_DAY]);
        const userCountsWithPostsDay = formatUsersWithPostsPerDayData(stats[StatTypes.USERS_WITH_POSTS_PER_DAY]);
        const recentActiveUsers = formatRecentUsersData(stats[StatTypes.RECENTLY_ACTIVE_USERS]);
        const newlyCreatedUsers = formatNewUsersData(stats[StatTypes.NEWLY_CREATED_USERS]);

        return (
            <div className='wrapper--fixed team_statistics'>
                <h3>
                    <FormattedMessage
                        id='analytics.team.title'
                        defaultMessage='Team Statistics for {team}'
                        values={{
                            team: this.props.team.name
                        }}
                    />
                </h3>
                <div className='row'>
                    <StatisticCount
                        title={
                            <FormattedMessage
                                id='analytics.team.totalUsers'
                                defaultMessage='Total Users'
                            />
                        }
                        icon='fa-user'
                        count={stats[StatTypes.TOTAL_USERS]}
                    />
                    <StatisticCount
                        title={
                            <FormattedMessage
                                id='analytics.team.publicChannels'
                                defaultMessage='Public Channels'
                            />
                        }
                        icon='fa-users'
                        count={stats[StatTypes.TOTAL_PUBLIC_CHANNELS]}
                    />
                    <StatisticCount
                        title={
                            <FormattedMessage
                                id='analytics.team.privateGroups'
                                defaultMessage='Private Groups'
                            />
                        }
                        icon='fa-globe'
                        count={stats[StatTypes.TOTAL_PRIVATE_GROUPS]}
                    />
                    <StatisticCount
                        title={
                            <FormattedMessage
                                id='analytics.team.totalPosts'
                                defaultMessage='Total Posts'
                            />
                        }
                        icon='fa-comment'
                        count={stats[StatTypes.TOTAL_POSTS]}
                    />
                </div>
                <div className='row'>
                    <LineChart
                        title={
                            <FormattedMessage
                                id='analytics.team.totalPosts'
                                defaultMessage='Total Posts'
                            />
                        }
                        data={postCountsDay}
                        width='740'
                        height='225'
                    />
                </div>
                <div className='row'>
                    <LineChart
                        title={
                            <FormattedMessage
                                id='analytics.team.activeUsers'
                                defaultMessage='Active Users With Posts'
                            />
                        }
                        data={userCountsWithPostsDay}
                        width='740'
                        height='225'
                    />
                </div>
                <div className='row'>
                    <TableChart
                        title={
                            <FormattedMessage
                                id='analytics.team.activeUsers'
                                defaultMessage='Recent Active Users'
                            />
                        }
                        data={recentActiveUsers}
                    />
                    <TableChart
                        title={
                            <FormattedMessage
                                id='analytics.team.newlyCreated'
                                defaultMessage='Newly Created Users'
                            />
                        }
                        data={newlyCreatedUsers}
                    />
                </div>
            </div>
        );
    }
}

TeamAnalytics.propTypes = {
    intl: intlShape.isRequired,
    team: React.PropTypes.object.isRequired
};

export default injectIntl(TeamAnalytics);

export function formatRecentUsersData(data) {
    if (data == null) {
        return [];
    }

    const formattedData = data.map((user) => {
        const item = {};
        item.name = user.username;
        item.value = (
            <FormattedDate
                value={user.last_activity_at}
                day='numeric'
                month='long'
                year='numeric'
                hour12={true}
                hour='2-digit'
                minute='2-digit'
            />
        );
        item.tip = user.email;

        return item;
    });

    return formattedData;
}

export function formatNewUsersData(data) {
    if (data == null) {
        return [];
    }

    const formattedData = data.map((user) => {
        const item = {};
        item.name = user.username;
        item.value = (
            <FormattedDate
                value={user.create_at}
                day='numeric'
                month='long'
                year='numeric'
                hour12={true}
                hour='2-digit'
                minute='2-digit'
            />
        );
        item.tip = user.email;

        return item;
    });

    return formattedData;
}
