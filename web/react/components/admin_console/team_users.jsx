// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var Client = require('../../utils/client.jsx');
var LoadingScreen = require('../loading_screen.jsx');
var UserItem = require('./user_item.jsx');
var ResetPasswordModal = require('./reset_password_modal.jsx');

export default class UserList extends React.Component {
    constructor(props) {
        super(props);

        this.getTeamProfiles = this.getTeamProfiles.bind(this);
        this.getCurrentTeamProfiles = this.getCurrentTeamProfiles.bind(this);
        this.doPasswordReset = this.doPasswordReset.bind(this);
        this.doPasswordResetDismiss = this.doPasswordResetDismiss.bind(this);
        this.doPasswordResetSubmit = this.doPasswordResetSubmit.bind(this);

        this.state = {
            teamId: props.team.id,
            users: null,
            serverError: null,
            showPasswordModal: false,
            user: null
        };
    }

    componentDidMount() {
        this.getCurrentTeamProfiles();
    }

    getCurrentTeamProfiles() {
        this.getTeamProfiles(this.props.team.id);
    }

    // this.setState({
    //     teamId: this.state.teamId,
    //     users: this.state.users,
    //     serverError: this.state.serverError,
    //     showPasswordModal: this.state.showPasswordModal,
    //     user: this.state.user
    // });

    getTeamProfiles(teamId) {
        Client.getProfilesForTeam(
            teamId,
            (users) => {
                var memberList = [];
                for (var id in users) {
                    if (users.hasOwnProperty(id)) {
                        memberList.push(users[id]);
                    }
                }

                memberList.sort((a, b) => {
                    if (a.username < b.username) {
                        return -1;
                    }

                    if (a.username > b.username) {
                        return 1;
                    }

                    return 0;
                });

                this.setState({
                    teamId: this.state.teamId,
                    users: memberList,
                    serverError: this.state.serverError,
                    showPasswordModal: this.state.showPasswordModal,
                    user: this.state.user
                });
            },
            (err) => {
                this.setState({
                    teamId: this.state.teamId,
                    users: null,
                    serverError: err.message,
                    showPasswordModal: this.state.showPasswordModal,
                    user: this.state.user
                });
            }
        );
    }

    doPasswordReset(user) {
        this.setState({
            teamId: this.state.teamId,
            users: this.state.users,
            serverError: this.state.serverError,
            showPasswordModal: true,
            user
        });
    }

    doPasswordResetDismiss() {
        this.state.showPasswordModal = false;
        this.state.user = null;
        this.setState({
            teamId: this.state.teamId,
            users: this.state.users,
            serverError: this.state.serverError,
            showPasswordModal: false,
            user: null
        });
    }

    doPasswordResetSubmit() {
        this.setState({
            teamId: this.state.teamId,
            users: this.state.users,
            serverError: this.state.serverError,
            showPasswordModal: false,
            user: null
        });
    }

    componentWillReceiveProps(newProps) {
        this.getTeamProfiles(newProps.team.id);
    }

    componentWillUnmount() {
    }

    render() {
        var serverError = '';
        if (this.state.serverError) {
            serverError = <div className='form-group has-error'><label className='control-label'>{this.state.serverError}</label></div>;
        }

        if (this.state.users == null) {
            return (
                <div className='wrapper--fixed'>
                    <h3>{'Users for ' + this.props.team.name}</h3>
                    {serverError}
                    <LoadingScreen />
                </div>
            );
        }

        var memberList = this.state.users.map((user) => {
            return (
                <UserItem
                    key={'user_' + user.id}
                    user={user}
                    refreshProfiles={this.getCurrentTeamProfiles}
                    doPasswordReset={this.doPasswordReset}
                />);
        });

        return (
            <div className='wrapper--fixed'>
                <h3>{'Users for ' + this.props.team.name + ' (' + this.state.users.length + ')'}</h3>
                {serverError}
                <form
                    className='form-horizontal'
                    role='form'
                >
                    <div className='member-list-holder'>
                        {memberList}
                    </div>
                </form>
                <ResetPasswordModal
                    user={this.state.user}
                    show={this.state.showPasswordModal}
                    team={this.props.team}
                    onModalSubmit={this.doPasswordResetSubmit}
                    onModalDismissed={this.doPasswordResetDismiss}
                />
            </div>
        );
    }
}

UserList.propTypes = {
    team: React.PropTypes.object
};
