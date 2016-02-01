// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as utils from '../utils/utils.jsx';
import * as client from '../utils/client.jsx';

import {injectIntl, intlShape, defineMessages, FormattedMessage} from 'mm-intl';

var holders = defineMessages({
    submitError: {
        id: 'find_team.submitError',
        defaultMessage: 'Please enter a valid email address'
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

        var state = { };

        var email = ReactDOM.findDOMNode(this.refs.email).value.trim().toLowerCase();
        if (!email || !utils.isEmail(email)) {
            state.email_error = this.props.intl.formatMessage(holders.submitError);
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
        var emailError = null;
        var emailErrorClass = 'form-group';

        if (this.state.email_error) {
            emailError = <label className='control-label'>{this.state.email_error}</label>;
            emailErrorClass = 'form-group has-error';
        }

        if (this.state.sent) {
            return (
                <div>
                    <h4>
                        <FormattedMessage
                            id='find_team.findTitle'
                            defaultMessage='Find Your Team'
                        />
                    </h4>
                    <p>
                        <FormattedMessage
                            id='find_team.findDescription'
                            defaultMessage='An email was sent with links to any teams to which you are a member.'
                        />
                    </p>
                </div>
            );
        }

        return (
        <div>
                <h4>
                    <FormattedMessage
                        id='find_team.findTitle'
                        defaultMessage='Find Your Team'
                    />
                </h4>
                <form onSubmit={this.handleSubmit}>
                    <p>
                        <FormattedMessage
                            id='find_team.getLinks'
                            defaultMessage='Get an email with links to any teams to which you are a member.'
                        />
                    </p>
                    <div className='form-group'>
                        <label className='control-label'>
                            <FormattedMessage
                                id='find_team.email'
                                defaultMessage='Email'
                            />
                        </label>
                        <div className={emailErrorClass}>
                            <input
                                type='text'
                                ref='email'
                                className='form-control'
                                placeholder={this.props.intl.formatMessage(holders.placeholder)}
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
                        <FormattedMessage
                            id='find_team.send'
                            defaultMessage='Send'
                        />
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