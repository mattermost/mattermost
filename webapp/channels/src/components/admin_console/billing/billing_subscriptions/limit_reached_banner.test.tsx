// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {screen, fireEvent} from '@testing-library/react';

import {Provider} from 'react-redux';

import {getPreferenceKey} from 'mattermost-redux/utils/preference_utils';
import {Preferences} from 'mattermost-redux/constants';

import * as useOpenSalesLink from 'components/common/hooks/useOpenSalesLink';
import * as useGetUsageDeltas from 'components/common/hooks/useGetUsageDeltas';
import * as useOpenCloudPurchaseModal from 'components/common/hooks/useOpenCloudPurchaseModal';
import * as useOpenPricingModal from 'components/common/hooks/useOpenPricingModal';
import * as useSaveBool from 'components/common/hooks/useSavePreferences';
import {renderWithIntl} from 'tests/react_testing_utils';
import mockStore from 'tests/test_store';

import {CloudProducts} from 'utils/constants';

import {GlobalState} from '@mattermost/types/store';
import {UserProfile, UsersState} from '@mattermost/types/users';

import LimitReachedBanner from './limit_reached_banner';

const upgradeCloudKey = getPreferenceKey(Preferences.CATEGORY_UPGRADE_CLOUD, Preferences.SYSTEM_CONSOLE_LIMIT_REACHED);

const state: GlobalState = {
    entities: {
        users: {
            currentUserId: 'userid',
            profiles: {
                userid: {} as UserProfile,
            },
        } as unknown as UsersState,
        preferences: {
            myPreferences: {
                [upgradeCloudKey]: {value: 'false'},
            },
        },
        cloud: {
            limits: {
            },
            products: {
            },
        },
        general: {
            license: {
            },
            config: {
            },
        },
    },
} as GlobalState;

const base = {
    id: '',
    name: '',
    description: '',
    price_per_seat: 0,
    add_ons: [],
    product_family: '',
    billing_scheme: '',
    recurring_interval: '',
    cross_sells_to: '',
};

const free = {...base, sku: CloudProducts.STARTER};
const enterprise = {...base, sku: CloudProducts.ENTERPRISE};

const noLimitReached = {
    files: {
        totalStorage: -1,
        totalStorageLoaded: true,
    },
    messages: {
        history: -1,
        historyLoaded: true,
    },
    boards: {
        cards: -1,
        cardsLoaded: true,
    },
    teams: {
        active: -1,
        cloudArchived: -1,
        teamsLoaded: true,
    },
    integrations: {
        enabled: -1,
        enabledLoaded: true,
    },
};
const someLimitReached = {
    ...noLimitReached,
    integrations: {
        ...noLimitReached.integrations,
        enabled: 1,
    },
};

const titleFree = /Upgrade to one of our paid plans to avoid/;
const titleProfessional = /Upgrade to Enterprise to avoid Professional plan/;

function makeSpies() {
    const mockUseOpenSalesLink = jest.spyOn(useOpenSalesLink, 'default');
    const mockUseGetUsageDeltas = jest.spyOn(useGetUsageDeltas, 'default');
    const mockUseOpenCloudPurchaseModal = jest.spyOn(useOpenCloudPurchaseModal, 'default');
    const mockUseOpenPricingModal = jest.spyOn(useOpenPricingModal, 'default');
    const mockUseSaveBool = jest.spyOn(useSaveBool, 'useSaveBool');
    return {
        useOpenSalesLink: mockUseOpenSalesLink,
        useGetUsageDeltas: mockUseGetUsageDeltas,
        useOpenCloudPurchaseModal: mockUseOpenCloudPurchaseModal,
        useOpenPricingModal: mockUseOpenPricingModal,
        useSaveBool: mockUseSaveBool,
    };
}

describe('limits_reached_banner', () => {
    test('does not render when product is enterprise', () => {
        const store = mockStore(state);
        const spies = makeSpies();
        spies.useGetUsageDeltas.mockReturnValue(someLimitReached);

        renderWithIntl(<Provider store={store}><LimitReachedBanner product={enterprise}/></Provider>);
        expect(screen.queryByText(titleFree)).not.toBeInTheDocument();
        expect(screen.queryByText(titleProfessional)).not.toBeInTheDocument();
    });

    test('does not render when banner was dismissed', () => {
        const myState = {
            ...state,
            entities: {
                ...state.entities,
                preferences: {
                    ...state.entities.preferences,
                    myPreferences: {
                        ...state.entities.preferences.myPreferences,
                        [upgradeCloudKey]: {value: 'true'},
                    },
                },
            },
        };
        const store = mockStore(myState);
        const spies = makeSpies();
        spies.useGetUsageDeltas.mockReturnValue(someLimitReached);
        renderWithIntl(<Provider store={store}><LimitReachedBanner product={enterprise}/></Provider>);
        expect(screen.queryByText(titleFree)).not.toBeInTheDocument();
        expect(screen.queryByText(titleProfessional)).not.toBeInTheDocument();
    });

    test('does not render when no limit reached', () => {
        const store = mockStore(state);
        const spies = makeSpies();
        spies.useGetUsageDeltas.mockReturnValue(noLimitReached);
        renderWithIntl(<Provider store={store}><LimitReachedBanner product={free}/></Provider>);
        expect(screen.queryByText(titleFree)).not.toBeInTheDocument();
        expect(screen.queryByText(titleProfessional)).not.toBeInTheDocument();
    });

    test('renders free banner', () => {
        const store = mockStore(state);
        const spies = makeSpies();
        const mockOpenPricingModal = jest.fn();
        spies.useOpenPricingModal.mockReturnValue(mockOpenPricingModal);
        spies.useGetUsageDeltas.mockReturnValue(someLimitReached);
        renderWithIntl(<Provider store={store}><LimitReachedBanner product={free}/></Provider>);
        screen.getByText(titleFree);
        expect(screen.queryByText(titleProfessional)).not.toBeInTheDocument();
        fireEvent.click(screen.getByText('View plans'));
        expect(mockOpenPricingModal).toHaveBeenCalled();
    });

    test('clicking Contact Sales opens sales link', () => {
        const store = mockStore(state);
        const spies = makeSpies();
        const mockOpenSalesLink = jest.fn();
        spies.useOpenSalesLink.mockReturnValue(mockOpenSalesLink);
        spies.useGetUsageDeltas.mockReturnValue(someLimitReached);
        renderWithIntl(<Provider store={store}><LimitReachedBanner product={free}/></Provider>);
        screen.getByText(titleFree);
        expect(screen.queryByText(titleProfessional)).not.toBeInTheDocument();
        fireEvent.click(screen.getByText('Contact sales'));
        expect(mockOpenSalesLink).toHaveBeenCalled();
    });
});
