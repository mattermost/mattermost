// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import * as Utils from '../utils/utils.jsx';
import * as Client from '../utils/client.jsx';

const messages = defineMessages({
    nameError1: {
        id: 'team_signup_username.nameError1',
        defaultMessage: 'This username is reserved, please choose a new one.'
    },
    nameError2: {
        id: 'team_signup_username.nameError2',
        defaultMessage: 'Username must begin with a letter, and contain 3 to 15 characters in total, which may be numbers, lowercase letters, or any of the symbols \'.\', \'-\', or \'_\''
    },
    username: {
        id: 'team_signup_username.username',
        defaultMessage: 'Your username'
    },
    memorable: {
        id: 'team_signup_username.memorable',
        defaultMessage: 'Select a memorable username that makes it easy for teammates to identify you:'
    },
    chooseUsername: {
        id: 'team_signup_username.chooseUsername',
        defaultMessage: 'Choose your username'
    },
    hint: {
        id: 'team_signup_username.hint',
        defaultMessage: "Usernames must begin with a letter and contain 3 to 15 characters made up of lowercase letters, numbers, and the symbols '.', '-' and '_'"
    },
    next: {
        id: 'team_signup_username.next',
        defaultMessage: 'Next'
    },
    back: {
        id: 'team_signup_username.back',
        defaultMessage: 'Back to previous step'
    }
});

class TeamSignupUsernamePage extends React.Component {
    constructor(props) {
        super(props);

        this.submitBack = this.submitBack.bind(this);
        this.submitNext = this.submitNext.bind(this);

        this.state = {};
    }
    submitBack(e) {
        e.preventDefault();
        if (global.window.mm_config.SendEmailNotifications === 'true') {
            this.props.state.wizard = 'send_invites';
        } else {
            this.props.state.wizard = 'team_url';
        }

        this.props.updateParent(this.props.state);
    }
    submitNext(e) {
        e.preventDefault();

        const {formatMessage} = this.props.intl;
        var name = ReactDOM.findDOMNode(this.refs.name).value.trim().toLowerCase();

        var usernameError = Utils.isValidUsername(name);
        if (usernameError === 'Cannot use a reserved word as a username.') {
            this.setState({nameError: formatMessage(messages.nameError1)});
            return;
        } else if (usernameError) {
            this.setState({nameError: formatMessage(messages.nameError2)});
            return;
        }

        this.props.state.wizard = 'password';
        this.props.state.user.username = name;
        this.props.updateParent(this.props.state);
    }
    render() {
        Client.track('signup', 'signup_team_06_username');

        const {formatMessage} = this.props.intl;
        var nameError = null;
        var nameDivClass = 'form-group';
        if (this.state.nameError) {
            nameError = <label className='control-label'>{this.state.nameError}</label>;
            nameDivClass += ' has-error';
        }

        return (
            <div>
                <form>
                    <img
                        className='signup-team-logo'
                        src='/static/images/logo.png'
                    />
                    <h2 className='margin--less'>{formatMessage(messages.username)}</h2>
                    <h5 className='color--light'>{formatMessage(messages.memorable)}</h5>
                    <div className='inner__content margin--extra'>
                        <div className={nameDivClass}>
                            <div className='row'>
                                <div className='col-sm-11'>
                                    <h5><strong>{formatMessage(messages.chooseUsername)}</strong></h5>
                                    <input
                                        autoFocus={true}
                                        type='text'
                                        ref='name'
                                        className='form-control'
                                        placeholder=''
                                        defaultValue={this.props.state.user.username}
                                        maxLength='128'
                                        spellCheck='false'
                                    />
                                    <span className='color--light help-block'>{formatMessage(messages.hint)}</span>
                                </div>
                            </div>
                            {nameError}
                        </div>
                    </div>
                    <button
                        type='submit'
                        className='btn btn-primary margin--extra'
                        onClick={this.submitNext}
                    >
                        {formatMessage(messages.next)}
                        <i className='glyphicon glyphicon-chevron-right'></i>
                    </button>
                    <div className='margin--extra'>
                        <a
                            href='#'
                            onClick={this.submitBack}
                        >
                            {formatMessage(messages.back)}
                        </a>
                    </div>
                </form>
            </div>
        );
    }
}

TeamSignupUsernamePage.defaultProps = {
    state: null
};
TeamSignupUsernamePage.propTypes = {
    intl: intlShape.isRequired,
    state: React.PropTypes.object,
    updateParent: React.PropTypes.func
};

export default injectIntl(TeamSignupUsernamePage);