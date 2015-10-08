// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

const UserStore = require('../stores/user_store.jsx');
const Client = require('../utils/client.jsx');
const AsyncClient = require('../utils/async_client.jsx');
const Utils = require('../utils/utils.jsx');

export default class MemberListTeamItem extends React.Component {
    constructor(props) {
        super(props);

        this.handleMakeMember = this.handleMakeMember.bind(this);
        this.handleMakeActive = this.handleMakeActive.bind(this);
        this.handleMakeNotActive = this.handleMakeNotActive.bind(this);
        this.handleMakeAdmin = this.handleMakeAdmin.bind(this);

        this.state = {};
    }
    handleMakeMember() {
        const data = {
            user_id: this.props.user.id,
            new_roles: ''
        };

        Client.updateRoles(data,
            () => {
                AsyncClient.getProfiles();
            },
            (err) => {
                this.setState({serverError: err.message});
            }
        );
    }
    handleMakeActive() {
        Client.updateActive(this.props.user.id, true,
            () => {
                AsyncClient.getProfiles();
            },
            (err) => {
                this.setState({serverError: err.message});
            }
        );
    }
    handleMakeNotActive() {
        Client.updateActive(this.props.user.id, false,
            () => {
                AsyncClient.getProfiles();
            },
            (err) => {
                this.setState({serverError: err.message});
            }
        );
    }
    handleMakeAdmin() {
        const data = {
            user_id: this.props.user.id,
            new_roles: 'admin'
        };

        Client.updateRoles(data,
            () => {
                AsyncClient.getProfiles();
            },
            (err) => {
                this.setState({serverError: err.message});
            }
        );
    }
    render() {
        let serverError = null;
        if (this.state.serverError) {
            serverError = (
                <div className='has-error'>
                    <label className='has-error control-label'>{this.state.serverError}</label>
                </div>
            );
        }

        const user = this.props.user;
        let currentRoles = 'Member';
        const timestamp = UserStore.getCurrentUser().update_at;

        if (user.roles.length > 0) {
            if (user.roles.indexOf('system_admin') > -1) {
                currentRoles = 'System Admin';
            } else {
                currentRoles = user.roles.charAt(0).toUpperCase() + user.roles.slice(1);
            }
        }

        const email = user.email;
        let showMakeMember = user.roles === 'admin' || user.roles === 'system_admin';
        let showMakeAdmin = user.roles === '' || user.roles === 'system_admin';
        let showMakeActive = false;
        let showMakeNotActive = user.roles !== 'system_admin';

        if (user.delete_at > 0) {
            currentRoles = 'Inactive';
            showMakeMember = false;
            showMakeAdmin = false;
            showMakeActive = true;
            showMakeNotActive = false;
        }

        let makeAdmin = null;
        if (showMakeAdmin) {
            makeAdmin = (
                <li role='presentation'>
                    <a
                        role='menuitem'
                        href='#'
                        onClick={this.handleMakeAdmin}
                    >
                        {'Make Admin'}
                    </a>
                </li>
            );
        }

        let makeMember = null;
        if (showMakeMember) {
            makeMember = (
                <li role='presentation'>
                    <a
                        role='menuitem'
                        href='#'
                        onClick={this.handleMakeMember}
                    >
                        {'Make Member'}
                    </a>
                </li>
            );
        }

        let makeActive = null;
        if (showMakeActive) {
            makeActive = (
                <li role='presentation'>
                    <a
                        role='menuitem'
                        href='#'
                        onClick={this.handleMakeActive}
                    >
                        {'Make Active'}
                    </a>
                </li>
            );
        }

        let makeNotActive = null;
        if (showMakeNotActive) {
            makeNotActive = (
                <li role='presentation'>
                    <a
                        role='menuitem'
                        href='#'
                        onClick={this.handleMakeNotActive}
                    >
                        {'Make Inactive'}
                    </a>
                </li>
            );
        }

        return (
            <div className='row member-div'>
                <img
                    className='post-profile-img pull-left'
                    src={`/api/v1/users/${user.id}/image?time=${timestamp}`}
                    height='36'
                    width='36'
                />
                <span className='member-name'>{Utils.getDisplayName(user)}</span>
                <span className='member-email'>{email}</span>
                <div className='dropdown member-drop'>
                    <a
                        href='#'
                        className='dropdown-toggle theme'
                        type='button'
                        id='channel_header_dropdown'
                        data-toggle='dropdown'
                        aria-expanded='true'
                    >
                        <span>{currentRoles} </span>
                        <span className='caret'></span>
                    </a>
                    <ul
                        className='dropdown-menu member-menu'
                        role='menu'
                        aria-labelledby='channel_header_dropdown'
                    >
                        {makeAdmin}
                        {makeMember}
                        {makeActive}
                        {makeNotActive}
                    </ul>
                </div>
                {serverError}
            </div>
        );
    }
}

MemberListTeamItem.propTypes = {
    user: React.PropTypes.object.isRequired
};
