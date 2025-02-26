// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedDate, FormattedMessage, defineMessages} from 'react-intl';

import type {AnalyticsRow, AnalyticsState} from '@mattermost/types/admin';
import type {ClientLicense} from '@mattermost/types/config';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';
import type {RelationOneToOne} from '@mattermost/types/utilities';

import {General} from 'mattermost-redux/constants';

import * as AdminActions from 'actions/admin_actions';

import Banner from 'components/admin_console/banner';
import ActivatedUserCard from 'components/analytics/activated_users_card';
import {messages as activatedUsersCardsMessages} from 'components/analytics/activated_users_card/title';
import LineChart from 'components/analytics/line_chart';
import StatisticCount from 'components/analytics/statistic_count';
import TableChart from 'components/analytics/table_chart';
import ExternalLink from 'components/external_link';
import LoadingScreen from 'components/loading_screen';
import AdminHeader from 'components/widgets/admin_console/admin_header';

import {StatTypes} from 'utils/constants';
import {getMonthLong} from 'utils/i18n';

import {formatPostsPerDayData, formatUsersWithPostsPerDayData, synchronizeChartLabels} from '../format';

const LAST_ANALYTICS_TEAM = 'last_analytics_team';

type Props = {

    /*
     * Array of team objects
     */
    teams: Team[];

    /*
     * Initial team to load analytics for
     */
    initialTeam?: Team;

    /*
     * The locale of the current user
     */
    locale: string;

    license: ClientLicense;

    stats: RelationOneToOne<Team, AnalyticsState>;

    actions: {

        /*
         * Function to get teams
         */
        getTeams: (page?: number, perPage?: number, includeTotalCount?: boolean, excludePolicyConstrained?: boolean) => void;

        /*
         * Function to get users in a team
         */
        getProfilesInTeam: (teamId: string, page: number, perPage?: number, sort?: string, options?: undefined) => Promise<{
            data?: UserProfile[];
        }>;

        /*
         * Function to set a key-value pair in the local storage
         */
        setGlobalItem: (name: string, value: string) => void;
    };
};

type State = {
    team?: Team;
    recentlyActiveUsers?: UserProfile[];
    newUsers?: UserProfile[];
};

const messages = defineMessages({
    title: {id: 'analytics.team.title', defaultMessage: 'Team Statistics for {team}'},
    info: {id: 'analytics.system.info', defaultMessage: 'Use data for only the chosen team. Exclude posts in direct message channels that are not tied to a team.'},
    totalPosts: {id: 'analytics.team.totalPosts', defaultMessage: 'Total Posts'},
    activeUsers: {id: 'analytics.team.activeUsers', defaultMessage: 'Active Users With Posts'},
    publicChannels: {id: 'analytics.team.publicChannels', defaultMessage: 'Public Channels'},
    privateGroups: {id: 'analytics.team.privateGroups', defaultMessage: 'Private Channels'},
    recentUsers: {id: 'analytics.team.recentUsers', defaultMessage: 'Recent Active Users'},
    newlyCreated: {id: 'analytics.team.newlyCreated', defaultMessage: 'Newly Created Users'},
});

export const searchableStrings: Array<string|MessageDescriptor|[MessageDescriptor, {[key: string]: any}]> = [
    [messages.title, {team: ''}],
    messages.info,
    messages.totalPosts,
    messages.activeUsers,
    activatedUsersCardsMessages.totalUsers,
    messages.publicChannels,
    messages.privateGroups,
    messages.recentUsers,
    messages.newlyCreated,
];

export default class TeamAnalytics extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            team: props.initialTeam,
            recentlyActiveUsers: [],
            newUsers: [],
        };
    }

    public componentDidMount(): void {
        if (this.state.team) {
            this.getData(this.state.team.id);
        }

        this.props.actions.getTeams(0, 1000);
    }

    public componentDidUpdate(prevProps: Props, prevState: State): void {
        if (this.state.team && prevState.team !== this.state.team) {
            this.getData(this.state.team.id);
        }
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

    private getData = async (id: string): Promise<void> => {
        AdminActions.getStandardAnalytics(id);
        AdminActions.getPostsPerDayAnalytics(id);
        AdminActions.getBotPostsPerDayAnalytics(id);
        AdminActions.getUsersPerDayAnalytics(id);
        const {data: recentlyActiveUsers} = await this.props.actions.getProfilesInTeam(id, 0, General.PROFILE_CHUNK_SIZE, 'last_activity_at');
        const {data: newUsers} = await this.props.actions.getProfilesInTeam(id, 0, General.PROFILE_CHUNK_SIZE, 'create_at');

        this.setState({
            recentlyActiveUsers,
            newUsers,
        });
    };

    private handleTeamChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
        const teamId = e.target.value;

        let team;
        this.props.teams.forEach((t) => {
            if (t.id === teamId) {
                team = t;
            }
        });

        this.setState({
            team,
        });

        this.props.actions.setGlobalItem(LAST_ANALYTICS_TEAM, teamId);
    };

    public render(): JSX.Element {
        if (this.props.teams.length === 0 || !this.state.team || !this.props.stats[this.state.team.id]) {
            return <LoadingScreen/>;
        }

        if (this.state.team == null) {
            return (
                <Banner
                    description={
                        <FormattedMessage
                            id='analytics.team.noTeams'
                            defaultMessage='This server has no teams for which to view statistics.'
                        />
                    }
                />
            );
        }

        const stats = this.props.stats[this.state.team.id];

        const labels = synchronizeChartLabels(stats[StatTypes.POST_PER_DAY], stats[StatTypes.USERS_WITH_POSTS_PER_DAY]);
        const postCountsDay = formatPostsPerDayData(labels, stats[StatTypes.POST_PER_DAY]);
        const userCountsWithPostsDay = formatUsersWithPostsPerDayData(labels, stats[StatTypes.USERS_WITH_POSTS_PER_DAY]);

        let banner = (
            <div className='banner'>
                <div className='banner__content'>
                    <FormattedMessage {...messages.info}/>
                </div>
            </div>
        );

        let totalPostsCount;
        let postTotalGraph;
        let userActiveGraph;
        if (stats[StatTypes.TOTAL_POSTS] === -1) {
            banner = (
                <div className='banner'>
                    <div className='banner__content'>
                        <FormattedMessage
                            id='analytics.system.infoAndSkippedIntensiveQueries1'
                            defaultMessage='Use data for only the chosen team. Exclude posts in direct message channels that are not tied to a team.'
                        />
                        <p/>
                        <FormattedMessage
                            id='analytics.system.infoAndSkippedIntensiveQueries2'
                            defaultMessage='To maximize performance, some statistics are disabled. You can <link>re-enable them in config.json</link>.'
                            values={{
                                link: (msg: React.ReactNode) => (
                                    <ExternalLink
                                        href='https://docs.mattermost.com/administration/statistics.html'
                                        location='team_analytics'
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
            totalPostsCount = (
                <StatisticCount
                    title={<FormattedMessage {...messages.totalPosts}/>}
                    icon='fa-comment'
                    count={this.getStatValue(stats[StatTypes.TOTAL_POSTS])}
                />
            );

            postTotalGraph = (
                <div className='row'>
                    <LineChart
                        key={this.state.team.id}
                        title={<FormattedMessage {...messages.totalPosts}/>}
                        id='totalPosts'
                        data={postCountsDay}
                        width={740}
                        height={225}
                    />
                </div>
            );

            userActiveGraph = (
                <div className='row'>
                    <LineChart
                        key={this.state.team.id}
                        title={<FormattedMessage {...messages.activeUsers}/>}
                        id='activeUsersWithPosts'
                        data={userCountsWithPostsDay}
                        width={740}
                        height={225}
                    />
                </div>
            );
        }

        const recentActiveUsers = formatRecentUsersData(this.state.recentlyActiveUsers!, this.props.locale);
        const newlyCreatedUsers = formatNewUsersData(this.state.newUsers!, this.props.locale);

        const teams = this.props.teams.sort((a, b) => {
            const aName = a.display_name.toUpperCase();
            const bName = b.display_name.toUpperCase();
            if (aName === bName) {
                return 0;
            }
            if (aName > bName) {
                return 1;
            }
            return -1;
        }).map((team) => {
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
                <AdminHeader>
                    <div className='team-statistics__header'>
                        <FormattedMessage
                            {...messages.title}
                            values={{
                                team: this.state.team.display_name,
                            }}
                        />
                    </div>
                    <div className='team-statistics__team-filter'>
                        <select
                            data-testid='teamFilter'
                            className='form-control team-statistics__team-filter__dropdown'
                            onChange={this.handleTeamChange}
                            value={this.state.team.id}
                        >
                            {teams}
                        </select>
                    </div>
                </AdminHeader>

                <div className='admin-console__wrapper'>
                    <div className='admin-console__content'>
                        {banner}
                        <div className='grid-statistics'>
                            <ActivatedUserCard
                                activatedUsers={this.getStatValue(stats[StatTypes.TOTAL_USERS])}
                                seatsPurchased={parseInt(this.props.license.Users, 10)}
                                isCloud={this.props.license.Cloud === 'true'}
                            />
                            <StatisticCount
                                title={<FormattedMessage {...messages.publicChannels}/>}
                                icon='fa-globe'
                                count={this.getStatValue(stats[StatTypes.TOTAL_PUBLIC_CHANNELS])}
                            />
                            <StatisticCount
                                title={<FormattedMessage {...messages.privateGroups}/>}
                                icon='fa-lock'
                                count={this.getStatValue(stats[StatTypes.TOTAL_PRIVATE_GROUPS])}
                            />
                            {totalPostsCount}
                        </div>
                        {postTotalGraph}
                        {userActiveGraph}
                        <div className='row'>
                            <TableChart
                                title={<FormattedMessage {...messages.recentUsers}/>}
                                data={recentActiveUsers}
                            />
                            <TableChart
                                title={<FormattedMessage {...messages.newlyCreated}/>}
                                data={newlyCreatedUsers}
                            />
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

type Item = {
    name: string;
    value: JSX.Element;
    tip: string;
};

export function formatRecentUsersData(data: UserProfile[], locale: string): Item[] {
    if (data == null) {
        return [];
    }

    return data.map((user: UserProfile) => ({
        name: user.username,
        value: (
            <FormattedDate
                value={user.last_activity_at}
                day='numeric'
                month={getMonthLong(locale)}
                year='numeric'
                hour='2-digit'
                minute='2-digit'
            />
        ),
        tip: user.email,
    }));
}

export function formatNewUsersData(data: UserProfile[], locale: string): Item[] {
    if (data == null) {
        return [];
    }

    return data.map((user: UserProfile) => ({
        name: user.username,
        value: (
            <FormattedDate
                value={user.create_at}
                day='numeric'
                month={getMonthLong(locale)}
                year='numeric'
                hour='2-digit'
                minute='2-digit'
            />
        ),
        tip: user.email,
    }));
}
