// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import ClassificationMarkingsFeatureDiscovery from './classification_markings';

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

describe('components/admin_console/feature_discovery/features/ClassificationMarkingsFeatureDiscovery', () => {
    it('renders the Classification Markings discovery card', () => {
        renderWithContext(<ClassificationMarkingsFeatureDiscovery/>);

        expect(screen.getByText('Apply classification markings with Mattermost Enterprise Advanced')).toBeInTheDocument();
        expect(screen.getByText(
            'Set up global and channel-specific classification banners with built-in presets or custom levels, ensuring that users consistently view the appropriate classification level for their workspace.',
        )).toBeInTheDocument();

        expect(screen.getByRole('button', {name: 'Contact sales'})).toBeInTheDocument();
        expect(screen.getByRole('link', {name: 'Learn more'})).toHaveAttribute(
            'href',
            expect.stringContaining('https://docs.mattermost.com/end-user-guide/collaborate/display-channel-banners.html'),
        );
        expect(screen.getByRole('link', {name: 'Learn more'})).toHaveAttribute(
            'href',
            expect.stringContaining('#classification-markings'),
        );
        expect(document.querySelector('.FeatureDiscovery_imageWrapper svg')).toBeInTheDocument();
    });
});
