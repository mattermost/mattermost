// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen} from '@testing-library/react';

import {renderWithContext} from 'tests/react_testing_utils';
import ChipsList from 'components/admin_console/workspace-optimization/chips_list';
import type {ChipsInfoType} from 'components/admin_console/workspace-optimization/chips_list';

import {ItemStatus} from './dashboard.type';

describe('components/admin_console/workspace-optimization/chips_list', () => {
    const overallScoreChips: ChipsInfoType = {
        [ItemStatus.INFO]: 3,
        [ItemStatus.WARNING]: 2,
        [ItemStatus.ERROR]: 1,
    };

    const baseProps = {
        chipsData: overallScoreChips,
        hideCountZeroChips: false,
    };

    test('should render all chips with correct counts', () => {
        renderWithContext(<ChipsList {...baseProps}/>);
        
        expect(screen.getByText('Suggestions: 3')).toBeInTheDocument();
        expect(screen.getByText('Warnings: 2')).toBeInTheDocument();
        expect(screen.getByText('Problems: 1')).toBeInTheDocument();
        
        // Verify we have 3 button elements (chips)
        const buttons = screen.getAllByRole('button');
        expect(buttons).toHaveLength(3);
        
        // Check class names
        expect(buttons[0]).toHaveClass('info');
        expect(buttons[1]).toHaveClass('warning');
        expect(buttons[2]).toHaveClass('error');
    });

    test('should hide chips with zero count when hideCountZeroChips is true', () => {
        const zeroErrorProps = {
            chipsData: {...overallScoreChips, [ItemStatus.ERROR]: 0},
            hideCountZeroChips: true,
        };
        
        renderWithContext(<ChipsList {...zeroErrorProps}/>);
        
        expect(screen.getByText('Suggestions: 3')).toBeInTheDocument();
        expect(screen.getByText('Warnings: 2')).toBeInTheDocument();
        expect(screen.queryByText('Problems: 0')).not.toBeInTheDocument();
        
        // Verify we have only 2 button elements (chips)
        const buttons = screen.getAllByRole('button');
        expect(buttons).toHaveLength(2);
    });

    test('should show all chips even with zero counts when hideCountZeroChips is false', () => {
        const zeroErrorProps = {
            chipsData: {...overallScoreChips, [ItemStatus.ERROR]: 0},
            hideCountZeroChips: false,
        };
        
        renderWithContext(<ChipsList {...zeroErrorProps}/>);
        
        expect(screen.getByText('Suggestions: 3')).toBeInTheDocument();
        expect(screen.getByText('Warnings: 2')).toBeInTheDocument();
        expect(screen.getByText('Problems: 0')).toBeInTheDocument();
        
        // Verify we have all 3 button elements (chips)
        const buttons = screen.getAllByRole('button');
        expect(buttons).toHaveLength(3);
    });
});
