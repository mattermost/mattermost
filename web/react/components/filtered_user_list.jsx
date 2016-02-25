// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import UserList from './user_list.jsx';

import {intlShape, injectIntl, defineMessages, FormattedMessage} from 'mm-intl';

const holders = defineMessages({
    member: {
        id: 'more_direct_channels.member',
        defaultMessage: 'Member'
    },
    search: {
        id: 'more_direct_channels.search',
        defaultMessage: 'Search members'
    }
});

class FilteredUserList extends React.Component {
    constructor(props) {
        super(props);

        this.handleFilterChange = this.handleFilterChange.bind(this);

        this.state = {
            filter: ''
        };
    }

    componentDidUpdate(prevProps, prevState) {
        if (prevState.filter !== this.state.filter) {
            $(ReactDOM.findDOMNode(this.refs.userList)).scrollTop(0);
        }
    }

    handleFilterChange(e) {
        this.setState({
            filter: e.target.value
        });
    }

    render() {
        const {formatMessage} = this.props.intl;

        let users = this.props.users;

        if (this.state.filter) {
            const filter = this.state.filter.toLowerCase();

            users = users.filter((user) => {
                return user.username.toLowerCase().indexOf(filter) !== -1 ||
                    (user.first_name && user.first_name.toLowerCase().indexOf(filter) !== -1) ||
                    (user.last_name && user.last_name.toLowerCase().indexOf(filter) !== -1) ||
                    (user.nickname && user.nickname.toLowerCase().indexOf(filter) !== -1);
            });
        }

        let memberString = formatMessage(holders.member);
        if (users.length !== 1) {
            memberString += 's';
        }

        let count;
        if (users.length === this.props.users.length) {
            count = (
                <FormattedMessage
                    id='more_direct_channels.count'
                    defaultMessage='{count} {member}'
                    values={{
                        count: users.length,
                        member: memberString
                    }}
                />
            );
        } else {
            count = (
                <FormattedMessage
                    id='more_direct_channels.countTotal'
                    defaultMessage='{count} {member} of {total} Total'
                    values={{
                        count: users.length,
                        member: memberString,
                        total: this.props.users.length
                    }}
                />
            );
        }

        return (
            <div>
                <div className='filter-row'>
                    <div className='col-sm-6'>
                        <input
                            ref='filter'
                            className='form-control filter-textbox'
                            placeholder={formatMessage(holders.search)}
                            onInput={this.handleFilterChange}
                        />
                    </div>
                    <div className='col-sm-6'>
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
    actions: []
};

FilteredUserList.propTypes = {
    intl: intlShape.isRequired,
    users: React.PropTypes.arrayOf(React.PropTypes.object),
    actions: React.PropTypes.arrayOf(React.PropTypes.func)
};

export default injectIntl(FilteredUserList);
