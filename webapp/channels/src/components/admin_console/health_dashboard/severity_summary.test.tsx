// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, within} from 'tests/react_testing_utils';

import SeveritySummary from './severity_summary';

describe('components/admin_console/health_dashboard/severity_summary', () => {
    test('labels every count with text, keeping unknown separate from the severities', () => {
        renderWithContext(
            <SeveritySummary
                severityCounts={{critical: 3, warning: 2, info: 0}}
                unknownCount={4}
                lastEvaluatedAt={Date.now()}
            />,
        );

        const list = screen.getByRole('list', {name: 'Finding counts'});
        const items = within(list).getAllByRole('listitem');

        expect(items.map((item) => item.textContent)).toEqual(['3 Critical', '2 Warning', '0 Info', '4 Unknown']);
        for (const item of items) {
            expect(item.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
        }
        expect(screen.getByText(/^Last evaluated/)).toBeInTheDocument();
    });
});
