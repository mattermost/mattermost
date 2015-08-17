// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var utils = require('../utils/utils.jsx');

module.exports = React.createClass({
    displayName: 'EmailItem',
    propTypes: {
        focus: React.PropTypes.bool,
        email: React.PropTypes.string
    },
    getInitialState: function() {
        return {};
    },
    getValue: function() {
        return this.refs.email.getDOMNode().value.trim();
    },
    validate: function(teamEmail) {
        var email = this.refs.email.getDOMNode().value.trim().toLowerCase();

        if (!email) {
            return true;
        }

        if (!utils.isEmail(email)) {
            this.state.emailError = 'Please enter a valid email address';
            this.setState(this.state);
            return false;
        } else if (email === teamEmail) {
            this.state.emailError = 'Please use a different email than the one used at signup';
            this.setState(this.state);
            return false;
        }
        this.state.emailError = '';
        this.setState(this.state);
        return true;
    },
    render: function() {
        var emailError = null;
        var emailDivClass = 'form-group';
        if (this.state.emailError) {
            emailError = <label className='control-label'>{this.state.emailError}</label>;
            emailDivClass += ' has-error';
        }

        return (
            <div className={emailDivClass}>
                <input autoFocus={this.props.focus} type='email' ref='email' className='form-control' placeholder='Email Address' defaultValue={this.props.email} maxLength='128' />
                {emailError}
            </div>
        );
    }
});
