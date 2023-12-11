// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import * as redux from 'react-redux';

import type {Subscription} from '@mattermost/types/cloud';
import type {GlobalState} from '@mattermost/types/store';
import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {Constants} from 'utils/constants';
import {FileSizes} from 'utils/file_utils';

import CloudUsageModal from './index';
import type {Props} from './index';

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

function setupState(hasLimits: boolean) {
    const state: DeepPartial<GlobalState> = {
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
    };

    return state;
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
        const state = setupState(true);

        props.title = 'very important title';
        props.description = 'very important description';

        renderWithContext(
            <CloudUsageModal
                {...props}
            />,
            state,
        );
        screen.getByText(props.title as string);
        screen.getByText(props.description as string);
    });

    test('renders primary modal action', () => {
        const state = setupState(true);

        props.primaryAction = {
            message: 'primary action',
            onClick: jest.fn(),
        };

        renderWithContext(
            <CloudUsageModal
                {...props}
            />,
            state,
        );
        expect(props.primaryAction.onClick).not.toHaveBeenCalled();
        screen.getByText(props.primaryAction.message as string).click();
        expect(props.primaryAction.onClick).toHaveBeenCalled();
    });

    test('renders secondary modal action', () => {
        const state = setupState(true);

        props.secondaryAction = {
            message: 'secondary action',
        };

        renderWithContext(
            <CloudUsageModal
                {...props}
            />,
            state,
        );
        expect(props.onClose).not.toHaveBeenCalled();
        screen.getByText(props.secondaryAction.message as string).click();
        expect(props.onClose).toHaveBeenCalled();
    });

    test('hides footer when there are no actions', () => {
        const state = setupState(true);

        renderWithContext(
            <CloudUsageModal
                {...props}
            />,
            state,
        );
        expect(screen.queryByTestId('limits-modal-footer')).not.toBeInTheDocument();
    });
});
