// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

const Utils = require('../utils/utils.jsx');

export default class TeamSignupEmailItem extends React.Component {
    constructor(props) {
        super(props);

        this.getValue = this.getValue.bind(this);
        this.validate = this.validate.bind(this);

        this.state = {};
    }
    getValue() {
        return React.findDOMNode(this.refs.email).value.trim();
    }
    validate(teamEmail) {
        const email = React.findDOMNode(this.refs.email).value.trim().toLowerCase();

        if (!email) {
            return true;
        }

        if (!Utils.isEmail(email)) {
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
    }
    render() {
        let emailError = null;
        let emailDivClass = 'form-group';
        if (this.state.emailError) {
            emailError = <label className='control-label'>{this.state.emailError}</label>;
            emailDivClass += ' has-error';
        }

        return (
            <div className={emailDivClass}>
                <input
                    autoFocus={this.props.focus}
                    type='email'
                    ref='email'
                    className='form-control'
                    placeholder='Email Address'
                    defaultValue={this.props.email}
                    maxLength='128'
                />
                {emailError}
            </div>
        );
    }
}

TeamSignupEmailItem.propTypes = {
    focus: React.PropTypes.bool,
    email: React.PropTypes.string
};
