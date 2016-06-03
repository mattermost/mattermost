// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Constants from 'utils/constants.jsx';

import React from 'react';

export default class StatusIcon extends React.Component {
    render() {
        const status = this.props.status;

        if (!status) {
            return null;
        }

        let statusIcon = '';
        if (status === 'online') {
            statusIcon = Constants.ONLINE_ICON_SVG;
        } else if (status === 'away') {
            statusIcon = Constants.AWAY_ICON_SVG;
        } else {
            statusIcon = Constants.OFFLINE_ICON_SVG;
        }

        return (
            <span
                className='status'
                dangerouslySetInnerHTML={{__html: statusIcon}}
            />
        );
    }

}

StatusIcon.propTypes = {
    status: React.PropTypes.string.isRequired
};