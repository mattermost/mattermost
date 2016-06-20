// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';

import Constants from 'utils/constants.jsx';

import React from 'react';

export default class ScrollToBottomArrows extends React.Component {
    render() {
        // only show on mobile
        if ($(window).width() > 768) {
            return <noscript/>;
        }

        let className = 'post-list__arrows';
        if (this.props.isScrolling && !this.props.atBottom) {
            className += ' scrolling';
        }

        return (
            <div
                className={className}
                onClick={this.props.onClick}
            >
                <span dangerouslySetInnerHTML={{__html: Constants.SCROLL_BOTTOM_ICON}}/>
            </div>
        );
    }
}

ScrollToBottomArrows.propTypes = {
    isScrolling: React.PropTypes.bool.isRequired,
    atBottom: React.PropTypes.bool.isRequired,
    onClick: React.PropTypes.func.isRequired
};
