// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from '../utils/utils.jsx';
import * as Client from '../utils/client.jsx';
import BrowserStore from '../stores/browser_store.jsx';

export default class TeamSignupWelcomePage extends React.Component {
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
        if (!BrowserStore.isLocalStorageSupported()) {
            this.setState({storageError: 'This service requires local storage to be enabled. Please enable it or exit private browsing.'});
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

        var state = {useDiff: true, serverError: ''};

        var email = ReactDOM.findDOMNode(this.refs.email).value.trim().toLowerCase();
        if (!email || !Utils.isEmail(email)) {
            state.emailError = 'Please enter a valid email address';
            this.setState(state);
            return;
        } else if (!BrowserStore.isLocalStorageSupported()) {
            state.emailError = 'This service requires local storage to be enabled. Please enable it or exit private browsing.';
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
                let errorMsg = err.message;

                if (err.detailed_error.indexOf('Invalid RCPT TO address provided') >= 0) {
                    errorMsg = 'Please enter a valid email address';
                }

                this.setState({emailError: '', serverError: errorMsg});
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
                <h3 className='sub-heading'>Welcome to:</h3>
                <h1 className='margin--top-none'>{global.window.mm_config.SiteName}</h1>
                <p className='margin--less'>Let's set up your new team</p>
                <div>
                    Please confirm your email address:<br />
                    <div className='inner__content'>
                        <div className='block--gray'>{this.props.state.team.email}</div>
                    </div>
                </div>
                <p className='margin--extra color--light'>
                    Your account will administer the new team site. <br />
                    You can add other administrators later.
                </p>
                <div className='form-group'>
                    <button
                        className='btn-primary btn form-group'
                        type='submit'
                        onClick={this.submitNext}
                    >
                        <i className='glyphicon glyphicon-ok'></i>
                        Yes, this address is correct
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
                                    placeholder='Email Address'
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
                        Use this instead
                    </button>
                </div>
                <a
                    href='#'
                    onClick={this.handleDiffEmail}
                    className={differentEmailLinkClass}
                >
                    Use a different email
                </a>
            </div>
        );
    }
}

TeamSignupWelcomePage.defaultProps = {
    state: {}
};
TeamSignupWelcomePage.propTypes = {
    updateParent: React.PropTypes.func.isRequired,
    state: React.PropTypes.object
};
