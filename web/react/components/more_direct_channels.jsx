// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

const Modal = ReactBootstrap.Modal;
import UserStore from '../stores/user_store.jsx';
import * as Utils from '../utils/utils.jsx';

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

class MoreDirectChannels extends React.Component {
    constructor(props) {
        super(props);

        this.handleFilterChange = this.handleFilterChange.bind(this);
        this.handleHide = this.handleHide.bind(this);
        this.handleShowDirectChannel = this.handleShowDirectChannel.bind(this);
        this.handleUserChange = this.handleUserChange.bind(this);

        this.createRowForUser = this.createRowForUser.bind(this);

        this.state = {
            users: this.getUsersFromStore(),
            filter: '',
            loadingDMChannel: -1
        };
    }

    getUsersFromStore() {
        const currentId = UserStore.getCurrentId();
        const profiles = UserStore.getActiveOnlyProfiles();
        const users = [];

        for (const id in profiles) {
            if (id !== currentId) {
                users.push(profiles[id]);
            }
        }

        users.sort((a, b) => a.username.localeCompare(b.username));

        return users;
    }

    componentDidMount() {
        UserStore.addChangeListener(this.handleUserChange);
    }

    componentWillUnmount() {
        UserStore.addChangeListener(this.handleUserChange);
    }

    componentDidUpdate(prevProps) {
        if (!prevProps.show && this.props.show) {
            this.onShow();
        }
    }

    onShow() {
        if (Utils.isMobile()) {
            $(ReactDOM.findDOMNode(this.refs.userList)).css('max-height', $(window).height() - 250);
        } else {
            $(ReactDOM.findDOMNode(this.refs.userList)).perfectScrollbar();
            $(ReactDOM.findDOMNode(this.refs.userList)).css('max-height', $(window).height() - 300);
        }
    }

    handleFilterChange() {
        const filter = ReactDOM.findDOMNode(this.refs.filter).value;

        if ($(window).width() > 768) {
            $(ReactDOM.findDOMNode(this.refs.userList)).scrollTop(0);
        }

        if (filter !== this.state.filter) {
            this.setState({filter});
        }
    }

    handleHide() {
        if (this.props.onModalDismissed) {
            this.props.onModalDismissed();
        }

        this.setState({filter: ''});
    }

    handleShowDirectChannel(teammate, e) {
        e.preventDefault();

        if (this.state.loadingDMChannel !== -1) {
            return;
        }

        this.setState({loadingDMChannel: teammate.id});
        Utils.openDirectChannelToUser(
            teammate,
            (channel) => {
                Utils.switchChannel(channel);
                this.setState({loadingDMChannel: -1});
                this.handleHide();
            },
            () => {
                this.setState({loadingDMChannel: -1});
            }
        );
    }

    handleUserChange() {
        this.setState({users: this.getUsersFromStore()});
    }

    createRowForUser(user) {
        const details = [];

        const fullName = Utils.getFullName(user);
        if (fullName) {
            details.push(
                <span
                    key={`${user.id}__full-name`}
                    className='full-name'
                >
                    {fullName}
                </span>
            );
        }

        if (user.nickname) {
            const separator = fullName ? ' - ' : '';
            details.push(
                <span
                    key={`${user.nickname}__nickname`}
                >
                    {separator + user.nickname}
                </span>
            );
        }

        let joinButton;
        if (this.state.loadingDMChannel === user.id) {
            joinButton = (
                <img
                    className='channel-loading-gif'
                    src='/static/images/load.gif'
                />
            );
        } else {
            joinButton = (
                <button
                    type='button'
                    className='btn btn-primary btn-message'
                    onClick={this.handleShowDirectChannel.bind(this, user)}
                >
                    <FormattedMessage
                        id='more_direct_channels.message'
                        defaultMessage='Message'
                    />
                </button>
            );
        }

        return (
            <tr key={'direct-channel-row-user' + user.id}>
                <td
                    key={user.id}
                    className='direct-channel'
                >
                    <img
                        className='profile-img pull-left'
                        width='38'
                        height='38'
                        src={`/api/v1/users/${user.id}/image?time=${user.update_at}&${Utils.getSessionIndex()}`}
                    />
                    <div className='more-name'>
                        {user.username}
                    </div>
                    <div className='more-description'>
                        {details}
                    </div>
                </td>
                <td className='td--action lg'>
                    {joinButton}
                </td>
            </tr>
        );
    }

    render() {
        const {formatMessage} = this.props.intl;
        if (!this.props.show) {
            return null;
        }

        let users = this.state.users;
        if (this.state.filter) {
            const filter = this.state.filter.toLowerCase();

            users = users.filter((user) => {
                return user.username.toLowerCase().indexOf(filter) !== -1 ||
                    user.first_name.toLowerCase().indexOf(filter) !== -1 ||
                    user.last_name.toLowerCase().indexOf(filter) !== -1 ||
                    user.nickname.toLowerCase().indexOf(filter) !== -1;
            });
        }

        const userEntries = users.map(this.createRowForUser);

        if (userEntries.length === 0) {
            userEntries.push(
                <tr key='no-users-found'><td>
                    <FormattedMessage
                        id='more_direct_channels.notFound'
                        defaultMessage='No users found :('
                    />
                </td></tr>);
        }

        let memberString = formatMessage(holders.member);
        if (users.length !== 1) {
            memberString += 's';
        }

        let count;
        if (users.length === this.state.users.length) {
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
                        total: this.state.users.length
                    }}
                />
            );
        }

        return (
            <Modal
                dialogClassName='more-modal'
                show={this.props.show}
                onHide={this.handleHide}
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title>
                        <FormattedMessage
                            id='more_direct_channels.title'
                            defaultMessage='Direct Messages'
                        />
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body ref='modalBody'>
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
                        <table className='more-table table'>
                            <tbody>
                                {userEntries}
                            </tbody>
                        </table>
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <button
                        type='button'
                        className='btn btn-default'
                        onClick={this.handleHide}
                    >
                        <FormattedMessage
                            id='more_direct_channels.close'
                            defaultMessage='Close'
                        />
                    </button>
                </Modal.Footer>
            </Modal>
        );
    }
}

MoreDirectChannels.propTypes = {
    intl: intlShape.isRequired,
    show: React.PropTypes.bool.isRequired,
    onModalDismissed: React.PropTypes.func
};

export default injectIntl(MoreDirectChannels);