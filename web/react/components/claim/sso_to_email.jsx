// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from '../../utils/utils.jsx';
import * as Client from '../../utils/client.jsx';

export default class SSOToEmail extends React.Component {
    constructor(props) {
        super(props);

        this.submit = this.submit.bind(this);

        this.state = {};
    }
    submit(e) {
        e.preventDefault();
        const state = {};

        const password = ReactDOM.findDOMNode(this.refs.password).value.trim();
        if (!password) {
            state.error = 'Please enter a password.';
            this.setState(state);
            return;
        }

        const confirmPassword = ReactDOM.findDOMNode(this.refs.passwordconfirm).value.trim();
        if (!confirmPassword || password !== confirmPassword) {
            state.error = 'Passwords do not match.';
            this.setState(state);
            return;
        }

        state.error = null;
        this.setState(state);

        var postData = {};
        postData.password = password;
        postData.email = this.props.email;
        postData.team_name = this.props.teamName;

        Client.switchToEmail(postData,
            (data) => {
                if (data.follow_link) {
                    window.location.href = data.follow_link;
                }
            },
            (error) => {
                this.setState({error});
            }
        );
    }
    render() {
        var error = null;
        if (this.state.error) {
            error = <div className='form-group has-error'><label className='control-label'>{this.state.error}</label></div>;
        }

        var formClass = 'form-group';
        if (error) {
            formClass += ' has-error';
        }

        const uiType = Utils.toTitleCase(this.props.currentType) + ' SSO';

        return (
            <div className='col-sm-12'>
                <div className='signup-team__container'>
                    <h3>{'Switch ' + uiType + ' Account to Email'}</h3>
                    <form onSubmit={this.submit}>
                        <p>{'Upon changing your account type, you will only be able to login with your email and password.'}</p>
                        <p>{'Enter a new password for your ' + this.props.teamDisplayName + ' ' + global.window.mm_config.SiteName + ' account.'}</p>
                        <div className={formClass}>
                            <input
                                type='password'
                                className='form-control'
                                name='password'
                                ref='password'
                                placeholder='New Password'
                                spellCheck='false'
                            />
                        </div>
                        <div className={formClass}>
                            <input
                                type='password'
                                className='form-control'
                                name='passwordconfirm'
                                ref='passwordconfirm'
                                placeholder='Confirm Password'
                                spellCheck='false'
                            />
                        </div>
                        {error}
                        <button
                            type='submit'
                            className='btn btn-primary'
                        >
                            {'Switch ' + uiType + ' account to email and password'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }
}

SSOToEmail.defaultProps = {
};
SSOToEmail.propTypes = {
    currentType: React.PropTypes.string.isRequired,
    email: React.PropTypes.string.isRequired,
    teamName: React.PropTypes.string.isRequired,
    teamDisplayName: React.PropTypes.string.isRequired
};
