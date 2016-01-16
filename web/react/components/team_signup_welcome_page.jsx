// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages, FormattedHTMLMessage} from 'react-intl';
import * as Utils from '../utils/utils.jsx';
import * as Client from '../utils/client.jsx';
import BrowserStore from '../stores/browser_store.jsx';

const messages = defineMessages({
    storageError: {
        id: 'team_signup_welcome.storageError',
        defaultMessage: 'This service requires local storage to be enabled. Please enable it or exit private browsing.'
    },
    emailError1: {
        id: 'team_signup_welcome.emailError1',
        defaultMessage: 'Please enter a valid email address'
    },
    emailError2: {
        id: 'team_signup_welcome.emailError2',
        defaultMessage: 'This service requires local storage to be enabled. Please enable it or exit private browsing.'
    },
    welcome: {
        id: 'team_signup_welcome.welcome',
        defaultMessage: 'Welcome to:'
    },
    lets: {
        id: 'team_signup_welcome.lets',
        defaultMessage: "Let's set up your new team"
    },
    confirm: {
        id: 'team_signup_welcome.confirm',
        defaultMessage: 'Please confirm your email address:'
    },
    admin: {
        id: 'team_signup_welcome.admin',
        defaultMessage: 'Your account will administer the new team site. <br />You can add other administrators later.'
    },
    yes: {
        id: 'team_signup_welcome.yes',
        defaultMessage: 'Yes, this address is correct'
    },
    address: {
        id: 'team_signup_welcome.address',
        defaultMessage: 'Email Address'
    },
    instead: {
        id: 'team_signup_welcome.instead',
        defaultMessage: 'Use this instead'
    },
    different: {
        id: 'team_signup_welcome.different',
        defaultMessage: 'Use a different email'
    }
});

class TeamSignupWelcomePage extends React.Component {
    constructor(props) {
        super(props);

        this.submitNext = this.submitNext.bind(this);
        this.handleDiffEmail = this.handleDiffEmail.bind(this);
        this.handleDiffSubmit = this.handleDiffSubmit.bind(this);
        this.handleKeyPress = this.handleKeyPress.bind(this);

        this.state = {useDiff: false};

        document.addEventListener('keyup', this.handleKeyPress, false);
    }
    submitNext(e) {
        const {formatMessage} = this.props.intl;
        if (!BrowserStore.isLocalStorageSupported()) {
            this.setState({storageError: formatMessage(messages.storageError)});
            return;
        }
        e.preventDefault();
        this.props.state.wizard = 'team_display_name';
        this.props.updateParent(this.props.state);
    }
    handleDiffEmail(e) {
        e.preventDefault();
        this.setState({useDiff: true});
    }
    handleDiffSubmit(e) {
        e.preventDefault();

        const {formatMessage} = this.props.intl;
        var state = {useDiff: true, serverError: ''};

        var email = ReactDOM.findDOMNode(this.refs.email).value.trim().toLowerCase();
        if (!email || !Utils.isEmail(email)) {
            state.emailError = formatMessage(messages.emailError1);
            this.setState(state);
            return;
        } else if (!BrowserStore.isLocalStorageSupported()) {
            state.emailError = formatMessage(messages.emailError2);
            this.setState(state);
            return;
        }
        state.emailError = '';

        Client.signupTeam(email,
            function success(data) {
                if (data.follow_link) {
                    window.location.href = data.follow_link;
                } else {
                    this.props.state.wizard = 'finished';
                    this.props.updateParent(this.props.state);
                    window.location.href = '/signup_team_confirm/?email=' + encodeURIComponent(email);
                }
            }.bind(this),
            function error(err) {
                this.setState({serverError: err.message});
            }.bind(this)
        );
    }
    handleKeyPress(event) {
        if (event.keyCode === 13) {
            this.submitNext(event);
        }
    }
    componentWillUnmount() {
        document.removeEventListener('keyup', this.handleKeyPress, false);
    }
    render() {
        Client.track('signup', 'signup_team_01_welcome');

        const {formatMessage} = this.props.intl;
        var storageError = null;
        if (this.state.storageError) {
            storageError = <label className='control-label'>{this.state.storageError}</label>;
        }

        var emailError = null;
        var emailDivClass = 'form-group';
        if (this.state.emailError) {
            emailError = <label className='control-label'>{this.state.emailError}</label>;
            emailDivClass += ' has-error';
        }

        var serverError = null;
        if (this.state.serverError) {
            serverError = (
                <div className='form-group has-error'>
                    <label className='control-label'>{this.state.serverError}</label>
                </div>
            );
        }

        var differentEmailLinkClass = '';
        var emailDivContainerClass = 'hidden';
        if (this.state.useDiff) {
            differentEmailLinkClass = 'hidden';
            emailDivContainerClass = '';
        }

        return (
            <div>
                <img
                    className='signup-team-logo'
                    src='/static/images/logo.png'
                />
                <h3 className='sub-heading'>{formatMessage(messages.welcome)}</h3>
                <h1 className='margin--top-none'>{global.window.mm_config.SiteName}</h1>
                <p className='margin--less'>{formatMessage(messages.lets)}</p>
                <div>
                    {formatMessage(messages.confirm)}<br />
                    <div className='inner__content'>
                        <div className='block--gray'>{this.props.state.team.email}</div>
                    </div>
                </div>
                <p className='margin--extra color--light'>
                    <FormattedHTMLMessage id='team_signup_welcome.admin' />
                </p>
                <div className='form-group'>
                    <button
                        className='btn-primary btn form-group'
                        type='submit'
                        onClick={this.submitNext}
                    >
                        <i className='glyphicon glyphicon-ok'></i>
                        {formatMessage(messages.yes)}
                    </button>
                    {storageError}
                </div>
                <hr />
                <div className={emailDivContainerClass}>
                    <div className={emailDivClass}>
                        <div className='row'>
                            <div className='col-sm-9'>
                                <input
                                    type='email'
                                    ref='email'
                                    className='form-control'
                                    placeholder={formatMessage(messages.address)}
                                    maxLength='128'
                                    spellCheck='false'
                                />
                            </div>
                        </div>
                        {emailError}
                    </div>
                    {serverError}
                    <button
                        className='btn btn-md btn-primary'
                        type='button'
                        onClick={this.handleDiffSubmit}
                    >
                        {formatMessage(messages.instead)}
                    </button>
                </div>
                <a
                    href='#'
                    onClick={this.handleDiffEmail}
                    className={differentEmailLinkClass}
                >
                    {formatMessage(messages.different)}
                </a>
            </div>
        );
    }
}

TeamSignupWelcomePage.defaultProps = {
    state: {}
};
TeamSignupWelcomePage.propTypes = {
    intl: intlShape.isRequired,
    updateParent: React.PropTypes.func.isRequired,
    state: React.PropTypes.object
};

export default injectIntl(TeamSignupWelcomePage);