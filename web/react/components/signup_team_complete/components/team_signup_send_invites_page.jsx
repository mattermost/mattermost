// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import EmailItem from './team_signup_email_item.jsx';
import * as Client from '../../../utils/client.jsx';

import {FormattedMessage, FormattedHTMLMessage} from 'mm-intl';

export default class TeamSignupSendInvitesPage extends React.Component {
    constructor(props) {
        super(props);
        this.submitBack = this.submitBack.bind(this);
        this.submitNext = this.submitNext.bind(this);
        this.submitAddInvite = this.submitAddInvite.bind(this);
        this.submitSkip = this.submitSkip.bind(this);
        this.keySubmit = this.keySubmit.bind(this);
        this.state = {
            emailEnabled: global.window.mm_config.SendEmailNotifications === 'true'
        };
    }
    submitBack(e) {
        e.preventDefault();
        this.props.state.wizard = 'team_url';

        this.props.updateParent(this.props.state);
    }
    submitNext(e) {
        e.preventDefault();

        var valid = true;

        if (this.state.emailEnabled) {
            var emails = [];

            for (var i = 0; i < this.props.state.invites.length; i++) {
                if (this.refs['email_' + i].getWrappedInstance().validate(this.props.state.team.email)) {
                    emails.push(this.refs['email_' + i].getWrappedInstance().getValue());
                } else {
                    valid = false;
                }
            }

            if (valid) {
                this.props.state.invites = emails;
            }
        }

        if (valid) {
            this.props.state.wizard = 'username';
            this.props.updateParent(this.props.state);
        }
    }
    submitAddInvite(e) {
        e.preventDefault();
        this.props.state.wizard = 'send_invites';
        if (!this.props.state.invites) {
            this.props.state.invites = [];
        }
        this.props.state.invites.push('');
        this.props.updateParent(this.props.state);
    }
    submitSkip(e) {
        e.preventDefault();
        this.props.state.wizard = 'username';
        this.props.updateParent(this.props.state);
    }
    keySubmit(e) {
        if (e && e.keyCode === 13) {
            this.submitNext(e);
        }
    }
    componentDidMount() {
        if (!this.state.emailEnabled) {
            // Must use keypress not keyup due to event chain of pressing enter
            $('body').keypress(this.keySubmit);
        }
    }
    componentWillUnmount() {
        if (!this.state.emailEnabled) {
            $('body').off('keypress', this.keySubmit);
        }
    }
    render() {
        Client.track('signup', 'signup_team_05_send_invites');

        var content = null;
        var bottomContent = null;

        if (this.state.emailEnabled) {
            var emails = [];

            for (var i = 0; i < this.props.state.invites.length; i++) {
                if (i === 0) {
                    emails.push(
                        <EmailItem
                            focus={true}
                            key={i}
                            ref={'email_' + i}
                            email={this.props.state.invites[i]}
                        />
                    );
                } else {
                    emails.push(
                        <EmailItem
                            focus={false}
                            key={i}
                            ref={'email_' + i}
                            email={this.props.state.invites[i]}
                        />
                    );
                }
            }

            content = (
                <div>
                    {emails}
                    <div className='form-group text-right'>
                        <a
                            href='#'
                            onClick={this.submitAddInvite}
                        >
                            <FormattedMessage
                                id='team_signup_send_invites.addInvitation'
                                defaultMessage='Add Invitation'
                            />
                        </a>
                    </div>
                </div>
            );

            bottomContent = (
                <p className='color--light'>
                    <FormattedHTMLMessage
                        id='team_signup_send_invites.prefer'
                        defaultMessage='if you prefer, you can invite team members later<br /> and '
                    />
                    <a
                        href='#'
                        onClick={this.submitSkip}
                    >
                        <FormattedMessage
                            id='team_signup_send_invites.skip'
                            defaultMessage='skip this step '
                        />
                    </a>
                    <FormattedMessage
                        id='team_signup_send_invites.forNow'
                        defaultMessage='for now.'
                    />
                </p>
            );
        } else {
            content = (
                <div className='form-group color--light'>
                    <FormattedMessage
                        id='team_signup_send_invites.disabled'
                        defaultMessage='Email is currently disabled for your team, and emails cannot be sent. Contact your system administrator to enable email and email invitations.'
                    />
                </div>
            );
        }

        return (
            <div>
                <form>
                    <img
                        className='signup-team-logo'
                        src='/static/images/logo.png'
                    />
                    <h2>
                        <FormattedMessage
                            id='team_signup_send_invites.title'
                            defaultMessage='Invite Team Members'
                        />
                    </h2>
                    {content}
                    <div className='form-group'>
                        <button
                            type='submit'
                            className='btn-primary btn'
                            onClick={this.submitNext}
                        >
                            <FormattedMessage
                                id='team_signup_send_invites.next'
                                defaultMessage='Next'
                            /><i className='glyphicon glyphicon-chevron-right'/>
                        </button>
                    </div>
                </form>
                {bottomContent}
                <div className='margin--extra'>
                    <a
                        href='#'
                        onClick={this.submitBack}
                    >
                        <FormattedMessage
                            id='team_signup_send_invites.back'
                            defaultMessage='Back to previous step'
                        />
                    </a>
                </div>
            </div>
        );
    }
}

TeamSignupSendInvitesPage.propTypes = {
    state: React.PropTypes.object.isRequired,
    updateParent: React.PropTypes.func.isRequired
};
