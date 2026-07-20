// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';
import {Provider} from 'react-redux';

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import testConfigureStore from 'tests/test_store';

import type {GlobalState} from 'types/store';

import Pluggable from '.';

const ProfilePopoverPlugin: React.FunctionComponent = () => (<span data-testid='pluginId'>{'ProfilePopoverPlugin'}</span>);

jest.mock('actions/views/profile_popover');

describe('plugins/Pluggable', () => {
    const baseProps: ComponentProps<typeof Pluggable> = {
        pluggableName: 'RightHandSidebarComponent',
    };
    function getBaseState(): DeepPartial<GlobalState> {
        return {
            plugins: {
                components: {
                    RightHandSidebarComponent: [{
                        component: ProfilePopoverPlugin,
                        id: 'some id',
                        pluginId: 'some plugin id',
                    }],
                },
            },
            entities: {
                teams: {
                    currentTeamId: '',
                },
                preferences: {
                    myPreferences: {},
                },
                general: {
                    config: {},
                },
            },
        };
    }

    test('should match snapshot with extended component', () => {
        const state = getBaseState();
        const {container} = renderWithContext(
            <Pluggable
                {...baseProps}
                pluggableName='RightHandSidebarComponent'
            />,
            state,
        );

        expect(container).toMatchSnapshot();
        expect(screen.getByTestId('pluginId')).toBeInTheDocument();
        expect(screen.getByText('ProfilePopoverPlugin')).toBeInTheDocument();
    });

    test('should return null if with pluggableName but no components', () => {
        const state = getBaseState();
        state.plugins!.components!.RightHandSidebarComponent = [];
        const store = testConfigureStore(state);
        const {container} = renderWithContext(
            <Provider store={store}>
                <Pluggable
                    {...baseProps}
                    pluggableName='RightHandSidebarComponent'
                />
            </Provider>,
            state,
        );

        expect(container).toBeEmptyDOMElement();
    });

    test('should match snapshot with non-null pluggableId', () => {
        const state = getBaseState();
        const store = testConfigureStore(state);
        const {container} = renderWithContext(
            <Provider store={store}>
                <Pluggable
                    {...baseProps}
                    pluggableName='RightHandSidebarComponent'
                    pluggableId={'pluggableId'}
                />
            </Provider>,
            state,
        );

        expect(container).toMatchSnapshot();
        expect(container).toBeEmptyDOMElement();
    });

    test('should match snapshot with valid pluggableId', () => {
        const state = getBaseState();
        state.plugins!.components!.RightHandSidebarComponent![0]!.id = 'pluggableId';
        const store = testConfigureStore(state);
        const {container} = renderWithContext(
            <Provider store={store}>
                <Pluggable
                    {...baseProps}
                    pluggableName='RightHandSidebarComponent'
                    pluggableId={'pluggableId'}
                />
            </Provider>,
            state,
        );

        expect(container).toMatchSnapshot();
        expect(screen.getByTestId('pluginId')).toBeInTheDocument();
    });
});
