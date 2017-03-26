// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import {FormattedDate, FormattedMessage, FormattedHTMLMessage} from 'react-intl';

import Banner from 'components/admin_console/banner.jsx';
import LoadingScreen from 'components/loading_screen.jsx';

import AdminStore from 'stores/admin_store.jsx';
import AnalyticsStore from 'stores/analytics_store.jsx';
import BrowserStore from 'stores/browser_store.jsx';

import * as AsyncClient from 'utils/async_client.jsx';
import {StatTypes} from 'utils/constants.jsx';
import {convertTeamMapToList} from 'utils/team_utils.jsx';
import * as Utils from 'utils/utils.jsx';

import LineChart from './line_chart.jsx';
import StatisticCount from './statistic_count.jsx';
import TableChart from './table_chart.jsx';
import {formatPostsPerDayData, formatUsersWithPostsPerDayData} from './system_analytics.jsx';

const LAST_ANALYTICS_TEAM = 'last_analytics_team';

export default class TeamAnalytics extends React.Component {
    constructor(props) {
        super(props);

        this.onChange = this.onChange.bind(this);
        this.onAllTeamsChange = this.onAllTeamsChange.bind(this);
        this.handleTeamChange = this.handleTeamChange.bind(this);

        const teams = convertTeamMapToList(AdminStore.getAllTeams());
        let teamId;
        if (teams.length === 0) {
            teamId = '';
        } else {
            teamId = BrowserStore.getGlobalItem(LAST_ANALYTICS_TEAM, teams[0].id);
        }

        this.state = {
            teams,
            teamId,
            team: AdminStore.getTeam(teamId),
            stats: AnalyticsStore.getAllTeam(teamId)
        };
    }

    componentDidMount() {
        AnalyticsStore.addChangeListener(this.onChange);
        AdminStore.addAllTeamsChangeListener(this.onAllTeamsChange);

        if (this.state.teamId !== '') {
            this.getData(this.state.teamId);
        }
    }

    componentWillUpdate(nextProps, nextState) {
        if (nextState.teamId !== this.state.teamId) {
            this.getData(nextState.teamId);
        }
    }

    getData(id) {
        AsyncClient.getStandardAnalytics(id);
        AsyncClient.getPostsPerDayAnalytics(id);
        AsyncClient.getUsersPerDayAnalytics(id);
        AsyncClient.getRecentAndNewUsersAnalytics(id);
    }

    componentWillUnmount() {
        AnalyticsStore.removeChangeListener(this.onChange);
        AdminStore.removeAllTeamsChangeListener(this.onAllTeamsChange);
    }

    shouldComponentUpdate(nextProps, nextState) {
        if (!Utils.areObjectsEqual(nextState.stats, this.state.stats)) {
            return true;
        }

        if (nextState.teamId !== this.state.teamId) {
            return true;
        }

        return false;
    }

    onChange() {
        this.setState({
            stats: AnalyticsStore.getAllTeam(this.state.teamId)
        });
    }

    onAllTeamsChange() {
        const teams = convertTeamMapToList(AdminStore.getAllTeams());

        if (this.state.teamId === '' && teams.length > 0) {
            this.setState({
                teamId: teams[0].id,
                team: teams[0]
            });
        } else if (this.state.teamId) {
            this.setState({
                team: AdminStore.getTeam(this.state.teamId)
            });
        }

        this.setState({
            teams
        });
    }

    handleTeamChange(e) {
        const teamId = e.target.value;

        this.setState({
            teamId,
            team: AdminStore.getTeam(teamId)
        });

        BrowserStore.setGlobalItem(LAST_ANALYTICS_TEAM, teamId);
    }

    render() {
        if (this.state.teams.length === 0 || !this.state.team || !this.state.stats) {
            return <LoadingScreen/>;
        }

        if (this.state.teamId === '') {
            return (
                <Banner
                    description={
                        <FormattedMessage
                            id='analytics.team.noTeams'
                            defaultMessage='There are no teams on this server for which to view statistics.'
                        />
                    }
                />
            );
        }

        const stats = this.state.stats;
        const postCountsDay = formatPostsPerDayData(stats[StatTypes.POST_PER_DAY]);
        const userCountsWithPostsDay = formatUsersWithPostsPerDayData(stats[StatTypes.USERS_WITH_POSTS_PER_DAY]);

        let banner;
        let totalPostsCount;
        let postTotalGraph;
        let userActiveGraph;
        if (stats[StatTypes.TOTAL_POSTS] === -1) {
            banner = (
                <Banner
                    description={
                        <FormattedHTMLMessage
                            id='analytics.system.skippedIntensiveQueries'
                            defaultMessage="Some statistics have been omitted because they put too much load on the system to calculate. See <a href='https://docs.mattermost.com/administration/statistics.html' target='_blank'>https://docs.mattermost.com/administration/statistics.html</a> for more details."
                        />
                    }
                />
            );
        } else {
            totalPostsCount = (
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
            );

            postTotalGraph = (
                <div className='row'>
                    <LineChart
                        title={
                            <FormattedMessage
                                id='analytics.team.totalPosts'
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

            userActiveGraph = (
                <div className='row'>
                    <LineChart
                        title={
                            <FormattedMessage
                                id='analytics.team.activeUsers'
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

        const recentActiveUsers = formatRecentUsersData(stats[StatTypes.RECENTLY_ACTIVE_USERS]);
        const newlyCreatedUsers = formatNewUsersData(stats[StatTypes.NEWLY_CREATED_USERS]);

        const teams = this.state.teams.map((team) => {
            return (
                <option
                    key={team.id}
                    value={team.id}
                >
                    {team.display_name}
                </option>
            );
        });

        return (
            <div className='wrapper--fixed team_statistics'>
                <div className='row admin-console-header team-statistics__header-row'>
                    <div className='team-statistics__header'>
                        <h3>
                            <FormattedMessage
                                id='analytics.team.title'
                                defaultMessage='Team Statistics for {team}'
                                values={{
                                    team: this.state.team.name
                                }}
                            />
                        </h3>
                    </div>
                    <div className='team-statistics__team-filter'>
                        <select
                            className='form-control team-statistics__team-filter__dropdown'
                            onChange={this.handleTeamChange}
                        >
                            {teams}
                        </select>
                    </div>
                </div>
                {banner}
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
                    {totalPostsCount}
                </div>
                {postTotalGraph}
                {userActiveGraph}
                <div className='row'>
                    <TableChart
                        title={
                            <FormattedMessage
                                id='analytics.team.recentUsers'
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
