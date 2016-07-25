// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Banner from 'components/admin_console/banner.jsx';
import LineChart from './line_chart.jsx';
import DoughnutChart from './doughnut_chart.jsx';
import StatisticCount from './statistic_count.jsx';

import AnalyticsStore from 'stores/analytics_store.jsx';

import * as Utils from 'utils/utils.jsx';
import {isLicenseExpired, isLicenseExpiring, displayExpiryDate} from 'utils/license_utils.jsx';
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

        let advancedCounts;
        let advancedGraphs;
        let banner;
        if (global.window.mm_license.IsLicensed === 'true') {
            advancedCounts = (
                <div className='row'>
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
                </div>
            );

            const channelTypeData = formatChannelDoughtnutData(stats[StatTypes.TOTAL_PUBLIC_CHANNELS], stats[StatTypes.TOTAL_PRIVATE_GROUPS], this.props.intl);
            const postTypeData = formatPostDoughtnutData(stats[StatTypes.TOTAL_FILE_POSTS], stats[StatTypes.TOTAL_HASHTAG_POSTS], stats[StatTypes.TOTAL_POSTS], this.props.intl);

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
                </div>
            );

            if (isLicenseExpired()) {
                banner = (
                    <Banner
                        description={
                            <FormattedHTMLMessage
                                id='analytics.system.expiredBanner'
                                defaultMessage='The Enterprise license expired on {date}. You have 15 days from this date to renew the license, please contact <a href="mailto:commercial@mattermost.com">commercial@mattermost.com</a>.'
                                values={{
                                    date: displayExpiryDate()
                                }}
                            />
                        }
                    />
                );
            } else if (isLicenseExpiring()) {
                banner = (
                    <Banner
                        description={
                            <FormattedHTMLMessage
                                id='analytics.system.expiringBanner'
                                defaultMessage='The Enterprise license is expiring on {date}. To renew your license, please contact <a href="mailto:commercial@mattermost.com">commercial@mattermost.com</a>.'
                                values={{
                                    date: displayExpiryDate()
                                }}
                            />
                        }
                    />
                );
            }
        }

        const postCountsDay = formatPostsPerDayData(stats[StatTypes.POST_PER_DAY]);
        const userCountsWithPostsDay = formatUsersWithPostsPerDayData(stats[StatTypes.USERS_WITH_POSTS_PER_DAY]);

        return (
            <div className='wrapper--fixed team_statistics'>
                <h3>
                    <FormattedMessage
                        id='analytics.system.title'
                        defaultMessage='System Statistics'
                    />
                </h3>
                {banner}
                <div className='row'>
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
                </div>
                {advancedCounts}
                {advancedGraphs}
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
