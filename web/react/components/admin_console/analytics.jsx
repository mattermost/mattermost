// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from '../../utils/utils.jsx';
import Constants from '../../utils/constants.jsx';
import LineChart from './line_chart.jsx';
import DoughnutChart from './doughnut_chart.jsx';
import StatisticCount from './statistic_count.jsx';

var Tooltip = ReactBootstrap.Tooltip;
var OverlayTrigger = ReactBootstrap.OverlayTrigger;

import {injectIntl, intlShape, defineMessages, FormattedMessage} from 'mm-intl';

const holders = defineMessages({
    analyticsTotalUsers: {
        id: 'admin.analytics.totalUsers',
        defaultMessage: 'Total Users'
    },
    analyticsPublicChannels: {
        id: 'admin.analytics.publicChannels',
        defaultMessage: 'Public Channels'
    },
    analyticsPrivateGroups: {
        id: 'admin.analytics.privateGroups',
        defaultMessage: 'Private Groups'
    },
    analyticsTotalPosts: {
        id: 'admin.analytics.totalPosts',
        defaultMessage: 'Total Posts'
    },
    analyticsFilePosts: {
        id: 'admin.analytics.totalFilePosts',
        defaultMessage: 'Posts with Files'
    },
    analyticsHashtagPosts: {
        id: 'admin.analytics.totalHashtagPosts',
        defaultMessage: 'Posts with Hashtags'
    },
    analyticsIncomingHooks: {
        id: 'admin.analytics.totalIncomingWebhooks',
        defaultMessage: 'Incoming Webhooks'
    },
    analyticsOutgoingHooks: {
        id: 'admin.analytics.totalOutgoingWebhooks',
        defaultMessage: 'Outgoing Webhooks'
    },
    analyticsChannelTypes: {
        id: 'admin.analytics.channelTypes',
        defaultMessage: 'Channel Types'
    },
    analyticsTextPosts: {
        id: 'admin.analytics.textPosts',
        defaultMessage: 'Posts with Text-only'
    },
    analyticsPostTypes: {
        id: 'admin.analytics.postTypes',
        defaultMessage: 'Posts, Files and Hashtags'
    }
});

export default class Analytics extends React.Component {
    constructor(props) {
        super(props);

        this.state = {};
    }

    render() { // in the future, break down these into smaller components
        const {formatMessage} = this.props.intl;

        var serverError = '';
        if (this.props.serverError) {
            serverError = <div className='form-group has-error'><label className='control-label'>{this.props.serverError}</label></div>;
        }

        let loading = (
            <FormattedMessage
                id='admin.analytics.loading'
                defaultMessage='Loading...'
            />
        );

        let firstRow;
        let extraGraphs;
        if (this.props.showAdvanced) {
            firstRow = (
                <div className='row'>
                    <StatisticCount
                        title={formatMessage(holders.analyticsTotalUsers)}
                        icon='fa-users'
                        count={this.props.uniqueUserCount}
                    />
                    <StatisticCount
                        title={formatMessage(holders.analyticsTotalPosts)}
                        icon='fa-comment'
                        count={this.props.postCount}
                    />
                    <StatisticCount
                        title={formatMessage(holders.analyticsIncomingHooks)}
                        icon='fa-arrow-down'
                        count={this.props.incomingWebhookCount}
                    />
                    <StatisticCount
                        title={formatMessage(holders.analyticsOutgoingHooks)}
                        icon='fa-arrow-up'
                        count={this.props.outgoingWebhookCount}
                    />
                </div>
            );

            const channelTypeData = [
                {
                    value: this.props.channelOpenCount,
                    color: '#46BFBD',
                    highlight: '#5AD3D1',
                    label: formatMessage(holders.analyticsPublicChannels)
                },
                {
                    value: this.props.channelPrivateCount,
                    color: '#FDB45C',
                    highlight: '#FFC870',
                    label: formatMessage(holders.analyticsPrivateGroups)
                }
            ];

            const postTypeData = [
                {
                    value: this.props.filePostCount,
                    color: '#46BFBD',
                    highlight: '#5AD3D1',
                    label: formatMessage(holders.analyticsFilePosts)
                },
                {
                    value: this.props.filePostCount,
                    color: '#F7464A',
                    highlight: '#FF5A5E',
                    label: formatMessage(holders.analyticsHashtagPosts)
                },
                {
                    value: this.props.postCount - this.props.filePostCount - this.props.hashtagPostCount,
                    color: '#FDB45C',
                    highlight: '#FFC870',
                    label: formatMessage(holders.analyticsTextPosts)
                }
            ];

            extraGraphs = (
                <div className='row'>
                    <DoughnutChart
                        title={formatMessage(holders.analyticsChannelTypes)}
                        data={channelTypeData}
                        width='300'
                        height='225'
                    />
                    <DoughnutChart
                        title={formatMessage(holders.analyticsPostTypes)}
                        data={postTypeData}
                        width='300'
                        height='225'
                    />
                </div>
            );
        } else {
            firstRow = (
                <div className='row'>
                    <StatisticCount
                        title={formatMessage(holders.analyticsTotalUsers)}
                        icon='fa-users'
                        count={this.props.uniqueUserCount}
                    />
                    <StatisticCount
                        title={formatMessage(holders.analyticsPublicChannels)}
                        icon='fa-globe'
                        count={this.props.channelOpenCount}
                    />
                    <StatisticCount
                        title={formatMessage(holders.analyticsPrivateGroups)}
                        icon='fa-lock'
                        count={this.props.channelPrivateCount}
                    />
                    <StatisticCount
                        title={formatMessage(holders.analyticsTotalPosts)}
                        icon='fa-comment'
                        count={this.props.postCount}
                    />
                </div>
            );
        }

        let postCountsByDay;
        if (this.props.postCountsDay == null) {
            postCountsByDay = (
                <div className='col-sm-12'>
                    <div className='total-count by-day'>
                        <div className='title'>
                            <FormattedMessage
                                id='admin.analytics.totalPosts'
                                defaultMessage='Total Posts'
                            />
                        </div>
                        <div className='content'>{loading}</div>
                    </div>
                </div>
            );
        } else {
            let content;
            if (this.props.postCountsDay.labels.length === 0) {
                content = (
                    <h5>
                        <FormattedMessage
                            id='admin.analytics.meaningful'
                            defaultMessage='Not enough data for a meaningful representation.'
                        />
                    </h5>
                );
            } else {
                content = (
                    <LineChart
                        data={this.props.postCountsDay}
                        width='740'
                        height='225'
                    />
                );
            }
            postCountsByDay = (
                <div className='col-sm-12'>
                    <div className='total-count by-day'>
                        <div className='title'>
                            <FormattedMessage
                                id='admin.analytics.totalPosts'
                                defaultMessage='Total Posts'
                            />
                        </div>
                        <div className='content'>
                            {content}
                        </div>
                    </div>
                </div>
            );
        }

        let usersWithPostsByDay;
        if (this.props.userCountsWithPostsDay == null) {
            usersWithPostsByDay = (
                <div className='col-sm-12'>
                    <div className='total-count by-day'>
                        <div className='title'>
                            <FormattedMessage
                                id='admin.analytics.activeUsers'
                                defaultMessage='Active Users With Posts'
                            />
                        </div>
                        <div className='content'>{loading}</div>
                    </div>
                </div>
            );
        } else {
            let content;
            if (this.props.userCountsWithPostsDay.labels.length === 0) {
                content = (
                    <h5>
                        <FormattedMessage
                            id='admin.analytics.meaningful'
                            defaultMessage='Not enough data for a meaningful representation.'
                        />
                    </h5>
                );
            } else {
                content = (
                    <LineChart
                        data={this.props.userCountsWithPostsDay}
                        width='740'
                        height='225'
                    />
                );
            }
            usersWithPostsByDay = (
                <div className='col-sm-12'>
                    <div className='total-count by-day'>
                        <div className='title'>
                            <FormattedMessage
                                id='admin.analytics.activeUsers'
                                defaultMessage='Active Users With Posts'
                            />
                        </div>
                        <div className='content'>
                            {content}
                        </div>
                    </div>
                </div>
            );
        }

        let recentActiveUser;
        if (this.props.recentActiveUsers != null) {
            let content;
            if (this.props.recentActiveUsers.length === 0) {
                content = loading;
            } else {
                content = (
                    <table>
                        <tbody>
                            {
                                this.props.recentActiveUsers.map((user) => {
                                    const tooltip = (
                                        <Tooltip id={'recent-user-email-tooltip-' + user.id}>
                                            {user.email}
                                        </Tooltip>
                                    );

                                    return (
                                        <tr key={'recent-user-table-entry-' + user.id}>
                                            <td>
                                                <OverlayTrigger
                                                    delayShow={Constants.OVERLAY_TIME_DELAY}
                                                    placement='top'
                                                    overlay={tooltip}
                                                >
                                                    <time>
                                                        {user.username}
                                                    </time>
                                                </OverlayTrigger>
                                            </td>
                                            <td>{Utils.displayDateTime(user.last_activity_at)}</td>
                                        </tr>
                                    );
                                })
                            }
                        </tbody>
                    </table>
                );
            }
            recentActiveUser = (
                <div className='col-sm-6'>
                    <div className='total-count recent-active-users'>
                        <div className='title'>
                            <FormattedMessage
                                id='admin.analytics.recentActive'
                                defaultMessage='Recent Active Users'
                            />
                        </div>
                        <div className='content'>
                            {content}
                        </div>
                    </div>
                </div>
            );
        }

        let newUsers;
        if (this.props.newlyCreatedUsers != null) {
            let content;
            if (this.props.newlyCreatedUsers.length === 0) {
                content = loading;
            } else {
                content = (
                    <table>
                        <tbody>
                            {
                                this.props.newlyCreatedUsers.map((user) => {
                                    const tooltip = (
                                        <Tooltip id={'new-user-email-tooltip-' + user.id}>
                                            {user.email}
                                        </Tooltip>
                                    );

                                    return (
                                        <tr key={'new-user-table-entry-' + user.id}>
                                            <td>
                                                <OverlayTrigger
                                                    delayShow={Constants.OVERLAY_TIME_DELAY}
                                                    placement='top'
                                                    overlay={tooltip}
                                                >
                                                    <time>
                                                        {user.username}
                                                    </time>
                                                </OverlayTrigger>
                                            </td>
                                            <td>{Utils.displayDateTime(user.create_at)}</td>
                                        </tr>
                                    );
                                })
                            }
                        </tbody>
                    </table>
                );
            }
            newUsers = (
                <div className='col-sm-6'>
                    <div className='total-count recent-active-users'>
                        <div className='title'>
                            <FormattedMessage
                                id='admin.analytics.newlyCreated'
                                defaultMessage='Newly Created Users'
                            />
                        </div>
                        <div className='content'>
                            {content}
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className='wrapper--fixed team_statistics'>
                <h3>
                    <FormattedMessage
                        id='admin.analytics.title'
                        defaultMessage='Statistics for {title}'
                        values={{
                            title: this.props.title
                        }}
                    />
                </h3>
                {serverError}
                {firstRow}
                {extraGraphs}
                <div className='row'>
                    {postCountsByDay}
                </div>
                <div className='row'>
                    {usersWithPostsByDay}
                </div>
                <div className='row'>
                    {recentActiveUser}
                    {newUsers}
                </div>
            </div>
        );
    }
}

Analytics.defaultProps = {
    title: null,
    channelOpenCount: null,
    channelPrivateCount: null,
    postCount: null,
    postCountsDay: null,
    userCountsWithPostsDay: null,
    recentActiveUsers: null,
    newlyCreatedUsers: null,
    uniqueUserCount: null,
    serverError: null
};

Analytics.propTypes = {
    intl: intlShape.isRequired,
    title: React.PropTypes.string,
    channelOpenCount: React.PropTypes.number,
    channelPrivateCount: React.PropTypes.number,
    postCount: React.PropTypes.number,
    showAdvanced: React.PropTypes.bool,
    filePostCount: React.PropTypes.number,
    hashtagPostCount: React.PropTypes.number,
    incomingWebhookCount: React.PropTypes.number,
    outgoingWebhookCount: React.PropTypes.number,
    postCountsDay: React.PropTypes.object,
    userCountsWithPostsDay: React.PropTypes.object,
    recentActiveUsers: React.PropTypes.array,
    newlyCreatedUsers: React.PropTypes.array,
    uniqueUserCount: React.PropTypes.number,
    serverError: React.PropTypes.string
};

export default injectIntl(Analytics);
