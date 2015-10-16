// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var utils = require('../utils/utils.jsx');
var Client = require('../utils/client.jsx');
var UserStore = require('../stores/user_store.jsx');
var ConfirmModal = require('./confirm_modal.jsx');

export default class InviteMemberModal extends React.Component {
    constructor(props) {
        super(props);

        this.handleSubmit = this.handleSubmit.bind(this);
        this.addInviteFields = this.addInviteFields.bind(this);
        this.clearFields = this.clearFields.bind(this);
        this.removeInviteFields = this.removeInviteFields.bind(this);

        this.state = {
            inviteIds: [0],
            idCount: 0,
            emailErrors: {},
            firstNameErrors: {},
            lastNameErrors: {},
            emailEnabled: global.window.mm_config.SendEmailNotifications === 'true'
        };
    }

    componentDidMount() {
        var self = this;
        $('#invite_member').on('hide.bs.modal', function hide(e) {
            if ($('#invite_member').attr('data-confirm') === 'true') {
                $('#invite_member').attr('data-confirm', 'false');
                return;
            }

            var notEmpty = false;
            for (var i = 0; i < self.state.inviteIds.length; i++) {
                var index = self.state.inviteIds[i];
                if (ReactDOM.findDOMNode(self.refs['email' + index]).value.trim() !== '') {
                    notEmpty = true;
                    break;
                }
            }

            if (notEmpty) {
                $('#confirm_invite_modal').modal('show');
                e.preventDefault();
            }
        });

        $('#invite_member').on('hidden.bs.modal', function show() {
            self.clearFields();
        });
    }

    handleSubmit() {
        if (!this.state.emailEnabled) {
            return;
        }

        var inviteIds = this.state.inviteIds;
        var count = inviteIds.length;
        var invites = [];
        var emailErrors = this.state.emailErrors;
        var firstNameErrors = this.state.firstNameErrors;
        var lastNameErrors = this.state.lastNameErrors;
        var valid = true;

        for (var i = 0; i < count; i++) {
            var index = inviteIds[i];
            var invite = {};
            invite.email = ReactDOM.findDOMNode(this.refs['email' + index]).value.trim();
            if (!invite.email || !utils.isEmail(invite.email)) {
                emailErrors[index] = 'Please enter a valid email address';
                valid = false;
            } else {
                emailErrors[index] = '';
            }

            invite.firstName = ReactDOM.findDOMNode(this.refs['first_name' + index]).value.trim();

            invite.lastName = ReactDOM.findDOMNode(this.refs['last_name' + index]).value.trim();

            invites.push(invite);
        }

        this.setState({emailErrors: emailErrors, firstNameErrors: firstNameErrors, lastNameErrors: lastNameErrors});

        if (!valid || invites.length === 0) {
            return;
        }

        var data = {};
        data.invites = invites;

        Client.inviteMembers(data,
            function success() {
                $(ReactDOM.findDOMNode(this.refs.modal)).attr('data-confirm', 'true');
                $(ReactDOM.findDOMNode(this.refs.modal)).modal('hide');
            }.bind(this),
            function fail(err) {
                if (err.message === 'This person is already on your team') {
                    emailErrors[err.detailed_error] = err.message;
                    this.setState({emailErrors: emailErrors});
                } else {
                    this.setState({serverError: err.message});
                }
            }.bind(this)
        );
    }

    componentDidUpdate() {
        $(ReactDOM.findDOMNode(this.refs.modalBody)).css('max-height', $(window).height() - 200);
        $(ReactDOM.findDOMNode(this.refs.modalBody)).css('overflow-y', 'scroll');
    }

    addInviteFields() {
        var count = this.state.idCount + 1;
        var inviteIds = this.state.inviteIds;
        inviteIds.push(count);
        this.setState({inviteIds: inviteIds, idCount: count});
    }

    clearFields() {
        var inviteIds = this.state.inviteIds;

        for (var i = 0; i < inviteIds.length; i++) {
            var index = inviteIds[i];
            ReactDOM.findDOMNode(this.refs['email' + index]).value = '';
            ReactDOM.findDOMNode(this.refs['first_name' + index]).value = '';
            ReactDOM.findDOMNode(this.refs['last_name' + index]).value = '';
        }

        this.setState({
            inviteIds: [0],
            idCount: 0,
            emailErrors: {},
            firstNameErrors: {},
            lastNameErrors: {}
        });
    }

    removeInviteFields(index) {
        var count = this.state.idCount;
        var inviteIds = this.state.inviteIds;
        var i = inviteIds.indexOf(index);
        if (i > -1) {
            inviteIds.splice(i, 1);
        }
        if (!inviteIds.length) {
            inviteIds.push(++count);
        }
        this.setState({inviteIds: inviteIds, idCount: count});
    }

    render() {
        var currentUser = UserStore.getCurrentUser();

        if (currentUser != null) {
            var inviteSections = [];
            var inviteIds = this.state.inviteIds;
            for (var i = 0; i < inviteIds.length; i++) {
                var index = inviteIds[i];
                var emailError = null;
                if (this.state.emailErrors[index]) {
                    emailError = <label className='control-label'>{this.state.emailErrors[index]}</label>;
                }
                var firstNameError = null;
                if (this.state.firstNameErrors[index]) {
                    firstNameError = <label className='control-label'>{this.state.firstNameErrors[index]}</label>;
                }
                var lastNameError = null;
                if (this.state.lastNameErrors[index]) {
                    lastNameError = <label className='control-label'>{this.state.lastNameErrors[index]}</label>;
                }

                var removeButton = null;
                if (index) {
                    removeButton = (<div>
                                        <button
                                            type='button'
                                            className='btn btn-link remove__member'
                                            onClick={this.removeInviteFields.bind(this, index)}
                                        >
                                            <span className='fa fa-trash'></span>
                                        </button>
                                    </div>);
                }
                var emailClass = 'form-group invite';
                if (emailError) {
                    emailClass += ' has-error';
                }

                var nameFields = null;

                var firstNameClass = 'form-group';
                if (firstNameError) {
                    firstNameClass += ' has-error';
                }
                var lastNameClass = 'form-group';
                if (lastNameError) {
                    lastNameClass += ' has-error';
                }
                nameFields = (<div className='row--invite'>
                                <div className='col-sm-6'>
                                    <div className={firstNameClass}>
                                        <input
                                            type='text'
                                            className='form-control'
                                            ref={'first_name' + index}
                                            placeholder='First name'
                                            maxLength='64'
                                            disabled={!this.state.emailEnabled}
                                            spellCheck='false'
                                        />
                                        {firstNameError}
                                    </div>
                                </div>
                                <div className='col-sm-6'>
                                    <div className={lastNameClass}>
                                        <input
                                            type='text'
                                            className='form-control'
                                            ref={'last_name' + index}
                                            placeholder='Last name'
                                            maxLength='64'
                                            disabled={!this.state.emailEnabled}
                                            spellCheck='false'
                                        />
                                        {lastNameError}
                                    </div>
                                </div>
                            </div>);

                inviteSections[index] = (
                    <div key={'key' + index}>
                    {removeButton}
                    <div className={emailClass}>
                        <input
                            onKeyUp={this.displayNameKeyUp}
                            type='text'
                            ref={'email' + index}
                            className='form-control'
                            placeholder='email@domain.com'
                            maxLength='64'
                            disabled={!this.state.emailEnabled}
                            spellCheck='false'
                        />
                        {emailError}
                    </div>
                    {nameFields}
                    </div>
                );
            }

            var serverError = null;
            if (this.state.serverError) {
                serverError = <div className='form-group has-error'><label className='control-label'>{this.state.serverError}</label></div>;
            }

            var content = null;
            var sendButton = null;
            if (this.state.emailEnabled) {
                content = (
                    <div>
                        {serverError}
                        <button
                            type='button'
                            className='btn btn-default'
                            onClick={this.addInviteFields}
                        >Add another</button>
                        <br/>
                        <br/>
                        <span>People invited automatically join Town Square channel.</span>
                    </div>
                );

                sendButton =
                    (
                        <button
                            onClick={this.handleSubmit}
                            type='button'
                            className='btn btn-primary'
                        >Send Invitations</button>
                    );
            } else {
                var teamInviteLink = null;
                if (currentUser && this.props.teamType === 'O') {
                    var linkUrl = utils.getWindowLocationOrigin() + '/signup_user_complete/?id=' + currentUser.team_id;
                    var link =
                        (
                            <a
                                href='#'
                                data-toggle='modal'
                                data-target='#get_link'
                                data-title='Team Invite'
                                data-value={linkUrl}
                                onClick={
                                    function click() {
                                        $('#invite_member').modal('hide');
                                    }
                                }
                            >Team Invite Link</a>
                    );

                    teamInviteLink = (
                        <p>
                            You can also invite people using the {link}.
                        </p>
                    );
                }

                content = (
                    <div>
                        <p>Email is currently disabled for your team, and email invitations cannot be sent. Contact your system administrator to enable email and email invitations.</p>
                        {teamInviteLink}
                    </div>
                );
            }

            return (
                <div>
                    <div
                        className='modal fade'
                        ref='modal'
                        id='invite_member'
                        tabIndex='-1'
                        role='dialog'
                        aria-hidden='true'
                    >
                       <div className='modal-dialog'>
                          <div className='modal-content'>
                            <div className='modal-header'>
                            <button
                                type='button'
                                className='close'
                                data-dismiss='modal'
                                aria-label='Close'
                            >
                                <span aria-hidden='true'>×</span>
                            </button>
                            <h4
                                className='modal-title'
                                id='myModalLabel'
                            >Invite New Member</h4>
                            </div>
                            <div
                                ref='modalBody'
                                className='modal-body'
                            >
                                <form role='form'>
                                    {inviteSections}
                                </form>
                                {content}
                            </div>
                            <div className='modal-footer'>
                                <button
                                    type='button'
                                    className='btn btn-default'
                                    data-dismiss='modal'
                                >Cancel</button>
                                {sendButton}
                            </div>
                          </div>
                       </div>
                    </div>
                    <ConfirmModal
                        id='confirm_invite_modal'
                        parent_id='invite_member'
                        title='Discard Invitations?'
                        message='You have unsent invitations, are you sure you want to discard them?'
                        confirm_button='Yes, Discard'
                    />
                </div>
            );
        }
        return <div/>;
    }
}

InviteMemberModal.propTypes = {
    teamType: React.PropTypes.string
};
