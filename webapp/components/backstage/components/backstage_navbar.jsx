import PropTypes from 'prop-types';

// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router/es6';

export default class BackstageNavbar extends React.Component {
    static get propTypes() {
        return {
            team: PropTypes.object.isRequired
        };
    }

    render() {
        if (!this.props.team) {
            return null;
        }

        return (
            <div className='backstage-navbar'>
                <Link
                    className='backstage-navbar__back'
                    to={`/${this.props.team.name}/channels/town-square`}
                >
                    <i className='fa fa-angle-left'/>
                    <span>
                        <FormattedMessage
                            id='backstage_navbar.backToMattermost'
                            defaultMessage='Back to {siteName}'
                            values={{
                                siteName: global.window.mm_config.SiteName
                            }}
                        />
                    </span>
                </Link>
            </div>
        );
    }
}
