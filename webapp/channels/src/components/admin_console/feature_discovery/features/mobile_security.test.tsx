// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {LicenseSkus} from 'utils/constants';

import MobileSecurityFeatureDiscovery from './mobile_security';

// Mock the FeatureDiscovery component
jest.mock('../index', () => ({
    __esModule: true,
    default: jest.fn((props) => {
        // Render a simple div with key props for testing
        return (
            <div data-testid='feature-discovery'>
                <div data-testid='feature-name'>{props.featureName}</div>
                <div data-testid='minimum-sku'>{props.minimumSKURequiredForFeature}</div>
                <div data-testid='title'>{props.title.defaultMessage}</div>
                <div data-testid='copy'>{props.copy.defaultMessage}</div>
                <div data-testid='learn-more-url'>{props.learnMoreURL}</div>
                <div data-testid='feature-image'>{props.featureDiscoveryImage}</div>
            </div>
        );
    }),
}));

// Mock the SVG component
jest.mock('./images/mobile_security_svg', () => ({
    __esModule: true,
    default: jest.fn((props) => (
        <div data-testid='mobile-security-svg'>
            <div data-testid='mobile-security-svg-width'>{props.width}</div>
            <div data-testid='mobile-security-svg-height'>{props.height}</div>
        </div>
    )),
}));

describe('components/admin_console/feature_discovery/features/MobileSecurityFeatureDiscovery', () => {
    it('renders correctly with expected props', () => {
        renderWithContext(<MobileSecurityFeatureDiscovery/>);

        // Verify feature name
        expect(screen.getByTestId('feature-name')).toHaveTextContent('mobile_security');

        // Verify minimum SKU
        expect(screen.getByTestId('minimum-sku')).toHaveTextContent(LicenseSkus.Enterprise);

        // Verify title
        expect(screen.getByTestId('title')).toHaveTextContent('Enhance mobile app security with Mattermost Enterprise');

        // Verify copy text
        expect(screen.getByTestId('copy')).toHaveTextContent(
            'Enable advanced security features like biometric authentication, screen capture prevention, and jailbreak/root detection for your mobile users.',
        );

        // Verify learn more URL
        expect(screen.getByTestId('learn-more-url')).toHaveTextContent(
            'https://docs.mattermost.com/configure/environment-configuration-settings.html#mobile-security',
        );

        // Verify SVG is rendered
        expect(screen.getByTestId('mobile-security-svg')).toBeInTheDocument();
        expect(screen.getByTestId('mobile-security-svg-width')).toHaveTextContent('294');
        expect(screen.getByTestId('mobile-security-svg-height')).toHaveTextContent('170');
    });
});
