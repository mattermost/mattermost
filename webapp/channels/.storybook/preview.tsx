import React from 'react';
import type {Preview} from '@storybook/react';
import {IntlProvider} from 'react-intl';
import {Provider} from 'react-redux';
import {Router} from 'react-router-dom';
import {createMemoryHistory} from 'history';

import configureStore from '../src/store';
import en from '../src/i18n/en.json';

// Import main Mattermost styles - this includes Bootstrap, Font Awesome, and all component styles
// The sass-loader is configured with proper includePaths to resolve @use statements
import '../src/sass/styles.scss';

// Create a minimal Redux store with essential state for Storybook
// This mirrors the pattern used in webapp/channels/src/tests/react_testing_utils.tsx
const initialState = {
    entities: {
        general: {
            config: {},
            license: {},
        },
        users: {
            currentUserId: '',
            profiles: {},
        },
        teams: {
            currentTeamId: '',
            teams: {},
        },
        channels: {
            currentChannelId: '',
            channels: {},
        },
        preferences: {
            myPreferences: {},
        },
    },
    views: {},
    websocket: {
        connected: false,
    },
};

const store = configureStore(initialState);

const preview: Preview = {
    parameters: {
        actions: {argTypesRegex: '^on[A-Z].*'},
        controls: {
            matchers: {
                color: /(background|color)$/i,
                date: /Date$/i,
            },
        },
        backgrounds: {
            default: 'mattermost',
            values: [
                {
                    name: 'mattermost',
                    value: '#ffffff',
                },
                {
                    name: 'dark',
                    value: '#1e1e1e',
                },
            ],
        },
    },
    decorators: [
        (Story) => {
            const history = createMemoryHistory();
            return (
                <Provider store={store}>
                    <IntlProvider
                        locale="en"
                        messages={en}
                        defaultLocale="en"
                    >
                        <Router history={history}>
                            <div className="app__body" style={{padding: '20px', minHeight: '100vh'}}>
                                <Story />
                            </div>
                        </Router>
                    </IntlProvider>
                </Provider>
            );
        },
    ],
};

export default preview;
