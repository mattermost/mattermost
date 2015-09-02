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
        let team = {};
        let state = {serverError: ''};

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
            function success(data) {
                if (data.follow_link) {
                    window.location.href = data.follow_link;
                } else {
                    window.location.href = `/signup_team_confirm/?email=${encodeURIComponent(team.email)}`;
                }
            },
            function fail(err) {
                state.serverError = err.message;
                this.setState(state);
            }.bind(this)
        );
    }
    render() {
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
                        Sign up
                    </button>
                </div>
                <div className='form-group margin--extra-2x'>
                    <span><a href='/find_team'>{`Find my ${strings.Team}`}</a></span>
                </div>
            </form>
        );
    }
}

EmailSignUpPage.defaultProps = {
};
EmailSignUpPage.propTypes = {
};
