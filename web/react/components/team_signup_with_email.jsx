// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

const Utils = require('../utils/utils.jsx');
const Client = require('../utils/client.jsx');

export default class EmailSignUpPage extends React.Component {
    constructor() {
        super();

        this.handleSubmit = this.handleSubmit.bind(this);

        this.state = {};
    }
    handleSubmit(e) {
        e.preventDefault();
        var team = {};
        var state = {serverError: ''};

        team.email = React.findDOMNode(this.refs.email).value.trim().toLowerCase();
        if (!team.email || !Utils.isEmail(team.email)) {
            state.emailError = 'Please enter a valid email address';
            state.inValid = true;
        } else {
            state.emailError = '';
        }

        if (state.inValid) {
            this.setState(state);
            return;
        }

        Client.signupTeam(team.email,
            (data) => {
                if (data.follow_link) {
                    window.location.href = data.follow_link;
                } else {
                    window.location.href = `/signup_team_confirm/?email=${encodeURIComponent(team.email)}`;
                }
            },
            (err) => {
                state.serverError = err.message;
                this.setState(state);
            }
        );
    }
    render() {
        var serverError = null;
        if (this.state.serverError) {
            serverError = <div className='form-group has-error'><label className='control-label'>{this.state.serverError}</label></div>;
        }

        return (
            <form
                role='form'
                onSubmit={this.handleSubmit}
            >
                <div className='form-group'>
                    <input
                        autoFocus={true}
                        type='email'
                        ref='email'
                        className='form-control'
                        placeholder='Email Address'
                        maxLength='128'
                    />
                </div>
                <div className='form-group'>
                    <button
                        className='btn btn-md btn-primary'
                        type='submit'
                    >
                        {'Sign up'}
                    </button>
                    {serverError}
                </div>
                <div className='form-group margin--extra-2x'>
                    <span><a href='/find_team'>{`Find my team`}</a></span>
                </div>
            </form>
        );
    }
}

EmailSignUpPage.defaultProps = {
};
EmailSignUpPage.propTypes = {
};
