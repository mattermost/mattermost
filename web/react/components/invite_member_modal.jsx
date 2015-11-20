// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as utils from '../utils/utils.jsx';
import Constants from '../utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;
import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import * as Client from '../utils/client.jsx';
import ModalStore from '../stores/modal_store.jsx';
import UserStore from '../stores/user_store.jsx';
import TeamStore from '../stores/team_store.jsx';
import ConfirmModal from './confirm_modal.jsx';

const Modal = ReactBootstrap.Modal;

export default class InviteMemberModal extends React.Component {
    constructor(props) {
        super(props);

        this.handleToggle = this.handleToggle.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleHide = this.handleHide.bind(this);
        this.addInviteFields = this.addInviteFields.bind(this);
        this.clearFields = this.clearFields.bind(this);
        this.removeInviteFields = this.removeInviteFields.bind(this);

        this.state = {
            show: false,
            inviteIds: [0],
            idCount: 0,
            emailErrors: {},
            firstNameErrors: {},
            lastNameErrors: {},
            emailEnabled: global.window.mm_config.SendEmailNotifications === 'true',
            showConfirmModal: false,
            isSendingEmails: false
        };
    }

    componentDidMount() {
        ModalStore.addModalListener(ActionTypes.TOGGLE_INVITE_MEMBER_MODAL, this.handleToggle);
    }

    componentWillUnmount() {
        ModalStore.removeModalListener(ActionTypes.TOGGLE_INVITE_MEMBER_MODAL, this.handleToggle);
    }

    handleToggle(value) {
        this.setState({
            show: value
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

        this.setState({isSendingEmails: true});

        Client.inviteMembers(
            data,
            () => {
                this.handleHide(false);
                this.setState({isSendingEmails: false});
            },
            (err) => {
                if (err.message === 'This person is already on your team') {
                    emailErrors[err.detailed_error] = err.message;
                    this.setState({emailErrors: emailErrors});
                } else {
                    this.setState({serverError: err.message});
                }

                this.setState({isSendingEmails: false});
            }
        );
    }

    handleHide(requireConfirm) {
        if (requireConfirm) {
            var notEmpty = false;
            for (var i = 0; i < this.state.inviteIds.length; i++) {
                var index = this.state.inviteIds[i];
                if (ReactDOM.findDOMNode(this.refs['email' + index]).value.trim() !== '') {
                    notEmpty = true;
                    break;
                }
            }

            if (notEmpty) {
                this.setState({
                    showConfirmModal: true
                });

                return;
            }
        }

        this.clearFields();

        this.setState({
            show: false,
            showConfirmModal: false
        });
    }

    componentDidUpdate(prevProps, prevState) {
        if (!prevState.show && this.state.show) {
            $(ReactDOM.findDOMNode(this.refs.modalBody)).css('max-height', $(window).height() - 300);
            if ($(window).width() > 768) {
                $(ReactDOM.findDOMNode(this.refs.modalBody)).perfectScrollbar();
            }
        }
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

                var sendButtonLabel = 'Send Invitation';
                if (this.state.isSendingEmails) {
                    sendButtonLabel = (
                        <span><i className='fa fa-spinner fa-spin' />{' Sending'}</span>
                    );
                } else if (this.state.inviteIds.length > 1) {
                    sendButtonLabel = 'Send Invitations';
                }

                sendButton = (
                    <button
                        onClick={this.handleSubmit}
                        type='button'
                        className='btn btn-primary'
                        disabled={this.state.isSendingEmails}
                    >
                        {sendButtonLabel}
                    </button>
                );
            } else {
                var teamInviteLink = null;
                if (currentUser && TeamStore.getCurrent().type === 'O') {
                    var linkUrl = utils.getWindowLocationOrigin() + '/signup_user_complete/?id=' + TeamStore.getCurrent().invite_id;
                    var link =
                        (
                            <a
                                href='#'
                                data-toggle='modal'
                                data-target='#get_link'
                                data-title='Team Invite'
                                data-value={linkUrl}
                                onClick={() => this.handleHide(this, false)}
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
                    <Modal
                        dialogClassName='modal-invite-member'
                        show={this.state.show}
                        onHide={this.handleHide.bind(this, true)}
                        enforceFocus={!this.state.showConfirmModal}
                        backdrop={this.state.isSendingEmails ? 'static' : true}
                    >
                        <Modal.Header closeButton={!this.state.isSendingEmails}>
                            <Modal.Title>{'Invite New Member'}</Modal.Title>
                        </Modal.Header>
                        <Modal.Body ref='modalBody'>
                            <form role='form'>
                                {inviteSections}
                            </form>
                            {content}
                        </Modal.Body>
                        <Modal.Footer>
                            <button
                                type='button'
                                className='btn btn-default'
                                onClick={this.handleHide.bind(this, true)}
                                disabled={this.state.isSendingEmails}
                            >
                                {'Cancel'}
                            </button>
                            {sendButton}
                        </Modal.Footer>
                    </Modal>
                    <ConfirmModal
                        title='Discard Invitations?'
                        message='You have unsent invitations, are you sure you want to discard them?'
                        confirm_button='Yes, Discard'
                        show={this.state.showConfirmModal}
                        onConfirm={this.handleHide.bind(this, false)}
                        onCancel={() => this.setState({showConfirmModal: false})}
                    />
                </div>
            );
        }

        return null;
    }

    static show() {
        AppDispatcher.handleViewAction({
            type: ActionTypes.TOGGLE_INVITE_MEMBER_MODAL,
            value: true
        });
    }
}

InviteMemberModal.propTypes = {
};
