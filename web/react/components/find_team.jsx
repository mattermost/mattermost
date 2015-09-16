// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var utils = require('../utils/utils.jsx');
var client = require('../utils/client.jsx');

export default class FindTeam extends React.Component {
    constructor(props) {
        super(props);
        this.state = {};

        this.handleSubmit = this.handleSubmit.bind(this);
    }

    handleSubmit(e) {
        e.preventDefault();

        var state = { };

        var email = React.findDOMNode(this.refs.email).value.trim().toLowerCase();
        if (!email || !utils.isEmail(email)) {
            state.email_error = 'Please enter a valid email address';
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
                    <h4>{'Find Your team'}</h4>
                    <p>{'An email was sent with links to any teams to which you are a member.'}</p>
                </div>
            );
        }

        return (
        <div>
                <h4>Find Your Team</h4>
                <form onSubmit={this.handleSubmit}>
                    <p>{'Get an email with links to any teams to which you are a member.'}</p>
                    <div className='form-group'>
                        <label className='control-label'>Email</label>
                        <div className={emailErrorClass}>
                            <input
                                type='text'
                                ref='email'
                                className='form-control'
                                placeholder='you@domain.com'
                                maxLength='128'
                            />
                            {emailError}
                        </div>
                    </div>
                    <button
                        className='btn btn-md btn-primary'
                        type='submit'
                    >
                        Send
                    </button>
                </form>
                </div>
        );
    }
}
