// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from '../../utils/utils.jsx';
import Constants from '../../utils/constants.jsx';
import LineChart from './line_chart.jsx';

var Tooltip = ReactBootstrap.Tooltip;
var OverlayTrigger = ReactBootstrap.OverlayTrigger;

import {FormattedMessage} from 'mm-intl';

export default class Analytics extends React.Component {
    constructor(props) {
        super(props);

        this.state = {};
    }

    render() { // in the future, break down these into smaller components
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

        var totalCount = (
            <div className='col-sm-3'>
                <div className='total-count'>
                    <div className='title'>
                        <FormattedMessage
                            id='admin.analytics.totalUsers'
                            defaultMessage='Total Users'
                        />
                        <i className='fa fa-users'/></div>
                    <div className='content'>{this.props.uniqueUserCount == null ? loading : this.props.uniqueUserCount}</div>
                </div>
            </div>
        );

        var openChannelCount = (
            <div className='col-sm-3'>
                <div className='total-count'>
                    <div className='title'>
                        <FormattedMessage
                            id='admin.analytics.publicChannels'
                            defaultMessage='Public Channels'
                        />
                        <i className='fa fa-globe'/></div>
                    <div className='content'>{this.props.channelOpenCount == null ? loading : this.props.channelOpenCount}</div>
                </div>
            </div>
        );

        var openPrivateCount = (
            <div className='col-sm-3'>
                <div className='total-count'>
                    <div className='title'>
                        <FormattedMessage
                            id='admin.analytics.privateGroups'
                            defaultMessage='Private Groups'
                        />
                        <i className='fa fa-lock'/></div>
                    <div className='content'>{this.props.channelPrivateCount == null ? loading : this.props.channelPrivateCount}</div>
                </div>
            </div>
        );

        var postCount = (
            <div className='col-sm-3'>
                <div className='total-count'>
                    <div className='title'>
                        <FormattedMessage
                            id='admin.analytics.totalPosts'
                            defaultMessage='Total Posts'
                        />
                        <i className='fa fa-comment'/></div>
                    <div className='content'>{this.props.postCount == null ? loading : this.props.postCount}</div>
                </div>
            </div>
        );

        var postCountsByDay = (
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

        if (this.props.postCountsDay != null) {
            let content;
            if (this.props.postCountsDay.labels.length === 0) {
                content = (
                    <FormattedMessage
                        id='admin.analytics.meaningful'
                        defaultMessage='Not enough data for a meaningful representation.'
                    />
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

        var usersWithPostsByDay = (
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

        if (this.props.userCountsWithPostsDay != null) {
            let content;
            if (this.props.userCountsWithPostsDay.labels.length === 0) {
                content = (
                    <FormattedMessage
                        id='admin.analytics.meaningful'
                        defaultMessage='Not enough data for a meaningful representation.'
                    />
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
                <div className='row'>
                    {totalCount}
                    {postCount}
                    {openChannelCount}
                    {openPrivateCount}
                </div>
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
    title: React.PropTypes.string,
    channelOpenCount: React.PropTypes.number,
    channelPrivateCount: React.PropTypes.number,
    postCount: React.PropTypes.number,
    postCountsDay: React.PropTypes.object,
    userCountsWithPostsDay: React.PropTypes.object,
    recentActiveUsers: React.PropTypes.array,
    newlyCreatedUsers: React.PropTypes.array,
    uniqueUserCount: React.PropTypes.number,
    serverError: React.PropTypes.string
};
