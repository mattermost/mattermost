// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Provider} from 'react-redux';

import type {Team} from '@mattermost/types/teams';

import deepFreeze from 'mattermost-redux/utils/deep_freeze';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import mockStore from 'tests/test_store';
import {SelfHostedProducts} from 'utils/constants';
import {TestHelper as TH} from 'utils/test_helper';
import {generateId} from 'utils/utils';

import InviteAs, {InviteType} from './invite_as';
import InviteView from './invite_view';
import type {Props} from './invite_view';

const defaultProps: Props = deepFreeze({
    setInviteAs: jest.fn(),
    inviteType: InviteType.MEMBER,
    titleClass: 'title',

    invite: jest.fn(),
    onChannelsChange: jest.fn(),
    onChannelsInputChange: jest.fn(),
    onClose: jest.fn(),
    currentTeam: {} as Team,
    currentChannel: {
        display_name: 'some_channel',
    },
    setCustomMessage: jest.fn(),
    toggleCustomMessage: jest.fn(),
    channelsLoader: jest.fn(),
    regenerateTeamInviteId: jest.fn(),
    isAdmin: false,
    usersLoader: jest.fn(),
    onChangeUsersEmails: jest.fn(),
    isCloud: false,
    emailInvitationsEnabled: true,
    onUsersInputChange: jest.fn(),
    headerClass: '',
    footerClass: '',
    canInviteGuests: true,
    canAddUsers: true,

    customMessage: {
        message: '',
        open: false,
    },
    sending: false,
    inviteChannels: {
        channels: [],
        search: '',
    },
    usersEmails: [],
    usersEmailsSearch: '',
    townSquareDisplayName: '',
    canInviteGuestsWithEasyLogin: false,
    useEasyLogin: false,
    toggleEasyLogin: jest.fn(),
});

let props = defaultProps;

describe('InviteView', () => {
    const state = {
        entities: {
            admin: {
                prevTrialLicense: {
                    IsLicensed: 'true',
                },
            },
            general: {
                config: {
                    BuildEnterpriseReady: 'true',
                },
                license: {
                    IsLicensed: 'true',
                    Cloud: 'true',
                    Id: generateId(),
                },
            },
            cloud: {
                subscription: {
                    is_free_trial: 'false',
                    trial_end_at: 0,
                },
            },
            users: {
                currentUserId: 'current_user_id',
                profiles: {
                    current_user_id: {roles: 'system_user'},
                },
            },
            roles: {
                roles: {
                    system_user: {
                        permissions: [],
                    },
                },
            },
            preferences: {
                myPreferences: {},
            },
            hostedCustomer: {
                products: {
                    productsLoaded: true,
                    products: {
                        prod_professional: TH.getProductMock({
                            id: 'prod_professional',
                            name: 'Professional',
                            sku: SelfHostedProducts.PROFESSIONAL,
                            price_per_seat: 7.5,
                        }),
                    },
                },
            },
        },
    };

    const store = mockStore(state);

    beforeEach(() => {
        props = defaultProps;
    });

    it('shows InviteAs component when user can choose to invite guests or users', async () => {
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <InviteView {...props}/>
            </Provider>,
        );
        expect(wrapper.find(InviteAs).length).toBe(1);
    });

    it('hides InviteAs component when user can not choose members option', async () => {
        props = {
            ...defaultProps,
            canAddUsers: false,
        };

        const wrapper = mountWithIntl(
            <Provider store={store}>
                <InviteView {...props}/>
            </Provider>,
        );

        expect(wrapper.find(InviteAs).length).toBe(0);
    });

    it('hides InviteAs component when user can not choose guests option', async () => {
        props = {
            ...defaultProps,
            canInviteGuests: false,
        };

        const wrapper = mountWithIntl(
            <Provider store={store}>
                <InviteView {...props}/>
            </Provider>,
        );
        expect(wrapper.find(InviteAs).length).toBe(0);
    });

    it('shows easy login checkbox when inviting guests and easy login is enabled', async () => {
        props = {
            ...defaultProps,
            inviteType: InviteType.GUEST,
            canInviteGuestsWithEasyLogin: true,
        };

        const wrapper = mountWithIntl(
            <Provider store={store}>
                <InviteView {...props}/>
            </Provider>,
        );

        const checkbox = wrapper.find('[data-testid="InviteView__easyLoginCheckbox"]');
        expect(checkbox.length).toBe(1);
    });

    it('hides easy login checkbox when inviting members', async () => {
        props = {
            ...defaultProps,
            inviteType: InviteType.MEMBER,
            canInviteGuestsWithEasyLogin: true,
        };

        const wrapper = mountWithIntl(
            <Provider store={store}>
                <InviteView {...props}/>
            </Provider>,
        );

        const checkbox = wrapper.find('[data-testid="InviteView__easyLoginCheckbox"]');
        expect(checkbox.length).toBe(0);
    });

    it('hides easy login checkbox when easy login is not enabled', async () => {
        props = {
            ...defaultProps,
            inviteType: InviteType.GUEST,
            canInviteGuestsWithEasyLogin: false,
        };

        const wrapper = mountWithIntl(
            <Provider store={store}>
                <InviteView {...props}/>
            </Provider>,
        );

        const checkbox = wrapper.find('[data-testid="InviteView__easyLoginCheckbox"]');
        expect(checkbox.length).toBe(0);
    });

    it('calls toggleEasyLogin when checkbox is clicked', async () => {
        const toggleEasyLogin = jest.fn();
        props = {
            ...defaultProps,
            inviteType: InviteType.GUEST,
            canInviteGuestsWithEasyLogin: true,
            toggleEasyLogin,
        };

        const wrapper = mountWithIntl(
            <Provider store={store}>
                <InviteView {...props}/>
            </Provider>,
        );

        const checkbox = wrapper.find('[data-testid="InviteView__easyLoginCheckbox"]');
        checkbox.simulate('change');

        expect(toggleEasyLogin).toHaveBeenCalledTimes(1);
    });
});
