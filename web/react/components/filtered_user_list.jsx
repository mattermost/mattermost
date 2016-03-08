// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import UserList from './user_list.jsx';

import ChannelStore from '../stores/channel_store.jsx';

import * as Client from '../utils/client.jsx';
import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import Constants from '../utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;

import {intlShape, injectIntl, defineMessages, FormattedMessage} from 'mm-intl';

const holders = defineMessages({
    member: {
        id: 'filtered_user_list.member',
        defaultMessage: 'Member'
    },
    search: {
        id: 'filtered_user_list.search',
        defaultMessage: 'Search members'
    }
});

class FilteredUserList extends React.Component {
    constructor(props) {
        super(props);

        this.searchProfiles = this.searchProfiles.bind(this);

        this.state = {
            filter: ''
        };
    }

    componentDidMount() {
        $(ReactDOM.findDOMNode(this.refs.userList)).perfectScrollbar();
    }

    componentDidUpdate(prevProps, prevState) {
        if (prevState.filter !== this.state.filter) {
            $(ReactDOM.findDOMNode(this.refs.userList)).scrollTop(0);
        }
    }

    searchProfiles() {
        const rdata = {};
        rdata.term = this.refs.filter.value;

        if (!rdata.term || rdata.term.length === 0) {
            this.setState({filter: ''});
            return;
        }

        if (this.props.isChannelMembers) {
            Client.searchChannelExtraInfo(
                ChannelStore.getCurrentId(),
                rdata,
                (data) => {
                    AppDispatcher.handleServerAction({
                        type: ActionTypes.RECEIVED_CHANNEL_EXTRA_INFO,
                        extra_info: data
                    });

                    this.setState({filter: rdata.term});
                },
                () => {
                    this.setState({filter: ''});
                }
            );
        } else {
            Client.searchProfiles(
                rdata,
                (data) => {
                    AppDispatcher.handleServerAction({
                        type: ActionTypes.RECEIVED_PROFILES,
                        profiles: data
                    });

                    this.setState({filter: rdata.term});
                },
                () => {
                    this.setState({filter: ''});
                }
            );
        }
    }

    render() {
        const {formatMessage} = this.props.intl;

        let users = this.props.users;

        // this logic might be better placed in UserStore
        if (this.state.filter) {
            const filter = this.state.filter.toLowerCase();

            users = users.filter((user) => {
                return user.username.toLowerCase().indexOf(filter) !== -1 ||
                    (user.first_name && user.first_name.toLowerCase().indexOf(filter) !== -1) ||
                    (user.last_name && user.last_name.toLowerCase().indexOf(filter) !== -1) ||
                    (user.nickname && user.nickname.toLowerCase().indexOf(filter) !== -1);
            });
        }

        let count;
        if (users.length === this.props.users.length) {
            count = (
                <FormattedMessage
                    id='filtered_user_list.count'
                    defaultMessage='{count} {count, plural,
                        one {member}
                        other {members}
                    }'
                    values={{
                        count: users.length
                    }}
                />
            );
        } else {
            count = (
                <FormattedMessage
                    id='filtered_user_list.countTotal'
                    defaultMessage='{count} {count, plural,
                        one {member}
                        other {members}
                    } of {total} Total'
                    values={{
                        count: users.length,
                        total: this.props.users.length
                    }}
                />
            );
        }

        return (
            <div
                className='filtered-user-list'
                style={this.props.style}
            >
                <div className='filter-row'>
                    <div className='col-sm-6'>
                        <input
                            ref='filter'
                            className='form-control filter-textbox'
                            placeholder={formatMessage(holders.search)}
                        />
                    </div>
                    <div className='col-sm-2'>
                        <button
                            className='form-control btn btn-primary'
                            onClick={this.searchProfiles}
                        >
                            <FormattedMessage
                                id='filtered_user_list.searchProfiles'
                                defaultMessage='Search'
                            />
                        </button>
                    </div>
                    <div className='col-sm-4'>
                        <span className='member-count'>{count}</span>
                    </div>
                </div>
                <div
                    ref='userList'
                    className='user-list'
                >
                    <UserList
                        users={users}
                        actions={this.props.actions}
                    />
                </div>
            </div>
        );
    }
}

FilteredUserList.defaultProps = {
    users: [],
    actions: [],
    isChannelMembers: false
};

FilteredUserList.propTypes = {
    intl: intlShape.isRequired,
    users: React.PropTypes.arrayOf(React.PropTypes.object),
    actions: React.PropTypes.arrayOf(React.PropTypes.func),
    style: React.PropTypes.object,
    isChannelMembers: React.PropTypes.bool
};

export default injectIntl(FilteredUserList);
