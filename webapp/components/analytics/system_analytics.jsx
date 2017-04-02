// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import LineChart from './line_chart.jsx';
import DoughnutChart from './doughnut_chart.jsx';
import StatisticCount from './statistic_count.jsx';

import AnalyticsStore from 'stores/analytics_store.jsx';

import * as Utils from 'utils/utils.jsx';
import * as AsyncClient from 'utils/async_client.jsx';
import Constants from 'utils/constants.jsx';
const StatTypes = Constants.StatTypes;

import {injectIntl, intlShape, defineMessages, FormattedMessage, FormattedHTMLMessage} from 'react-intl';

const holders = defineMessages({
    analyticsPublicChannels: {
        id: 'analytics.system.publicChannels',
        defaultMessage: 'Public Channels'
    },
    analyticsPrivateGroups: {
        id: 'analytics.system.privateGroups',
        defaultMessage: 'Private Groups'
    },
    analyticsFilePosts: {
        id: 'analytics.system.totalFilePosts',
        defaultMessage: 'Posts with Files'
    },
    analyticsHashtagPosts: {
        id: 'analytics.system.totalHashtagPosts',
        defaultMessage: 'Posts with Hashtags'
    },
    analyticsTextPosts: {
        id: 'analytics.system.textPosts',
        defaultMessage: 'Posts with Text-only'
    }
});

import React from 'react';

class SystemAnalytics extends React.Component {
    constructor(props) {
        super(props);

        this.onChange = this.onChange.bind(this);

        this.state = {stats: AnalyticsStore.getAllSystem()};
    }

    componentDidMount() {
        AnalyticsStore.addChangeListener(this.onChange);

        AsyncClient.getStandardAnalytics();
        AsyncClient.getPostsPerDayAnalytics();
        AsyncClient.getUsersPerDayAnalytics();

        if (global.window.mm_license.IsLicensed === 'true') {
            AsyncClient.getAdvancedAnalytics();
        }
    }

    componentWillUnmount() {
        AnalyticsStore.removeChangeListener(this.onChange);
    }

    shouldComponentUpdate(nextProps, nextState) {
        if (!Utils.areObjectsEqual(nextState.stats, this.state.stats)) {
            return true;
        }

        return false;
    }

    onChange() {
        this.setState({stats: AnalyticsStore.getAllSystem()});
    }

    render() {
        const stats = this.state.stats;
        const isLicensed = global.window.mm_license.IsLicensed === 'true';
        const skippedIntensiveQueries = stats[StatTypes.TOTAL_POSTS] === -1;
        const postCountsDay = formatPostsPerDayData(stats[StatTypes.POST_PER_DAY]);
        const userCountsWithPostsDay = formatUsersWithPostsPerDayData(stats[StatTypes.USERS_WITH_POSTS_PER_DAY]);

        let banner;
        let postCount;
        let postTotalGraph;
        let activeUserGraph;
        if (skippedIntensiveQueries) {
            banner = (
                <div className='banner'>
                    <div className='banner__content'>
                        <FormattedHTMLMessage
                            id='analytics.system.skippedIntensiveQueries'
                            defaultMessage="To maximize performance, some statistics are disabled. You can re-enable them in config.json. See: <a href='https://docs.mattermost.com/administration/statistics.html' target='_blank'>https://docs.mattermost.com/administration/statistics.html</a>"
                        />
                    </div>
                </div>
            );
        } else {
            postCount = (
                <StatisticCount
                    title={
                        <FormattedMessage
                            id='analytics.system.totalPosts'
                            defaultMessage='Total Posts'
                        />
                    }
                    icon='fa-comment'
                    count={stats[StatTypes.TOTAL_POSTS]}
                />
            );

            postTotalGraph = (
                <div className='row'>
                    <LineChart
                        title={
                            <FormattedMessage
                                id='analytics.system.totalPosts'
                                defaultMessage='Total Posts'
                            />
                        }
                        data={postCountsDay}
                        options={{
                            legend: {
                                display: false
                            }
                        }}
                        width='740'
                        height='225'
                    />
                </div>
            );

            activeUserGraph = (
                <div className='row'>
                    <LineChart
                        title={
                            <FormattedMessage
                                id='analytics.system.activeUsers'
                                defaultMessage='Active Users With Posts'
                            />
                        }
                        data={userCountsWithPostsDay}
                        options={{
                            legend: {
                                display: false
                            }
                        }}
                        width='740'
                        height='225'
                    />
                </div>
            );
        }

        let advancedStats;
        let advancedGraphs;
        let sessionCount;
        let commandCount;
        let incomingCount;
        let outgoingCount;
        if (global.window.mm_license.IsLicensed === 'true') {
            sessionCount = (
                <StatisticCount
                    title={
                        <FormattedMessage
                            id='analytics.system.totalSessions'
                            defaultMessage='Total Sessions'
                        />
                    }
                    icon='fa-signal'
                    count={stats[StatTypes.TOTAL_SESSIONS]}
                />
            );

            commandCount = (
                <StatisticCount
                    title={
                        <FormattedMessage
                            id='analytics.system.totalCommands'
                            defaultMessage='Total Commands'
                        />
                    }
                    icon='fa-terminal'
                    count={stats[StatTypes.TOTAL_COMMANDS]}
                />
            );

            incomingCount = (
                <StatisticCount
                    title={
                        <FormattedMessage
                            id='analytics.system.totalIncomingWebhooks'
                            defaultMessage='Incoming Webhooks'
                        />
                    }
                    icon='fa-arrow-down'
                    count={stats[StatTypes.TOTAL_IHOOKS]}
                />
            );

            outgoingCount = (
                <StatisticCount
                    title={
                        <FormattedMessage
                            id='analytics.system.totalOutgoingWebhooks'
                            defaultMessage='Outgoing Webhooks'
                        />
                    }
                    icon='fa-arrow-up'
                    count={stats[StatTypes.TOTAL_OHOOKS]}
                />
            );

            advancedStats = (
                <div>
                    <StatisticCount
                        title={
                            <FormattedMessage
                                id='analytics.system.totalWebsockets'
                                defaultMessage='WebSocket Conns'
                            />
                        }
                        icon='fa-user'
                        count={stats[StatTypes.TOTAL_WEBSOCKET_CONNECTIONS]}
                    />
                    <StatisticCount
                        title={
                            <FormattedMessage
                                id='analytics.system.totalMasterDbConnections'
                                defaultMessage='Master DB Conns'
                            />
                        }
                        icon='fa-terminal'
                        count={stats[StatTypes.TOTAL_MASTER_DB_CONNECTIONS]}
                    />
                    <StatisticCount
                        title={
                            <FormattedMessage
                                id='analytics.system.totalReadDbConnections'
                                defaultMessage='Replica DB Conns'
                            />
                        }
                        icon='fa-terminal'
                        count={stats[StatTypes.TOTAL_READ_DB_CONNECTIONS]}
                    />
                </div>
            );

            const channelTypeData = formatChannelDoughtnutData(stats[StatTypes.TOTAL_PUBLIC_CHANNELS], stats[StatTypes.TOTAL_PRIVATE_GROUPS], this.props.intl);
            const postTypeData = formatPostDoughtnutData(stats[StatTypes.TOTAL_FILE_POSTS], stats[StatTypes.TOTAL_HASHTAG_POSTS], stats[StatTypes.TOTAL_POSTS], this.props.intl);

            let postTypeGraph;
            if (stats[StatTypes.TOTAL_POSTS] !== -1) {
                postTypeGraph = (
                    <DoughnutChart
                        title={
                            <FormattedMessage
                                id='analytics.system.postTypes'
                                defaultMessage='Posts, Files and Hashtags'
                            />
                        }
                        data={postTypeData}
                        width='300'
                        height='225'
                    />
                );
            }

            advancedGraphs = (
                <div className='row'>
                    <DoughnutChart
                        title={
                            <FormattedMessage
                                id='analytics.system.channelTypes'
                                defaultMessage='Channel Types'
                            />
                        }
                        data={channelTypeData}
                        width='300'
                        height='225'
                    />
                    {postTypeGraph}
                </div>
            );
        }

        const userCount = (
            <StatisticCount
                title={
                    <FormattedMessage
                        id='analytics.system.totalUsers'
                        defaultMessage='Total Users'
                    />
                }
                icon='fa-user'
                count={stats[StatTypes.TOTAL_USERS]}
            />
        );

        const teamCount = (
            <StatisticCount
                title={
                    <FormattedMessage
                        id='analytics.system.totalTeams'
                        defaultMessage='Total Teams'
                    />
                }
                icon='fa-users'
                count={stats[StatTypes.TOTAL_TEAMS]}
            />
        );

        const channelCount = (
            <StatisticCount
                title={
                    <FormattedMessage
                        id='analytics.system.totalChannels'
                        defaultMessage='Total Channels'
                    />
                }
                icon='fa-globe'
                count={stats[StatTypes.TOTAL_PUBLIC_CHANNELS] + stats[StatTypes.TOTAL_PRIVATE_GROUPS]}
            />
        );

        const dailyActiveUsers = (
            <StatisticCount
                title={
                    <FormattedMessage
                        id='analytics.system.dailyActiveUsers'
                        defaultMessage='Daily Active Users'
                    />
                }
                icon='fa-users'
                count={stats[StatTypes.DAILY_ACTIVE_USERS]}
            />
        );

        const monthlyActiveUsers = (
            <StatisticCount
                title={
                    <FormattedMessage
                        id='analytics.system.monthlyActiveUsers'
                        defaultMessage='Monthly Active Users'
                    />
                }
                icon='fa-users'
                count={stats[StatTypes.MONTHLY_ACTIVE_USERS]}
            />
        );

        let firstRow;
        let secondRow;
        if (isLicensed && skippedIntensiveQueries) {
            firstRow = (
                <div>
                    {userCount}
                    {teamCount}
                    {channelCount}
                    {sessionCount}
                </div>
            );

            secondRow = (
                <div>
                    {commandCount}
                    {incomingCount}
                    {outgoingCount}
                </div>
            );
        } else if (isLicensed && !skippedIntensiveQueries) {
            firstRow = (
                <div>
                    {userCount}
                    {teamCount}
                    {channelCount}
                    {postCount}
                </div>
            );

            secondRow = (
                <div>
                    {sessionCount}
                    {commandCount}
                    {incomingCount}
                    {outgoingCount}
                </div>
            );
        } else if (!isLicensed) {
            firstRow = (
                <div>
                    {userCount}
                    {teamCount}
                    {channelCount}
                    {postCount}
                </div>
            );
        }

        const thirdRow = (
            <div>
                {dailyActiveUsers}
                {monthlyActiveUsers}
            </div>
        );

        return (
            <div className='wrapper--fixed team_statistics'>
                <h3 className='admin-console-header'>
                    <FormattedMessage
                        id='analytics.system.title'
                        defaultMessage='System Statistics'
                    />
                </h3>
                {banner}
                <div className='row'>
                    {firstRow}
                    {secondRow}
                    {thirdRow}
                    {advancedStats}
                </div>
                {advancedGraphs}
                {postTotalGraph}
                {activeUserGraph}
            </div>
        );
    }
}

SystemAnalytics.propTypes = {
    intl: intlShape.isRequired
};

export default injectIntl(SystemAnalytics);

export function formatChannelDoughtnutData(totalPublic, totalPrivate, intl) {
    const {formatMessage} = intl;
    const channelTypeData = {
        labels: [formatMessage(holders.analyticsPublicChannels), formatMessage(holders.analyticsPrivateGroups)],
        datasets: [{
            data: [totalPublic, totalPrivate],
            backgroundColor: ['#46BFBD', '#FDB45C'],
            hoverBackgroundColor: ['#5AD3D1', '#FFC870']
        }]
    };

    return channelTypeData;
}

export function formatPostDoughtnutData(filePosts, hashtagPosts, totalPosts, intl) {
    const {formatMessage} = intl;
    const postTypeData = {
        labels: [formatMessage(holders.analyticsFilePosts), formatMessage(holders.analyticsHashtagPosts), formatMessage(holders.analyticsTextPosts)],
        datasets: [{
            data: [filePosts, hashtagPosts, (totalPosts - filePosts - hashtagPosts)],
            backgroundColor: ['#46BFBD', '#F7464A', '#FDB45C'],
            hoverBackgroundColor: ['#5AD3D1', '#FF5A5E', '#FFC870']
        }]
    };

    return postTypeData;
}

export function formatPostsPerDayData(data) {
    var chartData = {
        labels: [],
        datasets: [{
            fillColor: 'rgba(151,187,205,0.2)',
            borderColor: 'rgba(151,187,205,1)',
            pointBackgroundColor: 'rgba(151,187,205,1)',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: 'rgba(151,187,205,1)',
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

    return chartData;
}

export function formatUsersWithPostsPerDayData(data) {
    var chartData = {
        labels: [],
        datasets: [{
            label: '',
            fillColor: 'rgba(151,187,205,0.2)',
            borderColor: 'rgba(151,187,205,1)',
            pointBackgroundColor: 'rgba(151,187,205,1)',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: 'rgba(151,187,205,1)',
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

    return chartData;
}
