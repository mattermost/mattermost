// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {FormattedMessage} from 'mm-intl';
import * as Client from '../utils/client.jsx';

export default class ShouldVerifyEmail extends React.Component {
    constructor(props) {
        super(props);

        this.handleResend = this.handleResend.bind(this);

        this.state = {
            resendStatus: 'none'
        };
    }
    handleResend() {
        const teamName = this.props.location.query.teamname;
        const email = this.props.location.query.email;

        this.setState({resendStatus: 'sending'});

        Client.resendVerification(() => {
            this.setState({resendStatus: 'success'});
        },
        () => {
            this.setState({resendStatus: 'failure'});
        },
        teamName,
        email);
    }
    render() {
        let resendConfirm = '';
        if (this.state.resendStatus === 'success') {
            resendConfirm = (
                <div>
                    <br/>
                    <p className='alert alert-success'>
                        <i className='fa fa-check'/>
                        <FormattedMessage
                            id='email_verify.sent'
                            defaultMessage=' Verification email sent.'
                        />
                    </p>
                </div>
            );
        }

        if (this.state.resendStatus === 'failure') {
            resendConfirm = (
                <div>
                    <br/>
                    <p className='alert alert-danger'>
                        <i className='fa fa-times'/>
                        <FormattedMessage id='email_verify.failed'/>
                    </p>
                </div>
            );
        }

        return (
            <div>
                <div className='signup-header'>
                    <a href='/'>
                        <span className='fa fa-chevron-left'/>
                        <FormattedMessage
                            id='web.header.back'
                        />
                    </a>
                </div>
                <div className='col-sm-12'>
                    <div className='signup-team__container'>
                        <h3>
                            <FormattedMessage
                                id='email_verify.almost'
                                defaultMessage='{siteName}: You are almost done'
                                values={{
                                    siteName: global.window.mm_config.SiteName
                                }}
                            />
                        </h3>
                        <div>
                            <p>
                                <FormattedMessage
                                    id='email_verify.notVerifiedBody'
                                    defaultMessage='Please verify your email address. Check your inbox for an email.'
                                />
                            </p>
                            <button
                                onClick={this.handleResend}
                                className='btn btn-primary'
                            >
                                <FormattedMessage
                                    id='email_verify.resend'
                                    defaultMessage='Resend Email'
                                />
                            </button>
                            {resendConfirm}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

ShouldVerifyEmail.defaultProps = {
};
ShouldVerifyEmail.propTypes = {
    location: React.PropTypes.object.isRequired
};
