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
    innerRef?: React.Ref<HTMLDivElement>;
    isHighlighted?: boolean;
    style?: React.CSSProperties;
    className?: string;
    dataTestId?: string;
    dataPostId?: string;
    ariaLabel?: string;
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
    dataTestId,
    dataPostId,
    ariaLabel,
}: Props) {
    const handleOnClick = (e: React.MouseEvent<HTMLElement>) => {
        if (isEligibleForClick(e)) {
            onClick();
        }
    };

    const handleOnKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
            onClick();
        }
    };

    return (
        <div
            data-testid={dataTestId}
            data-postid={dataPostId}
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
            onKeyDown={handleOnKeyDown}
            role='link'
            tabIndex={0}
            ref={innerRef}
            aria-label={ariaLabel}
        >
            {children}
        </div>
    );
}

export default memo(Panel);
