// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from '../utils/utils.jsx';
import * as Client from '../utils/client.jsx';
import UserStore from '../stores/user_store.jsx';

export default class LoginEmail extends React.Component {
    constructor(props) {
        super(props);

        this.handleSubmit = this.handleSubmit.bind(this);

        this.state = {
            serverError: ''
        };
    }
    handleSubmit(e) {
        e.preventDefault();
        var state = {};

        const name = this.props.teamName;
        if (!name) {
            state.serverError = 'Bad team name';
            this.setState(state);
            return;
        }

        const email = this.refs.email.value.trim();
        if (!email) {
            state.serverError = 'An email is required';
            this.setState(state);
            return;
        }

        const password = this.refs.password.value.trim();
        if (!password) {
            state.serverError = 'A password is required';
            this.setState(state);
            return;
        }

        state.serverError = '';
        this.setState(state);

        Client.loginByEmail(name, email, password,
            () => {
                UserStore.setLastEmail(email);

                const redirect = Utils.getUrlParameter('redirect');
                if (redirect) {
                    window.location.href = decodeURIComponent(redirect);
                } else {
                    window.location.href = '/' + name + '/channels/town-square';
                }
            },
            (err) => {
                if (err.message === 'Login failed because email address has not been verified') {
                    window.location.href = '/verify_email?teamname=' + encodeURIComponent(name) + '&email=' + encodeURIComponent(email);
                    return;
                }
                state.serverError = err.message;
                this.valid = false;
                this.setState(state);
            }
        );
    }
    render() {
        let serverError;
        let errorClass = '';
        if (this.state.serverError) {
            serverError = <label className='control-label'>{this.state.serverError}</label>;
            errorClass = ' has-error';
        }

        let priorEmail = UserStore.getLastEmail();
        let focusEmail = false;
        let focusPassword = false;
        if (priorEmail === '') {
            focusEmail = true;
        } else {
            focusPassword = true;
        }

        const emailParam = Utils.getUrlParameter('email');
        if (emailParam) {
            priorEmail = decodeURIComponent(emailParam);
        }

        return (
            <form onSubmit={this.handleSubmit}>
                <div className='signup__email-container'>
                    <div className={'form-group' + errorClass}>
                        {serverError}
                    </div>
                    <div className={'form-group' + errorClass}>
                        <input
                            autoFocus={focusEmail}
                            type='email'
                            className='form-control'
                            name='email'
                            defaultValue={priorEmail}
                            ref='email'
                            placeholder='Email'
                            spellCheck='false'
                        />
                    </div>
                    <div className={'form-group' + errorClass}>
                        <input
                            autoFocus={focusPassword}
                            type='password'
                            className='form-control'
                            name='password'
                            ref='password'
                            placeholder='Password'
                            spellCheck='false'
                        />
                    </div>
                    <div className='form-group'>
                        <button
                            type='submit'
                            className='btn btn-primary'
                        >
                            {'Sign in'}
                        </button>
                    </div>
                </div>
            </form>
        );
    }
}
LoginEmail.defaultProps = {
};

LoginEmail.propTypes = {
    teamName: React.PropTypes.string.isRequired
};
