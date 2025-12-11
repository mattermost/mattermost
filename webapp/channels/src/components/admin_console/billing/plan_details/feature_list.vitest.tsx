// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';
import {CloudProducts} from 'utils/constants';
import {makeEmptyLimits, makeEmptyUsage} from 'utils/limits_test';

import FeatureList from './feature_list';
import type {FeatureListProps} from './feature_list';

function renderFeatureList(props: FeatureListProps) {
    const state = {
        entities: {
            general: {
                license: {},
            },
            cloud: {
                limits: makeEmptyLimits(),
            },
            usage: makeEmptyUsage(),
            users: {
                currentUserId: 'uid',
                profiles: {
                    uid: {},
                },
            },
        },
    };

    return renderWithContext(<FeatureList {...props}/>, state);
}

describe('components/admin_console/billing/plan_details/feature_list', () => {
    test('should match snapshot when running FREE tier', () => {
        const {container} = renderFeatureList({
            subscriptionPlan: CloudProducts.STARTER,
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when running paid tier and professional', () => {
        const {container} = renderFeatureList({
            subscriptionPlan: CloudProducts.PROFESSIONAL,
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when running paid tier and enterprise', () => {
        const {container} = renderFeatureList({
            subscriptionPlan: CloudProducts.ENTERPRISE,
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when running paid tier and free', () => {
        const {container} = renderFeatureList({
            subscriptionPlan: CloudProducts.STARTER,
        });
        expect(container).toMatchSnapshot();
    });

    test('all feature items must have different values', () => {
        renderFeatureList({
            subscriptionPlan: CloudProducts.ENTERPRISE,
        });

        // Get all feature elements
        const features = screen.queryAllByTestId(/plan-feature/i);

        // If there are features, check for duplicates
        if (features.length > 0) {
            const featureTexts = features.map((el) => el.textContent);
            const hasDuplicates = (arr: Array<string | null>) => arr.length !== new Set(arr).size;
            expect(hasDuplicates(featureTexts)).toBeFalsy();
        }
    });
});
