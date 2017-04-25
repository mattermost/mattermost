// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

// Indicator for the left sidebar which indicate if there's unread posts in a channel that is not shown
// because it is either above or below the screen
import React from 'react';

export default function UnreadChannelIndicator(props) {
    let displayValue = 'none';
    if (props.show) {
        displayValue = 'block';
    }
    return (
        <div
            className={'nav-pills__unread-indicator ' + props.extraClass}
            style={{display: displayValue}}
        >
            {props.text}
        </div>
    );
}

UnreadChannelIndicator.defaultProps = {
    show: false,
    extraClass: '',
    text: ''
};
UnreadChannelIndicator.propTypes = {
    show: React.PropTypes.bool,
    extraClass: React.PropTypes.string,
    text: React.PropTypes.object
};
