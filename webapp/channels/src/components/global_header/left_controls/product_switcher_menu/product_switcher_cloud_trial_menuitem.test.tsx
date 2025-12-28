// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Product, Subscription} from '@mattermost/types/cloud';
import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {CloudProducts} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import ProductSwitcherCloudTrialMenuItem from './product_switcher_cloud_trial_menuitem';

jest.mock('components/common/hooks/useGetLimits', () => ({
    __esModule: true,
    default: jest.fn().mockReturnValue([{}, true]),
}));

jest.mock('components/common/hooks/useGetUsage', () => ({
    __esModule: true,
    default: jest.fn().mockReturnValue({
        files: {totalStorage: 0, totalStorageLoaded: true},
        messages: {history: 0, historyLoaded: true},
        teams: {active: 0, teamsLoaded: true},
    }),
}));

jest.mock('components/common/hooks/useGetHighestThresholdCloudLimit', () => ({
    __esModule: true,
    default: jest.fn().mockReturnValue(false),
}));

const mockOpenPricingModal = jest.fn();
jest.mock('components/common/hooks/useOpenPricingModal', () => ({
    __esModule: true,
    default: jest.fn(() => ({
        openPricingModal: mockOpenPricingModal,
        isAirGapped: false,
    })),
}));

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useDispatch: jest.fn().mockReturnValue(jest.fn()),
}));

const mockUseGetHighestThresholdCloudLimit = require('components/common/hooks/useGetHighestThresholdCloudLimit').default;
const mockUseOpenPricingModal = require('components/common/hooks/useOpenPricingModal').default;

describe('ProductSwitcherCloudTrialMenuItem', () => {
    const initialState: DeepPartial<GlobalState> = {
        entities: {
            users: {
                currentUserId: 'user_id',
                profiles: {
                    user_id: TestHelper.getUserMock({id: 'user_id'}),
                },
            },
            cloud: {
                subscription: {
                    product_id: 'prod_starter',
                    trial_end_at: 0,
                } as Subscription,
                products: {
                    prod_starter: {
                        id: 'prod_starter',
                        name: 'Cloud Starter',
                        sku: CloudProducts.STARTER,
                    } as Product,
                },
            },
            admin: {
                prevTrialLicense: {
                    IsLicensed: 'false',
                },
            },
            general: {
                license: {},
                config: {},
            },
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockUseGetHighestThresholdCloudLimit.mockReturnValue(false);
        mockUseOpenPricingModal.mockReturnValue({
            openPricingModal: mockOpenPricingModal,
            isAirGapped: false,
        });
    });

    test('should not show when not cloud licensed', () => {
        renderWithContext(
            <ProductSwitcherCloudTrialMenuItem
                isUserAdmin={true}
                isCloudLicensed={false}
                isFreeTrialSubscription={false}
            />,
            initialState,
        );

        expect(screen.queryByText('Enterprise Advanced Trial')).not.toBeInTheDocument();
        expect(screen.queryByText('Interested in a limitless plan with high-security features?')).not.toBeInTheDocument();
    });

    test('should not show when some limit needs attention', () => {
        mockUseGetHighestThresholdCloudLimit.mockReturnValue({
            id: 'messageHistory',
            limit: 10000,
            usage: 9000,
        });

        renderWithContext(
            <ProductSwitcherCloudTrialMenuItem
                isUserAdmin={true}
                isCloudLicensed={true}
                isFreeTrialSubscription={false}
            />,
            initialState,
        );

        expect(screen.queryByText('Enterprise Advanced Trial')).not.toBeInTheDocument();
        expect(screen.queryByText('Interested in a limitless plan with high-security features?')).not.toBeInTheDocument();
    });

    test('should not show when not on starter and not on free trial', () => {
        const state: DeepPartial<GlobalState> = {
            entities: {
                ...initialState.entities,
                cloud: {
                    subscription: {
                        product_id: 'prod_professional',
                        trial_end_at: 0,
                    } as Subscription,
                    products: {
                        prod_professional: {
                            id: 'prod_professional',
                            name: 'Cloud Professional',
                            sku: CloudProducts.PROFESSIONAL,
                        } as Product,
                    },
                },
            },
        };

        renderWithContext(
            <ProductSwitcherCloudTrialMenuItem
                isUserAdmin={true}
                isCloudLicensed={true}
                isFreeTrialSubscription={false}
            />,
            state,
        );

        expect(screen.queryByText('Enterprise Advanced Trial')).not.toBeInTheDocument();
        expect(screen.queryByText('Interested in a limitless plan with high-security features?')).not.toBeInTheDocument();
    });

    test('should not show when user is not admin and not on free trial', () => {
        renderWithContext(
            <ProductSwitcherCloudTrialMenuItem
                isUserAdmin={false}
                isCloudLicensed={true}
                isFreeTrialSubscription={false}
            />,
            initialState,
        );

        expect(screen.queryByText('Enterprise Advanced Trial')).not.toBeInTheDocument();
        expect(screen.queryByText('Interested in a limitless plan with high-security features?')).not.toBeInTheDocument();
    });

    test('should not show when air-gapped', () => {
        mockUseOpenPricingModal.mockReturnValue({
            openPricingModal: mockOpenPricingModal,
            isAirGapped: true,
        });

        renderWithContext(
            <ProductSwitcherCloudTrialMenuItem
                isUserAdmin={true}
                isCloudLicensed={true}
                isFreeTrialSubscription={false}
            />,
            initialState,
        );

        expect(screen.queryByText('Enterprise Advanced Trial')).not.toBeInTheDocument();
        expect(screen.queryByText('Interested in a limitless plan with high-security features?')).not.toBeInTheDocument();
    });

    test('should show Enterprise Advanced Trial during free trial', () => {
        const trialEndDate = Date.now() + (14 * 24 * 60 * 60 * 1000);
        const state: DeepPartial<GlobalState> = {
            entities: {
                ...initialState.entities,
                cloud: {
                    subscription: {
                        product_id: 'prod_starter',
                        trial_end_at: trialEndDate,
                    } as Subscription,
                    products: {
                        prod_starter: {
                            id: 'prod_starter',
                            name: 'Cloud Starter',
                            sku: CloudProducts.STARTER,
                        } as Product,
                    },
                },
            },
        };

        renderWithContext(
            <ProductSwitcherCloudTrialMenuItem
                isUserAdmin={true}
                isCloudLicensed={true}
                isFreeTrialSubscription={true}
            />,
            state,
        );

        expect(screen.getByText((content) => content.includes('Enterprise Advanced Trial'))).toBeInTheDocument();
        expect(screen.getByText((content) => content.includes('Your trial is active until'))).toBeInTheDocument();
    });

    test('should show See plans option on non-free trial', () => {
        renderWithContext(
            <ProductSwitcherCloudTrialMenuItem
                isUserAdmin={true}
                isCloudLicensed={true}
                isFreeTrialSubscription={false}
            />,
            initialState,
        );

        expect(screen.getByText((content) => content.includes('Interested in a limitless plan'))).toBeInTheDocument();
        expect(screen.getByText((content) => content.includes('See plans'))).toBeInTheDocument();
    });
});
