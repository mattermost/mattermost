// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';

import Constants from 'utils/constants.jsx';

import PropTypes from 'prop-types';

import React from 'react';

export default function ScrollToBottomArrows(props) {
    // only show on mobile
    if ($(window).width() > 768) {
        return <noscript/>;
    }

    let className = 'post-list__arrows';
    if (props.isScrolling && !props.atBottom) {
        className += ' scrolling';
    }

    return (
        <div
            className={className}
            onClick={props.onClick}
        >
            <span dangerouslySetInnerHTML={{__html: Constants.SCROLL_BOTTOM_ICON}}/>
        </div>
    );
}

ScrollToBottomArrows.propTypes = {
    isScrolling: PropTypes.bool.isRequired,
    atBottom: PropTypes.bool.isRequired,
    onClick: PropTypes.func.isRequired
};
