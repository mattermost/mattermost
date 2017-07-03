// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import PropTypes from 'prop-types';

import React from 'react';

export default function StatusIcon(props) {
    const status = props.status;
    if (!status) {
        return null;
    }

    let statusIcon = '';
    if (status === 'online') {
        statusIcon = <i className='fa fa-circle'/>;
    } else if (status === 'away') {
        statusIcon = <i className='fa fa-clock-o'/>;
    } else {
        statusIcon = <i className='fa fa-circle-o'/>;
    }

    return (
        <span className={'status status--' + props.status}>{statusIcon}</span>
    );
}

StatusIcon.defaultProps = {
    className: ''
};

StatusIcon.propTypes = {
    status: PropTypes.string,
    className: PropTypes.string,
    type: PropTypes.string
};
