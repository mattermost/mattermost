// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {PaginationDots as CompassPaginationDots} from '@mattermost/compass-ui/components/pagination-dots';
import type {PaginationDotsProps as CompassPaginationDotsProps} from '@mattermost/compass-ui/components/pagination-dots';

type Props = Pick<
    CompassPaginationDotsProps,
    'orientation' | 'dotStyle' | 'className' | 'label' | 'formatPageLabel'
> & {
    totalSteps: number;
    currentStep: number;
};

/**
 * Adapter for legacy `totalSteps` / `currentStep` callers.
 * New code should use PaginationDots from '@mattermost/compass-ui/components/pagination-dots' directly.
 */
const PaginationDots = ({totalSteps, currentStep, ...compassProps}: Props) => {
    return (
        <CompassPaginationDots
            pages={totalSteps}
            activePage={currentStep}
            {...compassProps}
        />
    );
};

export default PaginationDots;
