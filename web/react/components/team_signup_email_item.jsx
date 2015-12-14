// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import * as Utils from '../utils/utils.jsx';

const messages = defineMessages({
    emailError1: {
        id: 'team_signup_email.emailError1',
        defaultMessage: 'Please enter a valid email address'
    },
    emailError2: {
        id: 'team_signup_email.emailError2',
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
            this.setState({emailError: formatMessage(messages.emailError1)});
            return false;
        } else if (email === teamEmail) {
            this.setState({emailError: formatMessage(messages.emailError2)});
            return false;
        }

        this.setState({emailError: ''});
        return true;
    }
    render() {
        const {formatMessage} = this.props.intl;
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
                    placeholder={formatMessage(messages.address)}
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

export default injectIntl(TeamSignupEmailItem);