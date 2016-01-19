// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Client from '../utils/client.jsx';
import Constants from '../utils/constants.jsx';

export default class PasswordResetForm extends React.Component {
    constructor(props) {
        super(props);

        this.handlePasswordReset = this.handlePasswordReset.bind(this);

        this.state = {};
    }
    handlePasswordReset(e) {
        e.preventDefault();
        var state = {};

        var password = ReactDOM.findDOMNode(this.refs.password).value.trim();
        if (!password || password.length < Constants.MIN_PASSWORD_LENGTH) {
            state.error = 'Please enter at least ' + Constants.MIN_PASSWORD_LENGTH + ' characters.';
            this.setState(state);
            return;
        }

        state.error = null;
        this.setState(state);

        var data = {};
        data.new_password = password;
        data.hash = this.props.hash;
        data.data = this.props.data;
        data.name = this.props.teamName;

        Client.resetPassword(data,
            function resetSuccess() {
                this.setState({error: null, updateText: 'Your password has been updated successfully.'});
            }.bind(this),
            function resetFailure(err) {
                this.setState({error: err.message, updateText: null});
            }.bind(this)
        );
    }
    render() {
        var updateText = null;
        if (this.state.updateText) {
            updateText = <div className='form-group'><br/><label className='control-label reset-form'>{this.state.updateText} Click <a href={'/' + this.props.teamName + '/login'}>here</a> to log in.</label></div>;
        }

        var error = null;
        if (this.state.error) {
            error = <div className='form-group has-error'><label className='control-label'>{this.state.error}</label></div>;
        }

        var formClass = 'form-group';
        if (error) {
            formClass += ' has-error';
        }

        return (
            <div className='col-sm-12'>
                <div className='signup-team__container'>
                    <h3>{'Password Reset'}</h3>
                    <form onSubmit={this.handlePasswordReset}>
                        <p>{'Enter a new password for your ' + this.props.teamDisplayName + ' ' + global.window.mm_config.SiteName + ' account.'}</p>
                        <div className={formClass}>
                            <input
                                type='password'
                                className='form-control'
                                name='password'
                                ref='password'
                                placeholder='Password'
                                spellCheck='false'
                            />
                        </div>
                        {error}
                        <button
                            type='submit'
                            className='btn btn-primary'
                        >
                            {'Change my password'}
                        </button>
                        {updateText}
                    </form>
                </div>
            </div>
        );
    }
}

PasswordResetForm.defaultProps = {
    teamName: '',
    teamDisplayName: '',
    hash: '',
    data: ''
};
PasswordResetForm.propTypes = {
    teamName: React.PropTypes.string,
    teamDisplayName: React.PropTypes.string,
    hash: React.PropTypes.string,
    data: React.PropTypes.string
};
