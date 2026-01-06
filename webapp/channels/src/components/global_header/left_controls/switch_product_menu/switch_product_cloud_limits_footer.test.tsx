// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {
    renderWithContext,
    screen,
} from 'tests/react_testing_utils';
import {LimitTypes, limitThresholds} from 'utils/limits';

import ProductSwitcherCloudLimitsFooter from './switch_product_cloud_limits_footer';

jest.mock('components/common/hooks/useGetLimits', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('components/common/hooks/useGetUsage', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('components/common/hooks/useGetHighestThresholdCloudLimit', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('components/common/hooks/useWords', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useDispatch: jest.fn().mockReturnValue(jest.fn()),
}));

const mockUseGetHighestThresholdCloudLimit = require('components/common/hooks/useGetHighestThresholdCloudLimit').default;
const mockUseGetLimits = require('components/common/hooks/useGetLimits').default;
const mockUseGetUsage = require('components/common/hooks/useGetUsage').default;
const mockUseWords = require('components/common/hooks/useWords').default;

const messageLimit = 10000;
const warnMessageUsage = Math.ceil((limitThresholds.warn / 100) * messageLimit) + 1;

describe('ProductSwitcherCloudLimitsFooter', () => {
    const defaultUsage = {
        files: {
            totalStorage: 0,
            totalStorageLoaded: true,
        },
        messages: {
            history: 0,
            historyLoaded: true,
        },
        teams: {
            active: 0,
            cloudArchived: 0,
            teamsLoaded: true,
        },
    };

    const defaultLimits = {
        messages: {
            history: messageLimit,
        },
        files: {
            total_storage: 1_000_000_000,
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockUseGetLimits.mockReturnValue([defaultLimits, true]);
        mockUseGetUsage.mockReturnValue(defaultUsage);
    });

    test('should not show when cloud licensed and not on free trial', () => {
        renderWithContext(
            <ProductSwitcherCloudLimitsFooter
                isUserAdmin={true}
                isCloudLicensed={true}
                isFreeTrialSubscription={false}
            />,
        );

        expect(screen.queryByText('Total messages')).not.toBeInTheDocument();
    });

    test('should not show when there is no highest limit', () => {
        mockUseGetHighestThresholdCloudLimit.mockReturnValue(false);

        renderWithContext(
            <ProductSwitcherCloudLimitsFooter
                isUserAdmin={true}
                isCloudLicensed={false}
                isFreeTrialSubscription={false}
            />,
        );

        expect(screen.queryByText('Total messages')).not.toBeInTheDocument();
    });

    test('should display the limit details when a limit needs attention', () => {
        mockUseGetHighestThresholdCloudLimit.mockReturnValue({
            id: LimitTypes.messageHistory,
            limit: messageLimit,
            usage: warnMessageUsage,
        });
        mockUseWords.mockReturnValue({
            title: 'Total messages',
            description: "You're getting closer to the free limit.",
            status: '8K',
        });

        renderWithContext(
            <ProductSwitcherCloudLimitsFooter
                isUserAdmin={true}
                isCloudLicensed={false}
                isFreeTrialSubscription={false}
            />,
        );

        expect(screen.getByText('Total messages')).toBeInTheDocument();
        expect(screen.getByText("You're getting closer to the free limit.")).toBeInTheDocument();
        expect(screen.getByText('8K')).toBeInTheDocument();
    });
});
