import React from 'react';
import type {Preview} from '@storybook/react';
import {IntlProvider} from 'react-intl';
import {Provider} from 'react-redux';
import {Router} from 'react-router-dom';
import {createMemoryHistory} from 'history';

import configureStore from '../src/store';
import en from '../src/i18n/en.json';
import {getThemeOptions, THEME_KEYS, type ThemeKey, applyThemeToStorybook, getTheme} from './theme-utils';

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
            default: 'Center Channel',
            options: [
                {name: 'Center Channel', value: 'var(--center-channel-bg)'},
                {name: 'Global Header', value: 'var(--sidebar-header-bg)'},
                {name: 'Sidebar', value: 'var(--sidebar-bg)'},
            ],
        },
        layout: 'centered',
    },
    globalTypes: {
        theme: {
            description: 'Mattermost Theme',
            defaultValue: THEME_KEYS.DENIM,
            toolbar: {
                title: 'Theme',
                icon: 'paintbrush',
                items: getThemeOptions(),
                dynamicTitle: true,
            },
        },
    },

    decorators: [
        (Story, context) => {
            const history = createMemoryHistory();

            // Get theme from globals context
            const themeKey = (context.globals.theme || THEME_KEYS.DENIM) as ThemeKey;

            // Theme wrapper component to handle theme application with useEffect
            const ThemeWrapper: React.FC<{children: React.ReactNode}> = ({children}) => {
                const themeObject = getTheme(themeKey);

                React.useEffect(() => {
                    applyThemeToStorybook(themeObject);
                }, [themeObject]);

                return <>{children}</>;
            };

            return (
                <ThemeWrapper>
                    <Provider store={store}>
                        <IntlProvider
                            locale="en"
                            messages={en}
                            defaultLocale="en"
                        >
                            <Router history={history}>
                                <Story />
                            </Router>
                        </IntlProvider>
                    </Provider>
                </ThemeWrapper>
            );
        },
    ],

    initialGlobals: {
        backgrounds: {
            value: 'Center Channel'
        }
    }
};

export default preview;
