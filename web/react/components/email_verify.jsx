// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {FormattedMessage, FormattedHTMLMessage} from 'mm-intl';

export default class EmailVerify extends React.Component {
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
        var title = '';
        var body = '';
        var resend = '';
        var resendConfirm = '';
        if (this.props.isVerified === 'true') {
            title = (
                <FormattedMessage
                    id='email_verify.verified'
                    defaultMessage='{siteName} Email Verified'
                    values={{
                        siteName: global.window.mm_config.SiteName
                    }}
                />
            );
            body = (
                <FormattedHTMLMessage
                    id='email_verify.verifiedBody'
                    defaultMessage='<p>Your email has been verified! Click <a href={url}>here</a> to log in.</p>'
                    values={{
                        url: this.props.teamURL + '?email=' + this.props.userEmail
                    }}
                />
            );
        } else {
            title = (
                <FormattedMessage
                    id='email_verify.almost'
                    defaultMessage='{siteName}: You are almost done'
                    values={{
                        siteName: global.window.mm_config.SiteName
                    }}
                />
            );
            body = (
                <p>
                    <FormattedMessage
                        id='email_verify.notVerifiedBody'
                        defaultMessage='Please verify your email address. Check your inbox for an email.'
                    />
                </p>
            );
            resend = (
                <button
                    onClick={this.handleResend}
                    className='btn btn-primary'
                >
                    <FormattedMessage
                        id='email_verify.resend'
                        defaultMessage='Resend Email'
                    />
                </button>
            );
            if (this.props.resendSuccess) {
                resendConfirm = (
                    <div><br /><p className='alert alert-success'><i className='fa fa-check'></i>
                        <FormattedMessage
                            id='email_verify.sent'
                            defaultMessage=' Verification email sent.'
                        />
                    </p></div>);
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
    isVerified: React.PropTypes.string,
    teamURL: React.PropTypes.string,
    userEmail: React.PropTypes.string,
    resendSuccess: React.PropTypes.string
};
