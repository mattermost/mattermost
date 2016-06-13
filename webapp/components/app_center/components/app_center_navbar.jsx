// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router';

export default class AppCenterNavbar extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            team: this.props.team
        };
    }

    componentWillReceiveProps(nextProps) {
        if (this.props.team !== nextProps.team) {
            this.setState({
                team: nextProps.team
            });
        }
    }

    render() {
        if (!this.state.team) {
            return null;
        }

        return (
            <div
                className='appcenter-navbar'
                style={{textAlign: 'center'}}
            >
                <div style={{position: 'absolute'}}>
                    <Link
                        className='appcenter-navbar__back'
                        to={`/${this.state.team.name}/channels/town-square`}
                    >
                        <i className='fa fa-angle-left'/>
                        <span>
                            <FormattedMessage
                                id='appcenter_navbar.backToMattermost'
                                defaultMessage='Back to {teamName} Team'
                                values={{
                                    teamName: this.state.team.display_name
                                }}
                            />
                        </span>
                    </Link>
                </div>
                <span>{global.window.mm_config.SampleAppAppDisplayName}</span>
            </div>
        );
    }
}

AppCenterNavbar.propTypes = {
    team: React.PropTypes.object.isRequired
};