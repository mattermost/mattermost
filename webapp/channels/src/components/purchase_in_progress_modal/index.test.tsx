// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DeepPartial} from '@mattermost/types/utilities';
import React from 'react';

import {Client4} from 'mattermost-redux/client';

import {STORAGE_KEY_PURCHASE_IN_PROGRESS} from 'components/self_hosted_purchases/constants';

import {renderWithIntlAndStore, screen} from 'tests/react_testing_utils';
import {GlobalState} from 'types/store';
import {TestHelper as TH} from 'utils/test_helper';

import PurchaseInProgressModal from './';

jest.mock('mattermost-redux/client', () => {
    const original = jest.requireActual('mattermost-redux/client');
    return {
        __esModule: true,
        ...original,
        Client4: {
            ...original,
            bootstrapSelfHostedSignup: jest.fn(),
        },
    };
});

const initialState: DeepPartial<GlobalState> = {
    entities: {
        preferences: {
            myPreferences: {
                theme: {},
            },
        },
        users: {
            currentUserId: 'adminUserId',
            profiles: {
                adminUserId: TH.getUserMock({
                    id: 'adminUserId',
                    username: 'UserAdmin',
                    roles: 'admin',
                    email: 'admin@example.com',
                }),
                otherUserId: TH.getUserMock({
                    id: 'otherUserId',
                    username: 'UserOther',
                    roles: '',
                    email: 'other-user@example.com',
                }),
            },
        },
    },
};

describe('PurchaseInProgressModal', () => {
    it('when purchaser and user emails are different, user is instructed to wait', () => {
        const stateOverride: DeepPartial<GlobalState> = JSON.parse(JSON.stringify(initialState));
        stateOverride.entities!.users!.currentUserId = 'otherUserId';
        renderWithIntlAndStore(
            <div id='root-portal'>
                <PurchaseInProgressModal
                    purchaserEmail={'admin@example.com'}
                    storageKey={STORAGE_KEY_PURCHASE_IN_PROGRESS}
                />
            </div>, stateOverride,
        );

        screen.getByText('@UserAdmin is currently attempting to purchase a paid license.');
    });

    it('when purchaser and user emails are same, allows user to reset purchase flow', () => {
        renderWithIntlAndStore(
            <div id='root-portal'>
                <PurchaseInProgressModal
                    purchaserEmail={'admin@example.com'}
                    storageKey={STORAGE_KEY_PURCHASE_IN_PROGRESS}
                />
            </div>, initialState,
        );

        expect(Client4.bootstrapSelfHostedSignup).not.toHaveBeenCalled();
        screen.getByText('Reset purchase flow').click();
        expect(Client4.bootstrapSelfHostedSignup).toHaveBeenCalled();
    });
});
