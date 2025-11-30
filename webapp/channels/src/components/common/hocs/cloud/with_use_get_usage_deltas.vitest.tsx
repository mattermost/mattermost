// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentType} from 'react';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

import withUseGetUsageDeltas from './with_use_get_usage_deltas';

vi.mock('components/common/hooks/useGetUsageDeltas', () => ({
    default: vi.fn(() => ({
        teams: {
            active: -1,
        },
    })),
}));

describe('/components/common/hocs/cloud/with_use_get_usage_deltas', () => {
    const TestComponent: ComponentType<{usageDeltas?: unknown}> = vi.fn((props) => (
        <div
            data-testid='test-component'
            data-usage={JSON.stringify(props.usageDeltas)}
        />
    ));

    test('should pass the useGetUsageDeltas', () => {
        const WrappedComponent = withUseGetUsageDeltas(TestComponent);

        const {container} = renderWithContext(
            <WrappedComponent/>,
        );

        expect(container.querySelector('[data-testid="test-component"]')).toBeInTheDocument();
        expect(TestComponent).toHaveBeenCalled();
    });
});
