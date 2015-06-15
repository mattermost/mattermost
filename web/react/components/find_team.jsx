// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.


var utils = require('../utils/utils.jsx');
var client = require('../utils/client.jsx');

module.exports = React.createClass({
     handleSubmit: function(e) {
        e.preventDefault();

        var state = { };

        var email = this.refs.email.getDOMNode().value.trim().toLowerCase();
        if (!email || !utils.isEmail(email)) {
            state.email_error = "Please enter a valid email address";
            this.setState(state);
            return;
        }
        else {
            state.email_error = "";
        }

        client.findTeamsSendEmail(email,
            function(data) {
                state.sent = true;
                this.setState(state);
            }.bind(this),
            function(err) {
                state.email_error = err.message;
                this.setState(state);
            }.bind(this)
        );
    },
    getInitialState: function() {
        return {  };
    },
    render: function() {

        var email_error = this.state.email_error ? <label className='control-label'>{ this.state.email_error }</label> : null;

        var divStyle = {
            "marginTop": "50px",
        }

        if (this.state.sent) {
            return (
                <div>
                    <h4>{"Find Your " + utils.toTitleCase(strings.Team)}</h4>
                    <p>{"An email was sent with links to any " + strings.TeamPlural}</p>
                </div>
            );
        }

        return (
        <div>
                <h4>Find Your Team</h4>
                <form onSubmit={this.handleSubmit}>
                    <p>{"We'll send you an email with links to your " + strings.TeamPlural + "."}</p>
                    <div className="form-group">
                        <label className='control-label'>Email</label>
                        <div className={ email_error ? "form-group has-error" : "form-group" }>
                            <input type="text" ref="email" className="form-control" placeholder="you@domain.com" maxLength="128" />
                            { email_error }
                        </div>
                    </div>
                    <button className="btn btn-md btn-primary" type="submit">Send</button>
                </form>
                </div>
        );
    }
});
