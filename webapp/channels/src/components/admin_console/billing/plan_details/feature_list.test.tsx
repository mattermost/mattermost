// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';
import {CloudProducts} from 'utils/constants';
import {makeEmptyLimits, makeEmptyUsage} from 'utils/limits_test';

import FeatureList from './feature_list';
import type {FeatureListProps} from './feature_list';

function renderFeatureListComponent(props: FeatureListProps) {
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
    test('should render features for FREE tier', () => {
        renderFeatureListComponent({
            subscriptionPlan: CloudProducts.STARTER,
        });

        // Verify some of the FREE tier features are displayed
        expect(screen.getByText(/Group and one-to-one messaging/)).toBeInTheDocument();
        expect(screen.getByText(/Incident collaboration/)).toBeInTheDocument();

        // Count the number of features
        const features = screen.getAllByText(/^.*$/, {selector: 'div.PlanDetailsFeature > span'});
        expect(features.length).toBeGreaterThan(0);
    });

    test('should render features for PROFESSIONAL tier', () => {
        renderFeatureListComponent({
            subscriptionPlan: CloudProducts.PROFESSIONAL,
        });

        // Verify some of the PROFESSIONAL tier features are displayed
        expect(screen.getByText(/Unlimited file storage/)).toBeInTheDocument();
        expect(screen.getByText(/Guest Accounts/)).toBeInTheDocument();
        expect(screen.getByText(/AD\/LDAP user sync/)).toBeInTheDocument();

        // Count the number of features
        const features = screen.getAllByText(/^.*$/, {selector: 'div.PlanDetailsFeature > span'});
        expect(features.length).toBeGreaterThan(0);
    });

    test('should render features for ENTERPRISE tier', () => {
        renderFeatureListComponent({
            subscriptionPlan: CloudProducts.ENTERPRISE,
        });

        // Verify some of the ENTERPRISE tier features are displayed
        expect(screen.getByText(/Enterprise administration & SSO/)).toBeInTheDocument();
        expect(screen.getByText(/Automated compliance exports/)).toBeInTheDocument();

        // Count the number of features
        const features = screen.getAllByText(/^.*$/, {selector: 'div.PlanDetailsFeature > span'});
        expect(features.length).toBeGreaterThan(0);
    });

    test('all feature items should have different values', () => {
        // Test for ENTERPRISE tier
        const {unmount: unmountEnterprise} = renderFeatureListComponent({
            subscriptionPlan: CloudProducts.ENTERPRISE,
        });

        const enterpriseFeatures = screen.getAllByText(/^.*$/, {selector: 'div.PlanDetailsFeature > span'}).
            map((element) => element.textContent);

        const hasDuplicatesEnterprise = enterpriseFeatures.length !== new Set(enterpriseFeatures).size;
        expect(hasDuplicatesEnterprise).toBeFalsy();

        unmountEnterprise();

        // Test for STARTER tier
        const {unmount: unmountStarter} = renderFeatureListComponent({
            subscriptionPlan: CloudProducts.STARTER,
        });

        const starterFeatures = screen.getAllByText(/^.*$/, {selector: 'div.PlanDetailsFeature > span'}).
            map((element) => element.textContent);

        const hasDuplicatesStarter = starterFeatures.length !== new Set(starterFeatures).size;
        expect(hasDuplicatesStarter).toBeFalsy();

        unmountStarter();

        // Test for PROFESSIONAL tier
        const {unmount: unmountProfessional} = renderFeatureListComponent({
            subscriptionPlan: CloudProducts.PROFESSIONAL,
        });

        const professionalFeatures = screen.getAllByText(/^.*$/, {selector: 'div.PlanDetailsFeature > span'}).
            map((element) => element.textContent);

        const hasDuplicatesProfessional = professionalFeatures.length !== new Set(professionalFeatures).size;
        expect(hasDuplicatesProfessional).toBeFalsy();

        unmountProfessional();
    });

    test('should render nothing for unknown subscription plan', () => {
        renderFeatureListComponent({
            subscriptionPlan: 'unknown-plan',
        });

        const features = screen.queryAllByText(/^.*$/, {selector: 'div.PlanDetailsFeature > span'});
        expect(features.length).toBe(0);
    });
});
