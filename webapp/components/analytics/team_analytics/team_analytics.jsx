// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import PropTypes from 'prop-types';
import {FormattedDate, FormattedMessage, FormattedHTMLMessage} from 'react-intl';

import Banner from 'components/admin_console/banner.jsx';
import LoadingScreen from 'components/loading_screen.jsx';

import AnalyticsStore from 'stores/analytics_store.jsx';
import BrowserStore from 'stores/browser_store.jsx';

import * as AdminActions from 'actions/admin_actions.jsx';
import {StatTypes} from 'utils/constants.jsx';
import {General} from 'mattermost-redux/constants';

import LineChart from 'components/analytics/line_chart.jsx';
import StatisticCount from 'components/analytics/statistic_count.jsx';
import TableChart from 'components/analytics/table_chart.jsx';
import {formatPostsPerDayData, formatUsersWithPostsPerDayData} from 'components/analytics/system_analytics.jsx';

const LAST_ANALYTICS_TEAM = 'last_analytics_team';

export default class TeamAnalytics extends React.Component {
    static propTypes = {

        /*
         * Array of team objects
         */
        teams: PropTypes.arrayOf(PropTypes.object).isRequired,

        /*
         * Initial team to load analytics for
         */
        initialTeam: PropTypes.object,

        actions: PropTypes.shape({

            /*
             * Function to get teams
             */
            getTeams: PropTypes.func.isRequired,

            /*
             * Function to get users in a team
             */
            getProfilesInTeam: PropTypes.func.isRequired
        }).isRequired
    }

    constructor(props) {
        super(props);

        const teamId = props.initialTeam ? props.initialTeam.id : '';

        this.state = {
            team: props.initialTeam,
            stats: AnalyticsStore.getAllTeam(teamId),
            recentlyActiveUsers: [],
            newUsers: []
        };
    }

    componentDidMount() {
        AnalyticsStore.addChangeListener(this.onChange);

        if (this.state.team) {
            this.getData(this.state.team.id);
        }

        this.props.actions.getTeams(0, 1000);
    }

    componentWillUpdate(nextProps, nextState) {
        if (nextState.team && nextState.team !== this.state.team) {
            this.getData(nextState.team.id);
        }
    }

    getData = async (id) => {
        AdminActions.getStandardAnalytics(id);
        AdminActions.getPostsPerDayAnalytics(id);
        AdminActions.getUsersPerDayAnalytics(id);
        const recentlyActiveUsers = await this.props.actions.getProfilesInTeam(id, 0, General.PROFILE_CHUNK_SIZE, 'last_activity_at');
        const newUsers = await this.props.actions.getProfilesInTeam(id, 0, General.PROFILE_CHUNK_SIZE, 'create_at');

        this.setState({
            recentlyActiveUsers,
            newUsers
        });
    }

    componentWillUnmount() {
        AnalyticsStore.removeChangeListener(this.onChange);
    }

    onChange = () => {
        const teamId = this.state.team ? this.state.team.id : '';
        this.setState({
            stats: AnalyticsStore.getAllTeam(teamId)
        });
    }

    handleTeamChange = (e) => {
        const teamId = e.target.value;

        let team;
        this.props.teams.forEach((t) => {
            if (t.id === teamId) {
                team = t;
            }
        });

        this.setState({
            team
        });

        BrowserStore.setGlobalItem(LAST_ANALYTICS_TEAM, teamId);
    }

    render() {
        if (this.props.teams.length === 0 || !this.state.team || !this.state.stats) {
            return <LoadingScreen/>;
        }

        if (this.state.team == null) {
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
                <div className='banner'>
                    <div className='banner__content'>
                        <FormattedHTMLMessage
                            id='analytics.system.skippedIntensiveQueries'
                            defaultMessage="Some statistics have been omitted because they put too much load on the system to calculate. See <a href='https://docs.mattermost.com/administration/statistics.html' target='_blank'>https://docs.mattermost.com/administration/statistics.html</a> for more details."
                        />
                    </div>
                </div>
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
                        key={this.state.team.id}
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
                        key={this.state.team.id}
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

        const recentActiveUsers = formatRecentUsersData(this.state.recentlyActiveUsers);
        const newlyCreatedUsers = formatNewUsersData(this.state.newUsers);

        const teams = this.props.teams.map((team) => {
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
                <div className='admin-console-header team-statistics__header-row'>
                    <div className='team-statistics__header'>
                        <h3>
                            <FormattedMessage
                                id='analytics.team.title'
                                defaultMessage='Team Statistics for {team}'
                                values={{
                                    team: this.state.team.display_name
                                }}
                            />
                        </h3>
                    </div>
                    <div className='team-statistics__team-filter'>
                        <select
                            className='form-control team-statistics__team-filter__dropdown'
                            onChange={this.handleTeamChange}
                            value={this.state.team.id}
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
                                defaultMessage='Private Channels'
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
