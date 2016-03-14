// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from '../../../utils/utils.jsx';
import * as Client from '../../../utils/client.jsx';
import Constants from '../../../utils/constants.jsx';

import {intlShape, injectIntl, defineMessages, FormattedMessage} from 'mm-intl';

const holders = defineMessages({
    reserved: {
        id: 'team_signup_username.reserved',
        defaultMessage: 'This username is reserved, please choose a new one.'
    },
    invalid: {
        id: 'team_signup_username.invalid',
        defaultMessage: 'Username must begin with a letter, and contain between {min} to {max} characters in total, which may be numbers, lowercase letters, or any of the symbols \'.\', \'-\', or \'_\''
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
        if (usernameError === 'Cannot use a reserved word as a username.') { //this should be change to some kind of ID
            this.setState({nameError: formatMessage(holders.reserved)});
            return;
        } else if (usernameError) {
            this.setState({nameError: formatMessage(holders.invalid, {min: Constants.MIN_USERNAME_LENGTH, max: Constants.MAX_USERNAME_LENGTH})});
            return;
        }

        this.props.state.wizard = 'password';
        this.props.state.user.username = name;
        this.props.updateParent(this.props.state);
    }
    render() {
        Client.track('signup', 'signup_team_06_username');

        var nameError = null;
        var nameHelpText = (
            <span className='color--light help-block'>
                <FormattedMessage
                    id='team_signup_username.hint'
                    defaultMessage="Usernames must begin with a letter and contain between {min} to {max} characters made up of lowercase letters, numbers, and the symbols '.', '-' and '_'"
                    values={{
                        min: Constants.MIN_USERNAME_LENGTH,
                        max: Constants.MAX_USERNAME_LENGTH
                    }}
                />
            </span>
        );
        var nameDivClass = 'form-group';
        if (this.state.nameError) {
            nameError = <label className='control-label'>{this.state.nameError}</label>;
            nameHelpText = '';
            nameDivClass += ' has-error';
        }

        return (
            <div>
                <form>
                    <img
                        className='signup-team-logo'
                        src='/static/images/logo.png'
                    />
                    <h2 className='margin--less'>
                        <FormattedMessage
                            id='team_signup_username.username'
                            defaultMessage='Your username'
                        />
                    </h2>
                    <h5 className='color--light'>
                        <FormattedMessage
                            id='team_signup_username.memorable'
                            defaultMessage='Select a memorable username that makes it easy for teammates to identify you:'
                        />
                    </h5>
                    <div className='inner__content margin--extra'>
                        <div className={nameDivClass}>
                            <div className='row'>
                                <div className='col-sm-11'>
                                    <h5><strong>
                                        <FormattedMessage
                                            id='team_signup_username.chooseUsername'
                                            defaultMessage='Choose your username'
                                        />
                                    </strong></h5>
                                    <input
                                        autoFocus={true}
                                        type='text'
                                        ref='name'
                                        className='form-control'
                                        placeholder=''
                                        defaultValue={this.props.state.user.username}
                                        maxLength={Constants.MAX_USERNAME_LENGTH}
                                        spellCheck='false'
                                    />
                                    {nameHelpText}
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
                        <FormattedMessage
                            id='team_signup_username.next'
                            defaultMessage='Next'
                        />
                        <i className='glyphicon glyphicon-chevron-right'></i>
                    </button>
                    <div className='margin--extra'>
                        <a
                            href='#'
                            onClick={this.submitBack}
                        >
                            <FormattedMessage
                                id='team_signup_username.back'
                                defaultMessage='Back to previous step'
                            />
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
