// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';

import ScrollToBottomIcon from 'components/widgets/icons/scroll_to_bottom_icon';

type Props = {
    isScrolling: boolean;
    atBottom?: boolean;
    onClick: () => void;
};

const ScrollToBottomArrows = ({isScrolling, atBottom, onClick}: Props) => {
    // only show on mobile
    if (window.innerWidth > 768) {
        return null;
    }

    return (
        <div
            className={classNames('post-list__arrows', {
                scrolling: isScrolling && atBottom === false,
            })}
            onClick={onClick}
        >
            <ScrollToBottomIcon/>
        </div>
    );
};

export default ScrollToBottomArrows;
