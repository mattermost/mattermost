import React from 'react';
import type {Preview} from '@storybook/react';
import {IntlProvider} from 'react-intl';
import {Router} from 'react-router-dom';
import {createMemoryHistory} from 'history';

import en from '../src/i18n/en.json';

// Import main Mattermost styles - this includes Bootstrap, Font Awesome, and all component styles
// The sass-loader is configured with proper includePaths to resolve @use statements
import '../src/sass/styles.scss';

// Import additional CSS variable overrides for Storybook if needed
import './storybook-styles.css';

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
            );
        },
    ],
};

export default preview;
