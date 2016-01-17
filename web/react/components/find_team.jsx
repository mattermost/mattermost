// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import * as utils from '../utils/utils.jsx';
import * as client from '../utils/client.jsx';

const messages = defineMessages({
    submitError: {
        id: 'find_team.submitError',
        defaultMessage: 'Please enter a valid email address'
    },
    findTitle: {
        id: 'find_team.findTitle',
        defaultMessage: 'Find Your team'
    },
    findDescription: {
        id: 'find_team.findDescription',
        defaultMessage: 'An email was sent with links to any teams to which you are a member.'
    },
    getLinks: {
        id: 'find_team.getLinks',
        defaultMessage: 'Get an email with links to any teams to which you are a member.'
    },
    send: {
        id: 'find_team.send',
        defaultMessage: 'Send'
    },
    email: {
        id: 'find_team.email',
        defaultMessage: 'Email'
    },
    placeholder: {
        id: 'find_team.placeholder',
        defaultMessage: 'you@domain.com'
    }
});

class FindTeam extends React.Component {
    constructor(props) {
        super(props);
        this.state = {};

        this.handleSubmit = this.handleSubmit.bind(this);
    }

    handleSubmit(e) {
        e.preventDefault();

        const {formatMessage} = this.props.intl;
        var state = { };

        var email = ReactDOM.findDOMNode(this.refs.email).value.trim().toLowerCase();
        if (!email || !utils.isEmail(email)) {
            state.email_error = formatMessage(messages.submitError);
            this.setState(state);
            return;
        }

        state.email_error = '';

        client.findTeamsSendEmail(email,
            function success() {
                state.sent = true;
                this.setState(state);
            }.bind(this),
            function fail(err) {
                state.email_error = err.message;
                this.setState(state);
            }.bind(this)
        );
    }

    render() {
        const {formatMessage} = this.props.intl;
        var emailError = null;
        var emailErrorClass = 'form-group';

        if (this.state.email_error) {
            emailError = <label className='control-label'>{this.state.email_error}</label>;
            emailErrorClass = 'form-group has-error';
        }

        if (this.state.sent) {
            return (
                <div>
                    <h4>{formatMessage(messages.findTitle)}</h4>
                    <p>{formatMessage(messages.findDescription)}</p>
                </div>
            );
        }

        return (
        <div>
                <h4>{formatMessage(messages.findTitle)}</h4>
                <form onSubmit={this.handleSubmit}>
                    <p>{formatMessage(messages.getLinks)}</p>
                    <div className='form-group'>
                        <label className='control-label'>{formatMessage(messages.email)}</label>
                        <div className={emailErrorClass}>
                            <input
                                type='text'
                                ref='email'
                                className='form-control'
                                placeholder={formatMessage(messages.placeholder)}
                                maxLength='128'
                                spellCheck='false'
                            />
                            {emailError}
                        </div>
                    </div>
                    <button
                        className='btn btn-md btn-primary'
                        type='submit'
                    >
                        {formatMessage(messages.send)}
                    </button>
                </form>
                </div>
        );
    }
}

FindTeam.propTypes = {
    intl: intlShape.isRequired
};

export default injectIntl(FindTeam);