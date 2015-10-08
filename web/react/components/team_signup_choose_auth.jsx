// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

export default class ChooseAuthPage extends React.Component {
    constructor(props) {
        super(props);
        this.state = {};
    }
    render() {
        var buttons = [];
        if (global.window.config.EnableSignUpWithGitLab === 'true') {
            buttons.push(
                    <a
                        className='btn btn-custom-login gitlab btn-full'
                        href='#'
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

        if (global.window.config.EnableSignUpWithEmail === 'true') {
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
                        <span>{'Create new team with email address'}</span>
                    </a>
            );
        }

        if (buttons.length === 0) {
            buttons = <span>{'No sign-up methods configured, please contact your system administrator.'}</span>;
        }

        return (
            <div>
                {buttons}
                <div className='form-group margin--extra-2x'>
                    <span><a href='/find_team'>{'Find my teams'}</a></span>
                </div>
            </div>
        );
    }
}

ChooseAuthPage.propTypes = {
    updatePage: React.PropTypes.func
};
