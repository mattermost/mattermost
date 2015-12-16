// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.
import {intlShape, injectIntl, defineMessages} from 'react-intl';

const messages = defineMessages({
    zboxCreate: {
        id: 'choose_auth_page.zboxCreate',
        defaultMessage: 'Create new team with ZBox Account'
    },
    emailCreate: {
        id: 'choose_auth_page.emailCreate',
        defaultMessage: 'Create new team with email address'
    },
    noSignup: {
        id: 'choose_auth_page.noSignup',
        defaultMessage: 'No sign-up methods configured, please contact your system administrator.'
    },
    find: {
        id: 'choose_auth_page.find',
        defaultMessage: 'Find my team'
    }
});

class ChooseAuthPage extends React.Component {
    constructor(props) {
        super(props);
        this.state = {};
    }
    render() {
        const {formatMessage} = this.props.intl;
        var buttons = [];
        if (global.window.mm_config.EnableSignUpWithGitLab === 'true') {
            buttons.push(
                    <a
                        className='btn btn-custom-login gitlab btn-full'
                        href='#'
                        key='gitlab'
                        onClick={
                            function clickGit(e) {
                                e.preventDefault();
                                this.props.updatePage('gitlab');
                            }.bind(this)
                        }
                    >
                        <span className='icon' />
                        <span>{'Create new team with GitLab Account'}</span>
                    </a>
            );
        }

        if (global.window.mm_config.EnableSignUpWithZBox === 'true') {
            buttons.push(
                <a
                    className='btn btn-custom-login zbox btn-full'
                    href='#'
                    onClick={
                            function clickGit(e) {
                                e.preventDefault();
                                this.props.updatePage('zbox');
                            }.bind(this)
                        }
                >
                    <span className='icon' />
                    <span>{formatMessage(messages.zboxCreate)}</span>
                </a>
            );
        }

        if (global.window.mm_config.EnableSignUpWithEmail === 'true') {
            buttons.push(
                    <a
                        className='btn btn-custom-login email btn-full'
                        href='#'
                        onClick={
                            function clickEmail(e) {
                                e.preventDefault();
                                this.props.updatePage('email');
                            }.bind(this)
                        }
                    >
                        <span className='fa fa-envelope' />
                        <span>{formatMessage(messages.emailCreate)}</span>
                    </a>
            );
        }

        if (buttons.length === 0) {
            buttons = <span>{formatMessage(messages.noSignup)}</span>;
        }

        return (
            <div>
                {buttons}
                <div className='form-group margin--extra-2x'>
                    <span><a href='/find_team'>{formatMessage(messages.find)}</a></span>
                </div>
            </div>
        );
    }
}

ChooseAuthPage.propTypes = {
    intl: intlShape.isRequried,
    updatePage: React.PropTypes.func
};

export default injectIntl(ChooseAuthPage);