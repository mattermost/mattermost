// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import * as cloudActions from 'mattermost-redux/actions/cloud';

import * as StorageSelectors from 'selectors/storage';

import ModalController from 'components/modal_controller';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {CloudProducts, ModalIdentifiers, Preferences} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import DelinquencyModalController from './index';

jest.mock('selectors/storage');

(StorageSelectors.makeGetItem as jest.Mock).mockReturnValue(() => false);

describe('components/delinquency_modal/delinquency_modal_controller', () => {
    const initialState: DeepPartial<GlobalState> = {
        views: {
            modals: {
                modalState: {},
            },
        },
        entities: {
            general: {
                license: {
                    IsLicensed: 'true',
                    Cloud: 'true',
                },
            },
            preferences: {
                myPreferences: {},
            },
            users: {
                currentUserId: 'current_user_id',
                profiles: {
                    current_user_id: {roles: 'system_admin'},
                },
            },
            cloud: {
                subscription: TestHelper.getSubscriptionMock({
                    product_id: 'test_prod_1',
                    trial_end_at: 1652807380,
                    is_free_trial: 'false',
                    delinquent_since: 1652807380, // may 17 2022
                }),
                products: {
                    test_prod_1: TestHelper.getProductMock({
                        id: 'test_prod_1',
                        sku: CloudProducts.STARTER,
                        price_per_seat: 0,
                        name: 'testProd1',
                    }),
                    test_prod_2: TestHelper.getProductMock({
                        id: 'test_prod_2',
                        sku: CloudProducts.ENTERPRISE,
                        price_per_seat: 0,
                        name: 'testProd2',
                    }),
                    test_prod_3: TestHelper.getProductMock({
                        id: 'test_prod_3',
                        sku: CloudProducts.PROFESSIONAL,
                        price_per_seat: 0,
                        name: 'testProd3',
                    }),
                },
            },
        },
    };

    it('Should show the modal if the admin hasn\'t a preference', () => {
        jest.useFakeTimers().setSystemTime(new Date('2022-12-20'));

        renderWithContext(
            <>
                <div id='root-portal'/>
                <ModalController/>
                <DelinquencyModalController/>
            </>,
            initialState,
        );

        expect(screen.queryByText('Your workspace has been downgraded')).toBeInTheDocument();
    });

    it('Shouldn\'t show the modal if the admin has a preference', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.preferences.myPreferences = TestHelper.getPreferencesMock(
            [
                {
                    category: Preferences.DELINQUENCY_MODAL_CONFIRMED,
                    name: ModalIdentifiers.DELINQUENCY_MODAL_DOWNGRADE,
                    value: 'updateBilling',
                },
            ],
        );

        jest.useFakeTimers().setSystemTime(new Date('2022-12-20'));

        renderWithContext(
            <>
                <div id='root-portal'/>
                <ModalController/>
                <DelinquencyModalController/>
            </>,
            state,
        );

        expect(screen.queryByText('Your workspace has been downgraded')).not.toBeInTheDocument();
    });

    it('Should show the modal if the deliquency_since is equal 90 days', () => {
        jest.useFakeTimers().setSystemTime(new Date('2022-08-16'));

        renderWithContext(
            <>
                <div id='root-portal'/>
                <ModalController/>
                <DelinquencyModalController/>
            </>,
            initialState,
        );

        expect(screen.queryByText('Your workspace has been downgraded')).toBeInTheDocument();
    });

    it('Should show the modal if the deliquency_since is more than 90 days', () => {
        jest.useFakeTimers().setSystemTime(new Date('2022-08-17'));

        renderWithContext(
            <>
                <div id='root-portal'/>
                <ModalController/>
                <DelinquencyModalController/>
            </>,
            initialState,
        );

        expect(screen.queryByText('Your workspace has been downgraded')).toBeInTheDocument();
    });

    it('Shouldn\'t show the modal if the deliqeuncy_since is less than 90 days', () => {
        jest.useFakeTimers().setSystemTime(new Date('2022-08-15'));

        renderWithContext(
            <>
                <div id='root-portal'/>
                <ModalController/>
                <DelinquencyModalController/>
            </>,
            initialState,
        );

        expect(screen.queryByText('Your workspace has been downgraded')).not.toBeInTheDocument();
    });

    it('Should show the modal if the license is cloud', () => {
        jest.useFakeTimers().setSystemTime(new Date('2022-08-17'));

        renderWithContext(
            <>
                <div id='root-portal'/>
                <ModalController/>
                <DelinquencyModalController/>
            </>,
            initialState,
        );

        expect(screen.queryByText('Your workspace has been downgraded')).toBeInTheDocument();
    });

    it('Shouldn\'t show the modal if the license isn\'t cloud', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.general.license = {
            ...state.entities.general.license,
            Cloud: 'false',
        };

        jest.useFakeTimers().setSystemTime(new Date('2022-12-20'));

        renderWithContext(
            <>
                <div id='root-portal'/>
                <ModalController/>
                <DelinquencyModalController/>
            </>,
            state,
        );

        expect(screen.queryByText('Your workspace has been downgraded')).not.toBeInTheDocument();
    });

    it('Shouldn\'t show the modal if the subscription isn\'t in delinquency state', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.cloud.subscription = {
            ...state.entities.cloud.subscription,
            delinquent_since: null,
        };

        jest.useFakeTimers().setSystemTime(new Date('2022-12-20'));

        renderWithContext(
            <>
                <div id='root-portal'/>
                <ModalController/>
                <DelinquencyModalController/>
            </>,
            state,
        );

        expect(screen.queryByText('Your workspace has been downgraded')).not.toBeInTheDocument();
    });

    it('Should show the modal if the user is an admin', () => {
        jest.useFakeTimers().setSystemTime(new Date('2022-08-17'));

        renderWithContext(
            <>
                <div id='root-portal'/>
                <ModalController/>
                <DelinquencyModalController/>
            </>,
            initialState,
        );

        expect(screen.queryByText('Your workspace has been downgraded')).toBeInTheDocument();
    });

    it('Shouldn\'t show the modal if the user isn\'t an admin', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.users = {
            currentUserId: 'current_user_id',
            profiles: {
                current_user_id: {roles: 'user'},
            },
        };
        jest.useFakeTimers().setSystemTime(new Date('2022-12-20'));

        renderWithContext(
            <>
                <div id='root-portal'/>
                <ModalController/>
                <DelinquencyModalController/>
            </>,
            state,
        );

        expect(screen.queryByText('Your workspace has been downgraded')).not.toBeInTheDocument();
    });

    it('Should show the modal if the user just logged in', () => {
        jest.useFakeTimers().setSystemTime(new Date('2022-08-17'));

        renderWithContext(
            <>
                <div id='root-portal'/>
                <ModalController/>
                <DelinquencyModalController/>
            </>,
            initialState,
        );

        expect(screen.queryByText('Your workspace has been downgraded')).toBeInTheDocument();
    });
    it('Shouldn\'t show the modal if we aren\'t log in', () => {
        (StorageSelectors.makeGetItem as jest.Mock).mockReturnValue(() => true);
        jest.useFakeTimers().setSystemTime(new Date('2022-08-17'));

        renderWithContext(
            <>
                <div id='root-portal'/>
                <ModalController/>
                <DelinquencyModalController/>
            </>,
            initialState,
        );

        expect(screen.queryByText('Your workspace has been downgraded')).not.toBeInTheDocument();
    });

    it('Should fetch cloud products when on cloud', () => {
        jest.useFakeTimers().setSystemTime(new Date('2022-12-20'));

        const newState = JSON.parse(JSON.stringify(initialState));
        newState.entities.cloud.products = {};

        const getCloudProds = jest.spyOn(cloudActions, 'getCloudProducts').mockImplementationOnce(jest.fn().mockReturnValue({type: 'mock_impl'}));

        renderWithContext(
            <>
                <div id='root-portal'/>
                <ModalController/>
                <DelinquencyModalController/>
            </>,
            newState,
        );

        expect(getCloudProds).toHaveBeenCalledTimes(1);
    });

    it('Should NOT fetch cloud products when NOT on cloud', () => {
        jest.useFakeTimers().setSystemTime(new Date('2022-12-20'));

        const newState = JSON.parse(JSON.stringify(initialState));
        newState.entities.cloud.products = {};
        newState.entities.general.license = {
            IsLicensed: 'true',
            Cloud: 'false',
        };

        const getCloudProds = jest.spyOn(cloudActions, 'getCloudProducts').mockImplementationOnce(jest.fn().mockReturnValue({type: 'mock_impl'}));

        renderWithContext(
            <>
                <div id='root-portal'/>
                <ModalController/>
                <DelinquencyModalController/>
            </>,
            newState,
        );

        expect(getCloudProds).toHaveBeenCalledTimes(0);
    });
});
