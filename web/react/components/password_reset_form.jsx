// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Client from '../utils/client.jsx';
import * as Utils from '../utils/utils.jsx';
import Constants from '../utils/constants.jsx';

import {FormattedMessage} from 'mm-intl';
import {browserHistory} from 'react-router';

class PasswordResetForm extends React.Component {
    constructor(props) {
        super(props);

        this.handlePasswordReset = this.handlePasswordReset.bind(this);

        this.state = {};
    }
    handlePasswordReset(e) {
        e.preventDefault();

        const password = ReactDOM.findDOMNode(this.refs.password).value.trim();
        if (!password || password.length < Constants.MIN_PASSWORD_LENGTH) {
            this.setState({
                error: (
                    <FormattedMessage
                        id='password_form.error'
                        defaultMessage='Please enter at least {chars} characters.'
                        chars={Constants.MIN_PASSWORD_LENGTH}
                    />
                )
            });
            return;
        }

        this.setState({
            error: null
        });

        const data = {};
        data.new_password = password;
        data.hash = this.props.location.query.h;
        data.data = this.props.location.query.d;
        data.name = this.props.params.team;

        Client.resetPassword(data,
            () => {
                this.setState({error: null});
                browserHistory.push('/' + this.props.params.team + '/login');
            },
            (err) => {
                this.setState({error: err.message});
            }
        );
    }
    render() {
        var error = null;
        if (this.state.error) {
            error = (
                <div className='form-group has-error'>
                    <label className='control-label'>
                        {this.state.error}
                    </label>
                </div>
            );
        }

        var formClass = 'form-group';
        if (error) {
            formClass += ' has-error';
        }

        return (
            <div className='col-sm-12'>
                <div className='signup-team__container'>
                    <h3>
                        <FormattedMessage
                            id='password_form.title'
                            defaultMessage='Password Reset'
                        />
                    </h3>
                    <form onSubmit={this.handlePasswordReset}>
                        <p>
                            <FormattedMessage
                                id='password_form.enter'
                                defaultMessage='Enter a new password for your {siteName} account.'
                                values={{
                                    siteName: global.window.mm_config.SiteName
                                }}
                            />
                        </p>
                        <div className={formClass}>
                            <input
                                type='password'
                                className='form-control'
                                name='password'
                                ref='password'
                                placeholder={Utils.localizeMessage(
                                    'password_form.pwd',
                                    'Password'
                                )}
                                spellCheck='false'
                            />
                        </div>
                        {error}
                        <button
                            type='submit'
                            className='btn btn-primary'
                        >
                            <FormattedMessage
                                id='password_form.change'
                                defaultMessage='Change my password'
                            />
                        </button>
                    </form>
                </div>
            </div>
        );
    }
}

PasswordResetForm.defaultProps = {
};
PasswordResetForm.propTypes = {
    params: React.PropTypes.object.isRequired,
    location: React.PropTypes.object.isRequired
};

export default PasswordResetForm;
