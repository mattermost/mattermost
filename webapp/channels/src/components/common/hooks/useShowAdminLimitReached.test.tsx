// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ReactPortal} from 'react';
import {screen} from '@testing-library/react';
import {Provider} from 'react-redux';

import {renderWithIntl} from 'tests/react_testing_utils';

import {TestHelper} from 'utils/test_helper';
import {Preferences} from 'utils/constants';

import * as useGetLimitsHook from 'components/common/hooks/useGetLimits';
import * as useGetUsageHook from 'components/common/hooks/useGetUsage';

import ModalController from 'components/modal_controller';
import configureStore from 'store';

import useShowAdminLimitReached from './useShowAdminLimitReached';

function TestComponent() {
    useShowAdminLimitReached();
    return null;
}

// state in which modal will be opened.
const openModalState = {
    entities: {
        general: {
            license: TestHelper.getLicenseMock({
                Cloud: 'true',
            }),
        },
        users: {
            currentUserId: 'admin',
            profiles: {
                admin: TestHelper.getUserMock({
                    id: 'admin',
                    roles: 'system_admin',
                }),
            },
        },
        cloud: {
            limits: {
                limits: {
                    messages: {
                        history: 10000,
                    },
                },
                limitsLoaded: true,
            },
        },
        usage: {
            messages: {
                history: 10001,
                historyLoaded: true,
            },
            files: {
                totalStorageLoaded: true,
            },
            boards: {
                cardsLoaded: true,
            },
            integrations: {
                enabledLoaded: true,
            },
            teams: {
                teamsLoaded: true,
            },
        },
        preferences: {
            myPreferences: TestHelper.getPreferencesMock(
                [
                    {
                        category: Preferences.CATEGORY_CLOUD_LIMITS,
                        name: Preferences.SHOWN_LIMITS_REACHED_ON_LOGIN,
                        value: 'false',
                    },
                ],
                'admin',
            ),
        },
    },
    views: {
        admin: {
            needsLoggedInLimitReachedCheck: true,
        },
        modals: {
            modalState: {
            },
            showLaunchingWorkspace: false,
        },
    },
};

const modalRegex = /message history.*no longer available.*Upgrade to a paid plan and get unlimited access to your message history/;

jest.mock('react-dom', () => ({
    ...jest.requireActual('react-dom') as typeof import('react-dom'),
    createPortal: (node: React.ReactNode) => node as ReactPortal,
}));

describe('useShowAdminLimitReached', () => {
    it('opens cloud usage modal if admin has just logged in on a cloud instance, the instance has exceeded its message history limit, and the admin has not been shown the modal on log in before.', () => {
        const state = JSON.parse(JSON.stringify(openModalState));
        const store = configureStore(state);
        renderWithIntl(
            <Provider store={store}>
                <div id='root-portal'/>
                <ModalController/>
                <TestComponent/>
            </Provider>,
        );
        screen.getByText(modalRegex);
    });

    it('does not open cloud usage modal if admin has already been shown the modal', () => {
        const state = JSON.parse(JSON.stringify(openModalState));
        state.entities.preferences.myPreferences = TestHelper.getPreferencesMock(
            [
                {
                    category: Preferences.CATEGORY_CLOUD_LIMITS,
                    name: Preferences.SHOWN_LIMITS_REACHED_ON_LOGIN,
                    value: 'true',
                },
            ],
            'admin',
        );
        const store = configureStore(state);
        renderWithIntl(
            <Provider store={store}>
                <div id='root-portal'/>
                <ModalController/>
                <TestComponent/>
            </Provider>,
        );
        expect(screen.queryByText(modalRegex)).not.toBeInTheDocument();
    });

    it('does not open cloud usage modal if workspace has not exceeded limit', () => {
        const state = JSON.parse(JSON.stringify(openModalState));
        state.entities.usage.messages.history = 10000;
        const store = configureStore(state);
        renderWithIntl(
            <Provider store={store}>
                <div id='root-portal'/>
                <ModalController/>
                <TestComponent/>
            </Provider>,
        );
        expect(screen.queryByText(modalRegex)).not.toBeInTheDocument();
    });

    it('does not open cloud usage modal if there is no message limit', () => {
        const state = JSON.parse(JSON.stringify(openModalState));
        state.entities.cloud.limits = {};
        const store = configureStore(state);
        renderWithIntl(
            <Provider store={store}>
                <div id='root-portal'/>
                <ModalController/>
                <TestComponent/>
            </Provider>,
        );
        expect(screen.queryByText(modalRegex)).not.toBeInTheDocument();
    });

    it('does not open cloud usage modal if there is no message limit', () => {
        const state = JSON.parse(JSON.stringify(openModalState));
        state.entities.cloud.limits = {};
        const store = configureStore(state);
        renderWithIntl(
            <Provider store={store}>
                <div id='root-portal'/>
                <ModalController/>
                <TestComponent/>
            </Provider>,
        );
        expect(screen.queryByText(modalRegex)).not.toBeInTheDocument();
    });

    it('does not open cloud usage modal if admin was already logged in', () => {
        const state = JSON.parse(JSON.stringify(openModalState));
        state.views.admin.needsLoggedInLimitReachedCheck = false;
        const store = configureStore(state);
        renderWithIntl(
            <Provider store={store}>
                <div id='root-portal'/>
                <ModalController/>
                <TestComponent/>
            </Provider>,
        );
        expect(screen.queryByText(modalRegex)).not.toBeInTheDocument();
    });

    it('does not open cloud usage modal if limits are not yet loaded', () => {
        const state = JSON.parse(JSON.stringify(openModalState));
        state.entities.cloud.limits.limitsLoaded = false;
        const store = configureStore(state);
        jest.spyOn(useGetLimitsHook, 'default').mockImplementation(() => ([
            state.entities.cloud.limits.limits,
            false,
        ]));
        renderWithIntl(
            <Provider store={store}>
                <div id='root-portal'/>
                <ModalController/>
                <TestComponent/>
            </Provider>,
        );
        expect(screen.queryByText(modalRegex)).not.toBeInTheDocument();
    });

    it('does not open cloud usage modal if usage is not yet loaded', () => {
        const state = JSON.parse(JSON.stringify(openModalState));
        state.entities.usage.messages = {
            history: 0,
            historyLoaded: false,
        };
        const store = configureStore(state);
        jest.spyOn(useGetUsageHook, 'default').mockImplementation(() => state.entities.usage);
        renderWithIntl(
            <Provider store={store}>
                <div id='root-portal'/>
                <ModalController/>
                <TestComponent/>
            </Provider>,
        );
        expect(screen.queryByText(modalRegex)).not.toBeInTheDocument();
    });
});
