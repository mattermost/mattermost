// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import TeamStore from 'stores/team_store.jsx';

import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router';

export default class BackstageNavbar extends React.Component {
    constructor(props) {
        super(props);

        this.handleChange = this.handleChange.bind(this);

        this.state = {
            team: TeamStore.getCurrent()
        };
    }

    componentDidMount() {
        TeamStore.addChangeListener(this.handleChange);
    }

    componentWillUnmount() {
        TeamStore.removeChangeListener(this.handleChange);
    }

    handleChange() {
        this.setState({
            team: TeamStore.getCurrent()
        });
    }

    render() {
        if (!this.state.team) {
            return null;
        }

        return (
            <div className='backstage__navbar row'>
                <Link
                    className='backstage__navbar__back'
                    to={`/${this.state.team.display_name}/channels/town-square`}
                >
                    <i className='fa fa-angle-left'/>
                    <span>
                        <FormattedMessage
                            id='backstage.back_to_mattermost'
                            defaultMessage='Back to {siteName}'
                            values={{
                                siteName: global.window.mm_config.SiteName
                            }}
                        />
                    </span>
                </Link>
                <span style={{float: 'right'}}>{'TODO: Switch Teams'}</span>
            </div>
        );
    }
}
