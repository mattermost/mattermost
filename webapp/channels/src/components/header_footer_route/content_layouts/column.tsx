// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {type ReactNode} from 'react';

import Constants from 'utils/constants';

import './column.scss';

type ColumnProps = {
    title: ReactNode;
    message: ReactNode;
    SVGElement?: React.ReactNode;
    extraContent?: React.ReactNode;
    onEnterKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;

    // The title renders `<testId>.title--text` and the message `<testId>.message--text`. The container takes no testid:
    // it handles Enter without a role (an accessibility fix, not a test-surface one).
    testId?: string;
};

const Column = ({title, message, SVGElement, extraContent, onEnterKeyDown, testId}: ColumnProps) => {
    const handleOnEnterKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (onEnterKeyDown && e.key === Constants.KeyCodes.ENTER[0]) {
            onEnterKeyDown(e);
        }
    };

    return (
        <div
            className='content-layout-column'
            onKeyDown={handleOnEnterKeyDown}
            tabIndex={0}
        >
            <div className='content-layout-column-svg'>
                {SVGElement}
            </div>
            <h1
                className='content-layout-column-title'
                data-testid={testId ? `${testId}.title--text` : undefined}
            >
                {title}
            </h1>
            <p
                className='content-layout-column-message'
                data-testid={testId ? `${testId}.message--text` : undefined}
            >
                {message}
            </p>
            {extraContent && (
                <div className='content-layout-column-extra-content'>
                    {extraContent}
                </div>
            )}
        </div>
    );
};

export default Column;
