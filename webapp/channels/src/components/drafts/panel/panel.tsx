// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo} from 'react';

import {makeIsEligibleForClick} from 'utils/utils';

import './panel.scss';

type Props = {
    children: React.ReactNode;
    onClick: () => void;
    hasError: boolean;
    innerRef?: React.Ref<HTMLElement>;
    isHighlighted?: boolean;
    style?: React.CSSProperties;
    className?: string;
};

const isEligibleForClick = makeIsEligibleForClick('.hljs, code');

function Panel({
    children,
    onClick,
    hasError,
    innerRef,
    isHighlighted,
    style,
    className,
}: Props) {
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
                className,
            )}
            style={style}
            onClick={handleOnClick}
            role='button'
            ref={innerRef}
        >
            {children}
        </article>
    );
}

export default memo(Panel);
