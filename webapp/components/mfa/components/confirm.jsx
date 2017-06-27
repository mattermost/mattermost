// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Constants from 'utils/constants.jsx';
const KeyCodes = Constants.KeyCodes;

import React from 'react';
import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';
import {browserHistory} from 'react-router/es6';

import {loadMe} from 'actions/user_actions.jsx';

export default class Confirm extends React.Component {
    constructor(props) {
        super(props);

        this.onKeyPress = this.onKeyPress.bind(this);
    }

    componentDidMount() {
        document.body.addEventListener('keydown', this.onKeyPress);
    }

    componentWillUnmount() {
        document.body.removeEventListener('keydown', this.onKeyPress);
    }

    submit(e) {
        e.preventDefault();
        loadMe().then(() => {
            browserHistory.push('/');
        });
    }

    onKeyPress(e) {
        if (e.which === KeyCodes.ENTER) {
            this.submit(e);
        }
    }

    render() {
        return (
            <div>
                <form
                    onSubmit={this.submit}
                    onKeyPress={this.onKeyPress}
                    className='form-group'
                >
                    <p>
                        <FormattedHTMLMessage
                            id='mfa.confirm.complete'
                            defaultMessage='<strong>Set up complete!</strong>'
                        />
                    </p>
                    <p>
                        <FormattedMessage
                            id='mfa.confirm.secure'
                            defaultMessage='Your account is now secure. Next time you sign in, you will be asked to enter a code from the Google Authenticator app on your phone.'
                        />
                    </p>
                    <button
                        type='submit'
                        className='btn btn-primary'
                    >
                        <FormattedMessage
                            id='mfa.confirm.okay'
                            defaultMessage='Okay'
                        />
                    </button>
                </form>
            </div>
        );
    }
}

Confirm.defaultProps = {
};
Confirm.propTypes = {
};
