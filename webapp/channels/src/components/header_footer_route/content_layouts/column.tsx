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
}

const Column = ({title, message, SVGElement, extraContent, onEnterKeyDown}: ColumnProps) => {
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
            <h1 className='content-layout-column-title'>
                {title}
            </h1>
            <p className='content-layout-column-message'>
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
