// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';

import type {AnalyticsRow, PluginAnalyticsRow, IndexedPluginAnalyticsRow, AnalyticsState} from '@mattermost/types/admin';
import {AnalyticsVisualizationType} from '@mattermost/types/admin';
import type {ClientLicense} from '@mattermost/types/config';

import * as AdminActions from 'actions/admin_actions.jsx';

import ActivatedUserCard from 'components/analytics/activated_users_card';
import ExternalLink from 'components/external_link';
import AdminHeader from 'components/widgets/admin_console/admin_header';

import Constants from 'utils/constants';

import type {GlobalState} from 'types/store';

import DoughnutChart from '../doughnut_chart';
import {
    formatPostsPerDayData,
    formatUsersWithPostsPerDayData,
    formatChannelDoughtnutData,
    formatPostDoughtnutData,
    synchronizeChartLabels,
} from '../format';
import LineChart from '../line_chart';
import StatisticCount from '../statistic_count';

const StatTypes = Constants.StatTypes;

type Props = {
    isLicensed: boolean;
    stats?: AnalyticsState;
    license: ClientLicense;
    pluginStatHandlers: GlobalState['plugins']['siteStatsHandlers'];
}

type State = {
    pluginSiteStats: Record<string, PluginAnalyticsRow>;
}

const messages = defineMessages({
    title: {id: 'analytics.system.title', defaultMessage: 'System Statistics'},
    totalPosts: {id: 'analytics.system.totalPosts', defaultMessage: 'Total Posts'},
    activeUsers: {id: 'analytics.system.activeUsers', defaultMessage: 'Active Users With Posts'},
    totalSessions: {id: 'analytics.system.totalSessions', defaultMessage: 'Total Sessions'},
    totalCommands: {id: 'analytics.system.totalCommands', defaultMessage: 'Total Commands'},
    totalIncomingWebhooks: {id: 'analytics.system.totalIncomingWebhooks', defaultMessage: 'Incoming Webhooks'},
    totalOutgoingWebhooks: {id: 'analytics.system.totalOutgoingWebhooks', defaultMessage: 'Outgoing Webhooks'},
    totalWebsockets: {id: 'analytics.system.totalWebsockets', defaultMessage: 'WebSocket Conns'},
    totalMasterDbConnections: {id: 'analytics.system.totalMasterDbConnections', defaultMessage: 'Master DB Conns'},
    totalReadDbConnections: {id: 'analytics.system.totalReadDbConnections', defaultMessage: 'Replica DB Conns'},
    postTypes: {id: 'analytics.system.postTypes', defaultMessage: 'Posts, Files and Hashtags'},
    channelTypes: {id: 'analytics.system.channelTypes', defaultMessage: 'Channel Types'},
    totalTeams: {id: 'analytics.system.totalTeams', defaultMessage: 'Total Teams'},
    totalChannels: {id: 'analytics.system.totalChannels', defaultMessage: 'Total Channels'},
    dailyActiveUsers: {id: 'analytics.system.dailyActiveUsers', defaultMessage: 'Daily Active Users'},
    monthlyActiveUsers: {id: 'analytics.system.monthlyActiveUsers', defaultMessage: 'Monthly Active Users'},
});

export const searchableStrings = [
    messages.title,
    messages.totalPosts,
    messages.activeUsers,
    messages.totalSessions,
    messages.totalCommands,
    messages.totalIncomingWebhooks,
    messages.totalOutgoingWebhooks,
    messages.totalWebsockets,
    messages.totalMasterDbConnections,
    messages.totalReadDbConnections,
    messages.postTypes,
    messages.channelTypes,
    messages.totalTeams,
    messages.totalChannels,
    messages.dailyActiveUsers,
    messages.monthlyActiveUsers,
];

export default class SystemAnalytics extends React.PureComponent<Props, State> {
    state = {
        pluginSiteStats: {} as Record<string, PluginAnalyticsRow>,
    };

    public async componentDidMount() {
        AdminActions.getStandardAnalytics();
        AdminActions.getPostsPerDayAnalytics();
        AdminActions.getBotPostsPerDayAnalytics();
        AdminActions.getUsersPerDayAnalytics();

        if (this.props.isLicensed) {
            AdminActions.getAdvancedAnalytics();
        }
        this.fetchPluginStats();
    }

    // fetchPluginStats does a call for each one of the registered handlers,
    // wait and set the data in the state
    private async fetchPluginStats() {
        const pluginKeys = Object.keys(this.props.pluginStatHandlers);
        if (!pluginKeys.length) {
            return;
        }

        const allHandlers = Object.values(this.props.pluginStatHandlers).map((handler) => handler());
        const allStats = await Promise.all(allHandlers);

        const allStatsIndexed: IndexedPluginAnalyticsRow = {};
        allStats.forEach((pluginStats, idx) => {
            Object.entries(pluginStats).forEach(([name, value]) => {
                const key = `${pluginKeys[idx]}.${name}`;
                allStatsIndexed[key] = value;
            });
        });

        this.setState({pluginSiteStats: allStatsIndexed});
    }

    private getStatValue(stat: number | AnalyticsRow[] | undefined): number | undefined {
        if (typeof stat === 'number') {
            return stat;
        }
        if (!stat || stat.length === 0) {
            return undefined;
        }
        return stat[0].value;
    }

    public render() {
        const stats = this.props.stats!;
        const isLicensed = this.props.isLicensed;
        const skippedIntensiveQueries = stats[StatTypes.TOTAL_POSTS] === -1;

        const labels = synchronizeChartLabels(stats[StatTypes.POST_PER_DAY], stats[StatTypes.BOT_POST_PER_DAY], stats[StatTypes.USERS_WITH_POSTS_PER_DAY]);
        const postCountsDay = formatPostsPerDayData(labels, stats[StatTypes.POST_PER_DAY]);
        const botPostCountsDay = formatPostsPerDayData(labels, stats[StatTypes.BOT_POST_PER_DAY]);
        const userCountsWithPostsDay = formatUsersWithPostsPerDayData(labels, stats[StatTypes.USERS_WITH_POSTS_PER_DAY]);

        let banner;
        let postCount;
        let postTotalGraph;
        let botPostTotalGraph;
        let activeUserGraph;
        if (skippedIntensiveQueries) {
            banner = (
                <div className='banner'>
                    <div className='banner__content'>
                        <FormattedMessage
                            id='analytics.system.skippedIntensiveQueries'
                            defaultMessage='To maximize performance, some statistics are disabled. You can <link>re-enable them in config.json</link>.'
                            values={{
                                link: (msg: React.ReactNode) => (
                                    <ExternalLink
                                        href='https://docs.mattermost.com/administration/statistics.html'
                                        location='system_analytics'
                                    >
                                        {msg}
                                    </ExternalLink>
                                ),
                            }}
                        />
                    </div>
                </div>
            );
        } else {
            postCount = (
                <StatisticCount
                    id='totalPosts'
                    title={<FormattedMessage {...messages.totalPosts}/>}
                    icon='fa-comment'
                    count={this.getStatValue(stats[StatTypes.TOTAL_POSTS])}
                />
            );

            botPostTotalGraph = (
                <div className='row'>
                    <LineChart
                        title={
                            <FormattedMessage
                                id='analytics.system.totalBotPosts'
                                defaultMessage='Total Posts from Bots'
                            />
                        }
                        data={botPostCountsDay}
                        id='totalPostsFromBotsLineChart'
                        width={740}
                        height={225}
                    />
                </div>
            );

            postTotalGraph = (
                <div className='row'>
                    <LineChart
                        title={<FormattedMessage {...messages.totalPosts}/>}
                        id='totalPostsLineChart'
                        data={postCountsDay}
                        width={740}
                        height={225}
                    />
                </div>
            );

            activeUserGraph = (
                <div className='row'>
                    <LineChart
                        title={<FormattedMessage {...messages.activeUsers}/>}
                        id='activeUsersWithPostsLineChart'
                        data={userCountsWithPostsDay}
                        width={740}
                        height={225}
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
        if (this.props.isLicensed) {
            sessionCount = (
                <StatisticCount
                    id='totalSessions'
                    title={<FormattedMessage {...messages.totalSessions}/>}
                    icon='fa-signal'
                    count={this.getStatValue(stats[StatTypes.TOTAL_SESSIONS])}
                />
            );

            commandCount = (
                <StatisticCount
                    id='totalCommands'
                    title={<FormattedMessage {...messages.totalCommands}/>}
                    icon='fa-terminal'
                    count={this.getStatValue(stats[StatTypes.TOTAL_COMMANDS])}
                />
            );

            incomingCount = (
                <StatisticCount
                    id='incomingWebhooks'
                    title={<FormattedMessage {...messages.totalIncomingWebhooks}/>
                    }
                    icon='fa-arrow-down'
                    count={this.getStatValue(stats[StatTypes.TOTAL_IHOOKS])}
                />
            );

            outgoingCount = (
                <StatisticCount
                    id='outgoingWebhooks'
                    title={<FormattedMessage {...messages.totalOutgoingWebhooks}/>
                    }
                    icon='fa-arrow-up'
                    count={this.getStatValue(stats[StatTypes.TOTAL_OHOOKS])}
                />
            );

            advancedStats = (
                <>
                    <StatisticCount
                        id='websocketConns'
                        title={<FormattedMessage {...messages.totalWebsockets}/>
                        }
                        icon='fa-user'
                        count={this.getStatValue(stats[StatTypes.TOTAL_WEBSOCKET_CONNECTIONS])}
                    />
                    <StatisticCount
                        id='masterDbConns'
                        title={<FormattedMessage {...messages.totalMasterDbConnections}/>
                        }
                        icon='fa-terminal'
                        count={this.getStatValue(stats[StatTypes.TOTAL_MASTER_DB_CONNECTIONS])}
                    />
                    <StatisticCount
                        id='replicaDbConns'
                        title={<FormattedMessage {...messages.totalReadDbConnections}/>
                        }
                        icon='fa-terminal'
                        count={this.getStatValue(stats[StatTypes.TOTAL_READ_DB_CONNECTIONS])}
                    />
                </>
            );

            const channelTypeData = formatChannelDoughtnutData(stats[StatTypes.TOTAL_PUBLIC_CHANNELS], stats[StatTypes.TOTAL_PRIVATE_GROUPS]);
            const postTypeData = formatPostDoughtnutData(stats[StatTypes.TOTAL_FILE_POSTS], stats[StatTypes.TOTAL_HASHTAG_POSTS], stats[StatTypes.TOTAL_POSTS]);

            let postTypeGraph;
            if (stats[StatTypes.TOTAL_POSTS] !== -1) {
                postTypeGraph = (
                    <DoughnutChart
                        title={<FormattedMessage {...messages.postTypes}/>
                        }
                        data={postTypeData}
                        width={300}
                        height={225}
                    />
                );
            }

            advancedGraphs = (
                <div className='row'>
                    <DoughnutChart
                        title={<FormattedMessage {...messages.channelTypes}/>
                        }
                        data={channelTypeData}
                        width={300}
                        height={225}
                    />
                    {postTypeGraph}
                </div>
            );
        }

        const isCloud = this.props.license.Cloud === 'true';
        const userCount = (
            <ActivatedUserCard
                activatedUsers={this.getStatValue(stats[StatTypes.TOTAL_USERS])}
                seatsPurchased={parseInt(this.props.license.Users, 10)}
                isCloud={isCloud}
            />
        );

        const seatsPurchased = (
            <StatisticCount
                id='seatPurchased'
                title={
                    <FormattedMessage
                        id='analytics.system.seatsPurchased'
                        defaultMessage='Licensed Seats'
                    />
                }
                icon='fa-users'
                count={parseInt(this.props.license.Users, 10)}
            />
        );

        const teamCount = (
            <StatisticCount
                id='totalTeams'
                title={<FormattedMessage {...messages.totalTeams}/>
                }
                icon='fa-users'
                count={this.getStatValue(stats[StatTypes.TOTAL_TEAMS])}
            />
        );
        const totalPublicChannelsCount = this.getStatValue(stats[StatTypes.TOTAL_PUBLIC_CHANNELS]);
        const totalPrivateGroupsCount = this.getStatValue(stats[StatTypes.TOTAL_PRIVATE_GROUPS]);
        const totalChannelCount = () => {
            if (totalPublicChannelsCount && totalPrivateGroupsCount) {
                return totalPublicChannelsCount + totalPrivateGroupsCount;
            } else if (!totalPublicChannelsCount && totalPrivateGroupsCount) {
                return totalPrivateGroupsCount;
            } else if (totalPublicChannelsCount && !totalPrivateGroupsCount) {
                return totalPublicChannelsCount;
            }
            return undefined;
        };
        const channelCount = (
            <StatisticCount
                id='totalChannels'
                title={<FormattedMessage {...messages.totalChannels}/>
                }
                icon='fa-globe'
                count={totalChannelCount()}
            />
        );

        const dailyActiveUsers = (
            <StatisticCount
                id='dailyActiveUsers'
                title={<FormattedMessage {...messages.dailyActiveUsers}/>
                }
                icon='fa-users'
                count={this.getStatValue(stats[StatTypes.DAILY_ACTIVE_USERS])}
            />
        );

        const monthlyActiveUsers = (
            <StatisticCount
                id='monthlyActiveUsers'
                title={<FormattedMessage {...messages.monthlyActiveUsers}/>
                }
                icon='fa-users'
                count={this.getStatValue(stats[StatTypes.MONTHLY_ACTIVE_USERS])}
            />
        );

        // Extract plugin stats that should be displayed and pass them to widget
        const pluginCounts = [];
        const pluginLineCharts = [];
        const pluginDoughnutCharts = [];

        for (const [key, stat] of Object.entries(this.state.pluginSiteStats)) {
            switch (stat.visualizationType) {
            case AnalyticsVisualizationType.LineChart:
                pluginLineCharts.push((
                    <LineChart
                        id={key}
                        key={'pluginstat.' + key}
                        title={stat.name}
                        data={stat.value}
                        width={740}
                        height={225}
                    />
                ));
                break;
            case AnalyticsVisualizationType.DoughnutChart:
                pluginDoughnutCharts.push((
                    <DoughnutChart
                        key={'pluginstat.' + key}
                        title={stat.name}
                        data={stat.value}
                        width={300}
                        height={225}
                    />
                ));
                break;
            case AnalyticsVisualizationType.Count:
            default:
                pluginCounts.push((
                    <StatisticCount
                        id={key}
                        key={'pluginstat.' + key}
                        title={stat.name}
                        icon={stat.icon!}
                        count={stat.value}
                    />
                ));
            }
        }

        let systemCards;
        if (isLicensed) {
            systemCards = (
                <>
                    {userCount}
                    {isCloud ? null : seatsPurchased}
                    {teamCount}
                    {channelCount}
                    {skippedIntensiveQueries ? null : postCount}
                    {sessionCount}
                    {commandCount}
                    {incomingCount}
                    {outgoingCount}
                </>
            );
        } else if (!isLicensed) {
            systemCards = (
                <>
                    {userCount}
                    {isCloud || !isLicensed ? null : seatsPurchased}
                    {teamCount}
                    {channelCount}
                    {skippedIntensiveQueries ? null : postCount}
                </>
            );
        }

        return (
            <div className='wrapper--fixed team_statistics'>
                <AdminHeader>
                    <FormattedMessage {...messages.title}/>
                </AdminHeader>
                <div className='admin-console__wrapper'>
                    <div className='admin-console__content'>
                        {banner}
                        <div className='grid-statistics'>
                            {systemCards}
                            {dailyActiveUsers}
                            {monthlyActiveUsers}
                            {advancedStats}
                            {pluginCounts}
                        </div>
                        {advancedGraphs}
                        {pluginDoughnutCharts}
                        {postTotalGraph}
                        {botPostTotalGraph}
                        {activeUserGraph}
                        {pluginLineCharts}
                    </div>
                </div>
            </div>
        );
    }
}
