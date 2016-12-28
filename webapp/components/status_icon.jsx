// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

export default class StatusIcon extends React.Component {
    render() {
        const status = this.props.status;

        if (!status) {
            return null;
        }

        let statusIcon;
        if (status === 'online') {
            statusIcon = <i className='uchat-icons-person_online online--icon'/>;
        } else if (status === 'away') {
            statusIcon = <i className='uchat-icons-person_away away--icon'/>;
        } else {
            statusIcon = <i className='uchat-icons-person_offline'/>;
        }

        return (
            <span className='status'>
                {statusIcon}
            </span>
        );
    }

}

StatusIcon.propTypes = {
    status: React.PropTypes.string.isRequired
};