/**
 * Created by enahum on 1/29/16.
 */
// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {FormattedMessage, FormattedHTMLMessage} from 'mm-intl';

export default class SignupTeamConfirm extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div className='signup-team__container'>
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
                            email: this.props.email
                        }}
                    />
                </p>
            </div>
        );
    }
}

SignupTeamConfirm.defaultProps = {
    email: ''
};
SignupTeamConfirm.propTypes = {
    email: React.PropTypes.string
};
