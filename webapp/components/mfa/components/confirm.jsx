// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';
import {browserHistory} from 'react-router/es6';

export default class Confirm extends React.Component {
    submit(e) {
        e.preventDefault();
        browserHistory.push('/');
    }

    render() {
        return (
            <div>
                <form
                    onSubmit={this.submit}
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
