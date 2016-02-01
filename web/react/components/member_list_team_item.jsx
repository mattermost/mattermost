// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import UserStore from '../stores/user_store.jsx';
import * as Client from '../utils/client.jsx';
import * as AsyncClient from '../utils/async_client.jsx';
import * as Utils from '../utils/utils.jsx';

import {FormattedMessage} from 'mm-intl';

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
        let currentRoles = (
            <FormattedMessage
                id='member_team_item.member'
                defaultMessage='Member'
            />
        );
        const timestamp = UserStore.getCurrentUser().update_at;

        if (user.roles.length > 0) {
            if (Utils.isSystemAdmin(user.roles)) {
                currentRoles = (
                    <FormattedMessage
                        id='member_team_item.systemAdmin'
                        defaultMessage='System Admin'
                    />
                );
            } else if (Utils.isAdmin(user.roles)) {
                currentRoles = (
                    <FormattedMessage
                        id='member_team_item.teamAdmin'
                        defaultMessage='Team Admin'
                    />
                );
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
            currentRoles = (
                <FormattedMessage
                    id='member_team_item.inactive'
                    defaultMessage='Inactive'
                />
            );
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
                        <FormattedMessage
                            id='member_team_item.makeAdmin'
                            defaultMessage='Make Team Admin'
                        />
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
                        <FormattedMessage
                            id='member_team_item.makeMember'
                            defaultMessage='Make Member'
                        />
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
                        <FormattedMessage
                            id='member_team_item.makeActive'
                            defaultMessage='Make Active'
                        />
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
                        <FormattedMessage
                            id='member_team_item.makeInactive'
                            defaultMessage='Make Inactive'
                        />
                    </a>
                </li>
            );
        }

        return (
            <tr>
                <td className='row member-div'>
                    <img
                        className='post-profile-img pull-left'
                        src={`/api/v1/users/${user.id}/image?time=${timestamp}&${Utils.getSessionIndex()}`}
                        height='36'
                        width='36'
                    />
                    <span className='member-name'>{Utils.displayUsername(user.id)}</span>
                    <span className='member-email'>{email}</span>
                    <div className='dropdown member-drop'>
                        <a
                            href='#'
                            className='dropdown-toggle theme'
                            type='button'
                            data-toggle='dropdown'
                            aria-expanded='true'
                        >
                            <span className='fa fa-pencil'></span>
                            <span>{currentRoles} </span>
                        </a>
                        <ul
                            className='dropdown-menu member-menu'
                            role='menu'
                        >
                            {makeAdmin}
                            {makeMember}
                            {makeActive}
                            {makeNotActive}
                        </ul>
                    </div>
                    {serverError}
                </td>
            </tr>
        );
    }
}

MemberListTeamItem.propTypes = {
    user: React.PropTypes.object.isRequired
};
