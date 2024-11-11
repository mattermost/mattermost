// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo, useState} from 'react';

import {makeIsEligibleForClick} from 'utils/utils';

import './panel.scss';

type Props = {
    children: ({hover}: {hover: boolean}) => React.ReactNode;
    onClick: () => void;
    hasError: boolean;
    innerRef?: React.Ref<HTMLElement>;
    isHighlighted?: boolean;
};

const isEligibleForClick = makeIsEligibleForClick('.hljs, code');

function Panel({
    children,
    onClick,
    hasError,
    innerRef,
    isHighlighted,
}: Props) {
    const [hover, setHover] = useState(false);

    const handleMouseOver = () => {
        setHover(true);
    };

    const handleMouseLeave = () => {
        setHover(false);
    };

    const handleOnClick = (e: React.MouseEvent<HTMLElement>) => {
        if (isEligibleForClick(e)) {
            onClick();
        }
    };

    return (
        <article
            className={classNames(
                'Panel',
                {
                    draftError: hasError,
                    highlighted: isHighlighted,
                },
            )}
            onMouseOver={handleMouseOver}
            onClick={handleOnClick}
            onMouseLeave={handleMouseLeave}
            role='button'
            ref={innerRef}
        >
            {children({hover})}
        </article>
    );
}

export default memo(Panel);
