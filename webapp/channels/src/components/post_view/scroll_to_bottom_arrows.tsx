// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import ScrollToBottomIcon from 'components/widgets/icons/scroll_to_bottom_icon';

interface Props {
    isScrolling: boolean;
    atBottom?: boolean;
    onClick: () => void;
}

export default class ScrollToBottomArrows extends React.PureComponent<Props> {
    render() {
        // only show on mobile
        if (window.innerWidth > 768) {
            return null;
        }

        let className = 'post-list__arrows';
        if (this.props.isScrolling && this.props.atBottom === false) {
            className += ' scrolling';
        }

        return (
            <div
                className={className}
                onClick={this.props.onClick}
            >
                <ScrollToBottomIcon/>
            </div>
        );
    }
}
