// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import ErrorBar from 'components/error_bar.jsx';

import {FormattedMessage} from 'react-intl';
import {browserHistory, Link} from 'react-router/es6';

import React from 'react';

export default class CreateTeamController extends React.Component {
    constructor(props) {
        super(props);

        this.submit = this.submit.bind(this);
        this.updateParent = this.updateParent.bind(this);

        const state = {};
        state.team = {};
        state.wizard = 'display_name';
        this.state = state;
    }

    submit() {
        // todo fill in
    }

    componentDidMount() {
        browserHistory.push('/create_team/display_name');
    }

    updateParent(state) {
        this.setState(state);
        browserHistory.push('/create_team/' + state.wizard);
    }

    render() {
        let description = null;
        if (global.window.mm_license.IsLicensed === 'true' && global.window.mm_license.CustomBrand === 'true' && global.window.mm_config.EnableCustomBrand === 'true') {
            description = global.window.mm_config.CustomDescriptionText;
        } else {
            description = (
                <FormattedMessage
                    id='web.root.signup_info'
                    defaultMessage='All team communication in one place, searchable and accessible anywhere'
                />
            );
        }

        return (
            <div>
                <ErrorBar/>
                <div className='signup-header'>
                    <Link to='/select_team'>
                        <span className='fa fa-chevron-left'/>
                        <FormattedMessage
                            id='web.header.back'
                        />
                    </Link>
                </div>
                <div className='col-sm-12'>
                    <div className='signup-team__container'>
                        <h1>{global.window.mm_config.SiteName}</h1>
                        <h4 className='color--light'>
                            {description}
                        </h4>
                        <div className='signup__content'>
                            {React.cloneElement(this.props.children, {
                                state: this.state,
                                updateParent: this.updateParent
                            })}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

CreateTeamController.propTypes = {
    children: React.PropTypes.node
};
