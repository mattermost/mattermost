// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {FormattedMessage, FormattedHTMLMessage} from 'mm-intl';

export default class SignupTeamConfirm extends React.Component {
    render() {
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
                    <div classNameName='signup-team__container'>
                        <h3>
                            <FormattedMessage
                                id='signup_team_confirm.title'
                                defaultMessage='Sign up Complete'
                            />
                        </h3>
                        <p>
                            <FormattedHTMLMessage
                                id='signup_team_confirm.checkEmail'
                                defaultMessage='Please check your email: <strong>{email}</strong><br />Your email contains a link to set up your team'
                                values={{
                                    email: this.props.location.query.email
                                }}
                            />
                        </p>
                    </div>
                </div>
            </div>
        );
    }
}

SignupTeamConfirm.defaultProps = {
};
SignupTeamConfirm.propTypes = {
    location: React.PropTypes.object
};
