// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import ScrollToBottomIcon from 'components/widgets/icons/scroll_to_bottom_icon';

type Props = {
    isScrolling: boolean;
    atBottom?: boolean;
    onClick: () => void;
}

const ScrollToBottomArrows = ({ isScrolling, atBottom, onClick }:Props) => {
    // only show on mobile
    if (window.innerWidth > 768) {
        return null;
    }

    let className = 'post-list__arrows';
    if (isScrolling && atBottom === false) {
        className += ' scrolling';
    }

    return (
        <div
            className={className}
            onClick={onClick}
        >
            <ScrollToBottomIcon />
        </div>
    );
}

export default ScrollToBottomArrows;
