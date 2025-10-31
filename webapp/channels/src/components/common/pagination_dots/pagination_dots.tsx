// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import './pagination_dots.scss';

type Props = {
    totalSteps: number;
    currentStep: number;
};

const PaginationDots = ({totalSteps, currentStep}: Props) => {
    return (
        <div className='pagination-dots'>
            {Array.from({length: totalSteps}).map((_, index) => (
                <div
                    key={index}
                    className={`pagination-dot ${index + 1 === currentStep ? 'active' : ''}`}
                />
            ))}
        </div>
    );
};

export default PaginationDots;

