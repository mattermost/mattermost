// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {connect, useSelector} from 'react-redux';
import {Link, Route} from 'react-router-dom';

import {getUser} from 'mattermost-redux/selectors/entities/users';
import mergeObjects from 'packages/mattermost-redux/test/merge_objects';

import {GlobalState} from 'types/store';

import {TestHelper} from 'utils/test_helper';

import {renderWithFullContext, screen} from './react_testing_utils';

describe('renderWithFullContext', () => {
    test('should be able to render anything', () => {
        const TestComponent = () => {
            return <div>{'Anything'}</div>;
        };

        renderWithFullContext(
            <TestComponent/>,
            {},
        );

        expect(screen.getByText('Anything')).toBeInTheDocument();
    });

    test('should be able to render react-intl components', () => {
        const TestComponent = () => {
            return (
                <FormattedMessage
                    id='about.buildnumber'
                    defaultMessage='Build Number:'
                />
            );
        };

        renderWithFullContext(
            <TestComponent/>,
        );

        expect(screen.getByText('Build Number:')).toBeInTheDocument();
    });

    test('should be able to render components using react-intl hooks', () => {
        const TestComponent = () => {
            const intl = useIntl();

            return <div>{intl.formatMessage({id: 'about.hash', defaultMessage: 'Build Hash:'})}</div>;
        };

        renderWithFullContext(
            <TestComponent/>,
        );

        expect(screen.getByText('Build Hash:')).toBeInTheDocument();
    });

    test('should be able to render react-router components', () => {
        const RouteComponent = () => {
            return <div>{'this is the route component'}</div>;
        };
        const TestComponent = () => {
            return (
                <div>
                    <Route
                        path={''}
                        component={RouteComponent}
                    />
                    <Link to={'/another_page'}>{'Test Link'}</Link>
                </div>
            );
        };

        renderWithFullContext(
            <TestComponent/>,
        );

        expect(screen.getByText('this is the route component')).toBeInTheDocument();
        expect(screen.getByRole('link', {name: 'Test Link'})).toBeInTheDocument();
    });

    test('should be able to render components that use connect to access the Redux store', () => {
        const UnconnectedTestComponent = (props: {numProfiles: number}) => {
            return <div>{`There are ${props.numProfiles} users loaded`}</div>;
        };
        const TestComponent = connect((state: GlobalState) => ({
            numProfiles: Object.keys(state.entities.users.profiles).length,
        }))(UnconnectedTestComponent);

        renderWithFullContext(
            <TestComponent/>,
        );

        expect(screen.getByText('There are 0 users loaded')).toBeInTheDocument();
    });

    test('should be able to render components that use hooks to access the Redux store', () => {
        const TestComponent = () => {
            const numProfiles = useSelector((state: GlobalState) => Object.keys(state.entities.users.profiles).length);
            return <div>{`There are ${numProfiles} users loaded`}</div>;
        };

        renderWithFullContext(
            <TestComponent/>,
        );

        expect(screen.getByText('There are 0 users loaded')).toBeInTheDocument();
    });

    test('should be able to rerender components without losing context', () => {
        const TestComponent = (props: {appTitle: string}) => {
            return (
                <FormattedMessage
                    id='about.title'
                    defaultMessage='About {appTitle}'
                    values={{
                        appTitle: props.appTitle,
                    }}
                />
            );
        };

        const {rerender} = renderWithFullContext(
            <TestComponent appTitle='Mattermost'/>,
        );

        expect(screen.getByText('About Mattermost')).toBeInTheDocument();

        rerender(
            <TestComponent appTitle='Mattermots'/>,
        );

        expect(screen.getByText('About Mattermots')).toBeInTheDocument();
    });

    test('should be able to inject store state and replace it later', () => {
        const initialState = {
            entities: {
                users: {
                    profiles: {
                        user1: TestHelper.getUserMock({id: 'user1', username: 'Alpha'}),
                        user2: TestHelper.getUserMock({id: 'user2', username: 'Bravo'}),
                    },
                },
            },
        };

        const TestComponent = () => {
            const user1 = useSelector((state: GlobalState) => getUser(state, 'user1'));
            const user2 = useSelector((state: GlobalState) => getUser(state, 'user2'));

            return <div>{`User1 is ${user1.username} and User2 is ${user2.username}!`}</div>;
        };

        const {replaceStoreState} = renderWithFullContext(
            <TestComponent/>,
            initialState,
        );

        expect(screen.getByText('User1 is Alpha and User2 is Bravo!')).toBeInTheDocument();

        replaceStoreState(mergeObjects(initialState, {
            entities: {
                users: {
                    profiles: {
                        user1: {username: 'Charlie'},
                    },
                },
            },
        }));

        expect(screen.getByText('User1 is Charlie and User2 is Bravo!')).toBeInTheDocument();

        replaceStoreState(mergeObjects(initialState, {
            entities: {
                users: {
                    profiles: {
                        user2: {username: 'Delta'},
                    },
                },
            },
        }));

        // Since this replaces the state, user1's username goes back to the initial value
        expect(screen.getByText('User1 is Alpha and User2 is Delta!')).toBeInTheDocument();
    });

    test('should be able to update store state', () => {
        const initialState = {
            entities: {
                users: {
                    profiles: {
                        user1: TestHelper.getUserMock({id: 'user1', username: 'Echo'}),
                        user2: TestHelper.getUserMock({id: 'user2', username: 'Foxtrot'}),
                    },
                },
            },
        };

        const TestComponent = () => {
            const user1 = useSelector((state: GlobalState) => getUser(state, 'user1'));
            const user2 = useSelector((state: GlobalState) => getUser(state, 'user2'));

            return <div>{`User1 is ${user1.username} and User2 is ${user2.username}!`}</div>;
        };

        const {updateStoreState} = renderWithFullContext(
            <TestComponent/>,
            initialState,
        );

        expect(screen.getByText('User1 is Echo and User2 is Foxtrot!')).toBeInTheDocument();

        updateStoreState({
            entities: {
                users: {
                    profiles: {
                        user1: {username: 'Golf'},
                    },
                },
            },
        });

        expect(screen.getByText('User1 is Golf and User2 is Foxtrot!')).toBeInTheDocument();

        updateStoreState({
            entities: {
                users: {
                    profiles: {
                        user2: {username: 'Hotel'},
                    },
                },
            },
        });

        expect(screen.getByText('User1 is Golf and User2 is Hotel!')).toBeInTheDocument();
    });
});
