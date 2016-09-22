// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import SettingsView from 'components/settings_view.jsx';
import {Link} from 'react-router';

import {FormattedMessage} from 'react-intl';

import * as Utils from 'utils/utils.jsx';

export default class InviteMembersView extends React.Component {
    static get propTypes() {
        return {
            teamDisplayName: React.PropTypes.string.isRequired,
            titleText: React.PropTypes.node.isRequired,
            extraFields: React.PropTypes.node,
            handleSubmit: React.PropTypes.func.isRequired,
            closeLink: React.PropTypes.string,
            serverError: React.PropTypes.string,
            sendInvitesState: React.PropTypes.string.isRequired
        };
    }

    constructor(props) {
        super(props);

        this.renderInviteSections = this.renderInviteSections.bind(this);
        this.removeInviteField = this.removeInviteField.bind(this);
        this.addInviteField = this.addInviteField.bind(this);
        this.handleEmailChange = this.handleEmailChange.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);

        this.state = {
            numFields: 1,
            emails: [
                {email: '', error: null}
            ]
        };
    }

    removeInviteField(index) {
        const newEmails = this.state.emails.slice();
        newEmails.splice(index, 1);
        this.setState({
            numFields: this.state.numFields - 1,
            emails: newEmails
        });
    }

    addInviteField() {
        const newEmails = this.state.emails.slice();
        newEmails.push({email: '', error: null});
        this.setState({
            numFields: this.state.numFields + 1,
            emails: newEmails
        });
    }

    handleEmailChange(email, i) {
        const newEmails = this.state.emails.slice();
        newEmails[i] = {email, error: null};
        this.setState({emails: newEmails});
    }

    handleSubmit() {
        let hasError = false;
        const newEmails = this.state.emails.slice();
        const returnEmails = [];
        for (let i = 0; i < this.state.emails.length; i++) {
            const email = this.state.emails[i].email;
            if (Utils.isEmail(email)) {
                newEmails[i].error = null;
            } else {
                newEmails[i].error = (<FormattedMessage id='signup_user_completed.validEmail'/>);
                hasError = true;
            }
            returnEmails.push(email);
        }
        if (hasError) {
            this.setState({emails: newEmails});
        } else {
            this.props.handleSubmit(returnEmails);
        }
    }

    renderInviteSections() {
        const inviteSections = [];

        for (let i = 0; i < this.state.numFields; i++) {
            let removeButton = null;
            if (i !== 0) {
                removeButton = (
                    <div>
                        <button
                            type='button'
                            className='btn btn-link remove__member'
                            onClick={this.removeInviteField.bind(this, i)}
                        >
                            <span className='fa fa-trash'/>
                        </button>
                    </div>
                );
            }

            let emailError = null;
            let emailDivStyle = 'form-group invite';
            if (this.state.emails[i].error != null) {
                emailError = (<label className='control-label'>{this.state.emails[i].error}</label>);
                emailDivStyle += ' has-error';
            }

            inviteSections[i] = (
                <div
                    className='invite__fields'
                    key={'key' + i}
                >
                    {removeButton}
                    <div className={emailDivStyle}>
                        <input
                            type='email'
                            ref={'email' + i}
                            className='form-control'
                            placeholder='email@domain.com'
                            maxLength='128'
                            spellCheck='false'
                            autoCapitalize='off'
                            value={this.state.emails[i].email}
                            onChange={(e) => {
                                this.handleEmailChange(e.target.value.trim(), i);
                            }}
                        />
                        {emailError}
                    </div>
                </div>
            );
        }

        return inviteSections;
    }

    render() {
        let sendButtonLabel = (
            <FormattedMessage
                id='invite_member.send'
                defaultMessage='Send Invitation'
            />
        );
        if (this.props.sendInvitesState === 'sending') {
            sendButtonLabel = (
                <span>
                    <i className='fa fa-spinner fa-spin'/>
                    <FormattedMessage
                        id='invite_member.sending'
                        defaultMessage=' Sending'
                    />
                </span>
            );
        } else if (this.props.sendInvitesState === 'done') {
            sendButtonLabel = (
                <span>
                    <i className='fa fa-check'/>
                    <FormattedMessage
                        id='invite_member.done'
                        defaultMessage=' Close'
                    />
                </span>
            );
        }

        let sendButton = null;
        if (this.props.sendInvitesState === 'done') {
            sendButton = (
                <Link
                    to={this.props.closeLink}
                >
                    <button
                        type='button'
                        className='btn btn-primary invite-members-send-button'
                    >
                        {sendButtonLabel}
                    </button>
                </Link>
            );
        } else {
            sendButton = (
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        this.handleSubmit();
                    }}
                    type='button'
                    className='btn btn-primary invite-members-send-button'
                >
                    {sendButtonLabel}
                </button>
            );
        }

        const inviteSections = this.renderInviteSections();

        let serverError = null;
        if (this.props.serverError) {
            serverError = <div className='form-group has-error'><label className='control-label'>{this.props.serverError}</label></div>;
        }

        let doneMessage = null;
        if (this.props.sendInvitesState === 'done') {
            doneMessage = (
                <div className='form-group has-success'>
                    <label className='control-label'>
                        <FormattedMessage
                            id='invite_member.success'
                            defaultMessage='Members sucessfully invited.'
                        />
                    </label>
                </div>
            );
        }

        return (
            <SettingsView
                title={
                    <FormattedMessage
                        id='invite_users.title'
                        defaultMessage='Invite People to {team}'
                        values={{
                            team: this.props.teamDisplayName
                        }}
                    />
                }
                closeLink={this.props.closeLink}
            >
                {this.props.titleText}
                {this.props.extraFields}
                <br/>
                <form role='form'>
                    {inviteSections}
                    <hr/>
                    <button
                        type='button'
                        className='btn btn-default btn-add pull-left'
                        onClick={this.addInviteField}
                    >
                        <i className='fa fa-plus'/>
                        <FormattedMessage
                            id='invite_member.addAnother'
                            defaultMessage='Add another'
                        />
                    </button>
                </form>
                {serverError}
                {doneMessage}
                {sendButton}
            </SettingsView>
        );
    }
}
