// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import * as redux from 'react-redux';
import {Provider} from 'react-redux';

import {renderWithIntl, screen} from 'tests/react_testing_utils';
import mockStore from 'tests/test_store';
import {FileSizes} from 'utils/file_utils';

import {Constants} from 'utils/constants';

import {GlobalState} from '@mattermost/types/store';

import {Subscription} from '@mattermost/types/cloud';

import CloudUsageModal, {Props} from './index';

const freeLimits = {
    messages: {
        history: 10000,
    },
    files: {
        total_storage: FileSizes.Gigabyte,
    },
    teams: {
        active: 1,
        teamsLimits: true,
    },
};

function setupStore(hasLimits: boolean) {
    const state = {
        entities: {
            cloud: {
                limits: {
                    limitsLoaded: hasLimits,
                    limits: hasLimits ? freeLimits : {},
                },
                subscription: {} as Subscription,
            },
            usage: {
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
            },
            admin: {
                analytics: {
                    [Constants.StatTypes.TOTAL_POSTS]: 1234,
                } as GlobalState['entities']['admin']['analytics'],
            },
            teams: {
                currentTeamId: '',
            },
            preferences: {
                myPreferences: {
                },
            },
            general: {
                license: {},
                config: {},
            },
            users: {
                currentUserId: 'uid',
                profiles: {
                    uid: {},
                },
            } as unknown as GlobalState['entities']['users'],
        },
    } as GlobalState;
    const store = mockStore(state);

    return store;
}

let props: Props = {
    title: '',
    onClose: jest.fn(),
};
describe('CloudUsageModal', () => {
    beforeEach(() => {
        jest.spyOn(redux, 'useDispatch').mockImplementation(jest.fn(() => jest.fn()));
        props = {
            title: '',
            onClose: jest.fn(),
            needsTheme: false,
        };
    });

    test('renders text elements', () => {
        const store = setupStore(true);

        props.title = 'very important title';
        props.description = 'very important description';

        renderWithIntl(
            <Provider store={store}>
                <CloudUsageModal
                    {...props}
                />
            </Provider>,
        );
        screen.getByText(props.title as string);
        screen.getByText(props.description as string);
    });

    test('renders primary modal action', () => {
        const store = setupStore(true);

        props.primaryAction = {
            message: 'primary action',
            onClick: jest.fn(),
        };

        renderWithIntl(
            <Provider store={store}>
                <CloudUsageModal
                    {...props}
                />
            </Provider>,
        );
        expect(props.primaryAction.onClick).not.toHaveBeenCalled();
        screen.getByText(props.primaryAction.message as string).click();
        expect(props.primaryAction.onClick).toHaveBeenCalled();
    });

    test('renders secondary modal action', () => {
        const store = setupStore(true);

        props.secondaryAction = {
            message: 'secondary action',
        };

        renderWithIntl(
            <Provider store={store}>
                <CloudUsageModal
                    {...props}
                />
            </Provider>,
        );
        expect(props.onClose).not.toHaveBeenCalled();
        screen.getByText(props.secondaryAction.message as string).click();
        expect(props.onClose).toHaveBeenCalled();
    });

    test('hides footer when there are no actions', () => {
        const store = setupStore(true);

        renderWithIntl(
            <Provider store={store}>
                <CloudUsageModal
                    {...props}
                />
            </Provider>,
        );
        expect(screen.queryByTestId('limits-modal-footer')).not.toBeInTheDocument();
    });
});
