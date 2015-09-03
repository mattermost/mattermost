// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var Constants = require('../utils/constants.jsx');
import {strings} from '../utils/config.js';

export default class ChooseAuthPage extends React.Component {
    constructor(props) {
        super(props);
        this.state = {};
    }
    render() {
        var buttons = [];
        if (this.props.services.indexOf(Constants.GITLAB_SERVICE) !== -1) {
            buttons.push(
                    <a
                        className='btn btn-custom-login gitlab btn-full'
                        href='#'
                        onClick={
                            function clickGit(e) {
                                e.preventDefault();
                                this.props.updatePage('service', Constants.GITLAB_SERVICE);
                            }.bind(this)
                        }
                    >
                        <span className='icon' />
                        <span>Create new {strings.Team} with GitLab Account</span>
                    </a>
            );
        }

        if (this.props.services.indexOf(Constants.EMAIL_SERVICE) !== -1) {
            buttons.push(
                    <a
                        className='btn btn-custom-login email btn-full'
                        href='#'
                        onClick={
                            function clickEmail(e) {
                                e.preventDefault();
                                this.props.updatePage('email', '');
                            }.bind(this)
                        }
                    >
                        <span className='fa fa-envelope' />
                        <span>Create new {strings.Team} with email address</span>
                    </a>
            );
        }

        if (buttons.length === 0) {
            buttons = <span>No sign-up methods configured, please contact your system administrator.</span>;
        }

        return (
            <div>
                {buttons}
                <div className='form-group margin--extra-2x'>
                    <span><a href='/find_team'>{'Find my ' + strings.Team}</a></span>
                </div>
            </div>
        );
    }
}

ChooseAuthPage.defaultProps = {
    services: []
};
ChooseAuthPage.propTypes = {
    services: React.PropTypes.array,
    updatePage: React.PropTypes.func
};
