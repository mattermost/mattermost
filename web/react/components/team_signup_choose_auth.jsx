// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {FormattedMessage} from 'mm-intl';

export default class ChooseAuthPage extends React.Component {
    constructor(props) {
        super(props);
        this.state = {};
    }
    render() {
        var buttons = [];
        if (global.window.mm_config.EnableSignUpWithGitLab === 'true') {
            buttons.push(
                    <a
                        className='btn btn-custom-login gitlab btn-full'
                        key='gitlab'
                        href='#'
                        onClick={
                            function clickGit(e) {
                                e.preventDefault();
                                this.props.updatePage('gitlab');
                            }.bind(this)
                        }
                    >
                        <span className='icon'/>
                        <span>
                            <FormattedMessage
                                id='choose_auth_page.gitlabCreate'
                                defaultMessage='Create new team with GitLab Account'
                            />
                        </span>
                    </a>
            );
        }

        if (global.window.mm_config.EnableSignUpWithGoogle === 'true') {
            buttons.push(
                    <a
                        className='btn btn-custom-login google btn-full'
                        key='google'
                        href='#'
                        onClick={
                            (e) => {
                                e.preventDefault();
                                this.props.updatePage('google');
                            }
                        }
                    >
                        <span className='icon'/>
                        <span>
                            <FormattedMessage
                                id='choose_auth_page.googleCreate'
                                defaultMessage='Create new team with Google Apps Account'
                            />
                        </span>
                    </a>
            );
        }

        if (global.window.mm_config.EnableLdap === 'true') {
            buttons.push(
                    <a
                        className='btn btn-custom-login ldap btn-full'
                        key='ldap'
                        href='#'
                        onClick={
                            (e) => {
                                e.preventDefault();
                                this.props.updatePage('ldap');
                            }
                        }
                    >
                        <span className='icon'/>
                        <span>
                            <FormattedMessage
                                id='choose_auth_page.ldapCreate'
                                defaultMessage='Create new team with LDAP Account'
                            />
                        </span>
                    </a>
            );
        }

        if (global.window.mm_config.EnableSignUpWithEmail === 'true') {
            buttons.push(
                    <a
                        className='btn btn-custom-login email btn-full'
                        key='email'
                        href='#'
                        onClick={
                            function clickEmail(e) {
                                e.preventDefault();
                                this.props.updatePage('email');
                            }.bind(this)
                        }
                    >
                        <span className='fa fa-envelope'/>
                        <span>
                            <FormattedMessage
                                id='choose_auth_page.emailCreate'
                                defaultMessage='Create new team with email address'
                            />
                        </span>
                    </a>
            );
        }

        if (buttons.length === 0) {
            buttons = (
                <span>
                    <FormattedMessage
                        id='choose_auth_page.noSignup'
                        defaultMessage='No sign-up methods configured, please contact your system administrator.'
                    />
                </span>
            );
        }

        return (
            <div>
                {buttons}
                <div className='form-group margin--extra-2x'>
                    <span><a href='/find_team'>
                        <FormattedMessage
                            id='choose_auth_page.find'
                            defaultMessage='Find my teams'
                        />
                    </a></span>
                </div>
            </div>
        );
    }
}

ChooseAuthPage.propTypes = {
    updatePage: React.PropTypes.func
};
