// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';
import {CloudProducts} from 'utils/constants';
import {makeEmptyLimits, makeEmptyUsage} from 'utils/limits_test';

import FeatureList from './feature_list';
import type {FeatureListProps} from './feature_list';

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

function renderFeatureList(props: FeatureListProps) {
    return renderWithContext(
        <FeatureList {...props}/>,
        state,
    );
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

    test('all feature items must have different values', () => {
        const plans = [
            CloudProducts.PROFESSIONAL,
            CloudProducts.ENTERPRISE,
            CloudProducts.STARTER,
            CloudProducts.PROFESSIONAL,
        ];

        plans.forEach((plan) => {
            const {container} = renderFeatureList({
                subscriptionPlan: plan,
            });

            const featuresSpanElements = container.querySelectorAll('div.PlanDetailsFeature > span');
            if (featuresSpanElements.length === 0) {
                console.error('No features found');
                expect(featuresSpanElements.length).toBeTruthy();
                return;
            }
            const featuresTexts = Array.from(featuresSpanElements).map((element) => element.textContent);

            const hasDuplicates = (arr: Array<string | null>) => arr.length !== new Set(arr).size;

            expect(hasDuplicates(featuresTexts)).toBeFalsy();
        });
    });
});
