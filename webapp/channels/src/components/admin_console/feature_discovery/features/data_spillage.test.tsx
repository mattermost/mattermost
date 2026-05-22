// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {LicenseSkus} from 'utils/constants';

import DataSpillageFeatureDiscovery from './data_spillage';

jest.mock('../index', () => ({
    __esModule: true,
    default: jest.fn((props) => (
        <div data-testid='feature-discovery'>
            <div data-testid='feature-name'>{props.featureName}</div>
            <div data-testid='minimum-sku'>{props.minimumSKURequiredForFeature}</div>
            <div data-testid='title'>{props.title.defaultMessage}</div>
            <div data-testid='copy'>{props.copy.defaultMessage}</div>
            <div data-testid='learn-more-url'>{props.learnMoreURL}</div>
            <div data-testid='feature-image'>{props.featureDiscoveryImage}</div>
        </div>
    )),
}));

jest.mock('./images/data_spillage_svg', () => ({
    __esModule: true,
    default: jest.fn((props) => (
        <div data-testid='data-spillage-svg'>
            <div data-testid='data-spillage-svg-width'>{props.width}</div>
            <div data-testid='data-spillage-svg-height'>{props.height}</div>
        </div>
    )),
}));

describe('components/admin_console/feature_discovery/features/DataSpillageFeatureDiscovery', () => {
    it('renders correctly with expected props', () => {
        renderWithContext(<DataSpillageFeatureDiscovery/>);

        expect(screen.getByTestId('feature-name')).toHaveTextContent('data_spillage');
        expect(screen.getByTestId('minimum-sku')).toHaveTextContent(LicenseSkus.EnterpriseAdvanced);
        expect(screen.getByTestId('title')).toHaveTextContent('Handle data spillage with Mattermost Enterprise Advanced');
        expect(screen.getByTestId('copy')).toHaveTextContent(
            'Set up the ability for users to quarantine messages so designated Content Reviewers can decide whether to keep or remove them.',
        );
        expect(screen.getByTestId('learn-more-url')).toHaveTextContent(
            'https://docs.mattermost.com/administration-guide/manage/admin/content-flagging.html',
        );
        expect(screen.getByTestId('data-spillage-svg')).toBeInTheDocument();
        expect(screen.getByTestId('data-spillage-svg-width')).toHaveTextContent('294');
        expect(screen.getByTestId('data-spillage-svg-height')).toHaveTextContent('180');
    });
});
