// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import DataSpillageFeatureDiscovery from './data_spillage';

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

describe('components/admin_console/feature_discovery/features/DataSpillageFeatureDiscovery', () => {
    it('renders the Data Spillage discovery card', () => {
        renderWithContext(<DataSpillageFeatureDiscovery/>);

        expect(screen.getByText('Handle data spillage with Mattermost Enterprise Advanced')).toBeInTheDocument();
        expect(screen.getByText(
            'Set up the ability for users to quarantine messages so designated Content Reviewers can decide whether to keep or remove them.',
        )).toBeInTheDocument();

        expect(screen.getByRole('button', {name: 'Contact sales'})).toBeInTheDocument();
        expect(screen.getByRole('link', {name: 'Learn more'})).toHaveAttribute(
            'href',
            expect.stringContaining('https://docs.mattermost.com/administration-guide/manage/admin/content-flagging.html'),
        );
        expect(document.querySelector('.FeatureDiscovery_imageWrapper svg')).toBeInTheDocument();
    });
});
