// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import AutoTranslationFeatureDiscovery from './auto_translation';

jest.mock('../index', () => {
    const React = require('react');
    const FeatureDiscovery = require('../feature_discovery').default;

    return {
        __esModule: true,
        default: (props: Record<string, unknown>) => (
            <FeatureDiscovery
                {...props}
                stats={{TOTAL_USERS: 20}}
                prevTrialLicense={{IsLicensed: 'true'}}
                isCloud={false}
                isCloudTrial={false}
                hadPrevCloudTrial={false}
                isSubscriptionLoaded={true}
                isPaidSubscription={false}
                isEnterpriseReady={true}
                actions={{
                    getPrevTrialLicense: jest.fn(),
                    getCloudSubscription: jest.fn(),
                    openModal: jest.fn(),
                }}
            />
        ),
    };
});

describe('components/admin_console/feature_discovery/features/AutoTranslationFeatureDiscovery', () => {
    it('renders the Auto-translation discovery card with a Contact sales CTA and a Learn more link to the auto-translation docs', () => {
        renderWithContext(<AutoTranslationFeatureDiscovery/>);

        expect(screen.getByText('Remove language barriers with auto-translation')).toBeInTheDocument();
        expect(screen.getByText(/Effortlessly collaborate across languages/)).toBeInTheDocument();

        expect(screen.getByRole('button', {name: 'Contact sales'})).toBeInTheDocument();
        expect(screen.getByRole('link', {name: 'Learn more'})).toHaveAttribute(
            'href',
            expect.stringContaining('docs.mattermost.com/administration-guide/manage/admin/autotranslation.html'),
        );
        expect(document.querySelector('.FeatureDiscovery_imageWrapper svg')).toBeInTheDocument();
    });
});
