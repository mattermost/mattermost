// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Constants from 'utils/constants.jsx';

import React from 'react';

export default class StatusIcon extends React.Component {
    render() {
        const status = this.props.status;
        const type = this.props.type;

        if (!status) {
            return null;
        }

        let statusIcon = '';
        if (type === 'avatar') {
            if (status === 'online') {
                statusIcon = Constants.ONLINE_AVATAR_SVG;
            } else if (status === 'away') {
                statusIcon = Constants.AWAY_AVATAR_SVG;
            } else {
                statusIcon = Constants.OFFLINE_AVATAR_SVG;
            }
        } else if (status === 'online') {
            statusIcon = Constants.ONLINE_ICON_SVG;
        } else if (status === 'away') {
            statusIcon = Constants.AWAY_ICON_SVG;
        } else {
            statusIcon = Constants.OFFLINE_ICON_SVG;
        }

        return (
            <span
                className={'status ' + this.props.className}
                dangerouslySetInnerHTML={{__html: statusIcon}}
            />
        );
    }

}

StatusIcon.defaultProps = {
    className: ''
};

StatusIcon.propTypes = {
    status: React.PropTypes.string,
    className: React.PropTypes.string,
    type: React.PropTypes.string
};
