// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from '../../../utils/utils.jsx';

import {intlShape, injectIntl, defineMessages} from 'mm-intl';

const holders = defineMessages({
    validEmail: {
        id: 'team_signup_email.validEmail',
        defaultMessage: 'Please enter a valid email address'
    },
    different: {
        id: 'team_signup_email.different',
        defaultMessage: 'Please use a different email than the one used at signup'
    },
    address: {
        id: 'team_signup_email.address',
        defaultMessage: 'Email Address'
    }
});

class TeamSignupEmailItem extends React.Component {
    constructor(props) {
        super(props);

        this.getValue = this.getValue.bind(this);
        this.validate = this.validate.bind(this);

        this.state = {};
    }
    getValue() {
        return ReactDOM.findDOMNode(this.refs.email).value.trim();
    }
    validate(teamEmail) {
        const {formatMessage} = this.props.intl;
        const email = ReactDOM.findDOMNode(this.refs.email).value.trim().toLowerCase();

        if (!email) {
            return true;
        }

        if (!Utils.isEmail(email)) {
            this.setState({emailError: formatMessage(holders.validEmail)});
            return false;
        } else if (email === teamEmail) {
            this.setState({emailError: formatMessage(holders.different)});
            return false;
        }

        this.setState({emailError: ''});
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
                    placeholder={this.props.intl.formatMessage(holders.address)}
                    defaultValue={this.props.email}
                    maxLength='128'
                    spellCheck='false'
                />
                {emailError}
            </div>
        );
    }
}

TeamSignupEmailItem.propTypes = {
    intl: intlShape.isRequired,
    focus: React.PropTypes.bool,
    email: React.PropTypes.string
};

export default injectIntl(TeamSignupEmailItem, {withRef: true});
