// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.
import {intlShape, injectIntl, defineMessages} from 'react-intl';

const messages = defineMessages({
    verified: {
        id: 'email_verify.verified',
        defaultMessage: ' Email Verified'
    },
    notVerified: {
        id: 'email_verify.notVerified',
        defaultMessage: ' Email Not Verified'
    },
    verifiedBody1: {
        id: 'email_verify.verifiedBody1',
        defaultMessage: 'Your email has been verified! Click '
    },
    verifiedBody2: {
        id: 'email_verify.verifiedBody2',
        defaultMessage: 'here'
    },
    verifiedBody3: {
        id: 'email_verify.verifiedBody3',
        defaultMessage: ' to log in.'
    },
    notVerifiedBody: {
        id: 'email_verify.notVerifiedBody',
        defaultMessage: 'Please verify your email address. Check your inbox for an email.'
    },
    resend: {
        id: 'email_verify.resend',
        defaultMessage: 'Resend Email'
    },
    sent: {
        id: 'email_verify.sent',
        defaultMessage: ' Verification email sent.'
    },
    almost: {
        id: 'email_verify.almost',
        defaultMessage: ': You are almost done'
    }
});

class EmailVerify extends React.Component {
    constructor(props) {
        super(props);

        this.handleResend = this.handleResend.bind(this);

        this.state = {};
    }
    handleResend() {
        const newAddress = window.location.href.replace('&resend_success=true', '');
        window.location.href = newAddress + '&resend=true';
    }
    render() {
        const {formatMessage} = this.props.intl;
        var title = '';
        var body = '';
        var resend = '';
        var resendConfirm = '';
        if (this.props.isVerified === 'true') {
            title = global.window.mm_config.SiteName + formatMessage(messages.verified);
            body = <p>{formatMessage(messages.verifiedBody1)}<a href={this.props.teamURL + '?email=' + this.props.userEmail}>{formatMessage(messages.verifiedBody2)}</a>{formatMessage(messages.verifiedBody3)}</p>;
        } else {
            title = global.window.mm_config.SiteName + formatMessage(messages.almost);
            body = <p>{formatMessage(messages.notVerifiedBody)}</p>;
            resend = (
                <button
                    onClick={this.handleResend}
                    className='btn btn-primary'
                >
                    {formatMessage(messages.resend)}
                </button>
            );
            if (this.props.resendSuccess) {
                resendConfirm = <div><br /><p className='alert alert-success'><i className='fa fa-check'></i>{formatMessage(messages.sent)}</p></div>;
            }
        }

        return (
            <div className='col-sm-12'>
                <div className='signup-team__container'>
                    <h3>{title}</h3>
                    <div>
                        {body}
                        {resend}
                        {resendConfirm}
                    </div>
                </div>
            </div>
        );
    }
}

EmailVerify.defaultProps = {
    isVerified: 'false',
    teamURL: '',
    userEmail: '',
    resendSuccess: 'false'
};
EmailVerify.propTypes = {
    intl: intlShape.isRequired,
    isVerified: React.PropTypes.string,
    teamURL: React.PropTypes.string,
    userEmail: React.PropTypes.string,
    resendSuccess: React.PropTypes.string
};

export default injectIntl(EmailVerify);