// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentType} from 'react';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

import withGetCloudSubscription from './with_get_cloud_subscription';

describe('/components/common/hocs/with_get_cloud_subcription', () => {
    let TestComponent: ComponentType;

    beforeEach(() => {
        TestComponent = () => <div/>;
    });

    test('should call the getCloudSubscription when cloud license is being used and no subscription was fetched', () => {
        const EnhancedComponent = withGetCloudSubscription(TestComponent);
        const actions = {
            getCloudSubscription: vi.fn(),
        };

        renderWithContext(
            <EnhancedComponent
                isCloud={true}
                actions={actions}
                subscription={{}}
                userIsAdmin={true}
            />,
        );

        expect(actions.getCloudSubscription).toHaveBeenCalledTimes(1);
    });

    test('should NOT call the getCloudSubscription when NOT cloud licenced', () => {
        const EnhancedComponent = withGetCloudSubscription(TestComponent);
        const actions = {
            getCloudSubscription: vi.fn(),
        };

        renderWithContext(
            <EnhancedComponent
                isCloud={false}
                actions={actions}
                subscription={{}}
                userIsAdmin={true}
            />,
        );

        expect(actions.getCloudSubscription).toHaveBeenCalledTimes(0);
    });

    test('should NOT call the getCloudSubscription when user is NOT admin', () => {
        const EnhancedComponent = withGetCloudSubscription(TestComponent);
        const actions = {
            getCloudSubscription: vi.fn(),
        };

        renderWithContext(
            <EnhancedComponent
                isCloud={true}
                actions={actions}
                subscription={{}}
                userIsAdmin={false}
            />,
        );

        expect(actions.getCloudSubscription).toHaveBeenCalledTimes(0);
    });
});
