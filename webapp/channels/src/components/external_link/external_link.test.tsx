// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {mount} from 'enzyme';
import React from 'react';
import {Provider} from 'react-redux';

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import mockStore from 'tests/test_store';

import type {GlobalState} from 'types/store';

import ExternalLink from '.';

describe('components/external_link', () => {
    const initialState: DeepPartial<GlobalState> = {
        entities: {
            general: {
                config: {},
                license: {
                    Cloud: 'true',
                },
            },
            users: {
                currentUserId: 'currentUserId',
            },
        },
    };

    it('should match snapshot', () => {
        const store = mockStore(initialState);
        const wrapper = mount(
            <Provider store={store}>
                <ExternalLink
                    location='test'
                    href='https://mattermost.com'

                >{'Click Me'}</ExternalLink>
            </Provider>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    it('should attach parameters', () => {
        const state = {
            ...initialState,
            entities: {
                ...initialState.entities,
                general: {
                    ...initialState?.entities?.general,
                    config: {
                        DiagnosticsEnabled: 'true',
                    },
                },
            },
        };
        renderWithContext(
            <ExternalLink
                location='test'
                href='https://mattermost.com'
            >
                {'Click Me'}
            </ExternalLink>,
            state,
        );

        expect(screen.queryByText('Click Me')).toHaveAttribute(
            'href',
            expect.stringMatching('utm_source=mattermost&utm_medium=in-product-cloud&utm_content=test&uid=currentUserId&sid='),
        );
    });

    it('should preserve query params that already exist in the href', () => {
        const state = {
            ...initialState,
            entities: {
                ...initialState.entities,
                general: {
                    ...initialState?.entities?.general,
                    config: {
                        DiagnosticsEnabled: 'true',
                    },
                },
            },
        };
        renderWithContext(
            <ExternalLink
                location='test'
                href='https://mattermost.com?test=true'
            >
                {'Click Me'}
            </ExternalLink>,
            state,
        );

        expect(screen.queryByText('Click Me')).toHaveAttribute(
            'href',
            'https://mattermost.com?utm_source=mattermost&utm_medium=in-product-cloud&utm_content=test&uid=currentUserId&sid=&test=true',
        );
    });

    it("should not attach parameters if href isn't *.mattermost.com enabled", () => {
        const state = {
            ...initialState,
            entities: {
                ...initialState.entities,
                general: {
                    ...initialState?.entities?.general,
                    config: {
                        DiagnosticsEnabled: 'true',
                    },
                },
            },
        };
        renderWithContext(
            <ExternalLink
                location='test'
                href='https://google.com'
            >
                {'Click Me'}
            </ExternalLink>,
            state,
        );

        expect(screen.queryByText('Click Me')).not.toHaveAttribute(
            'href',
            'utm_source=mattermost&utm_medium=in-product-cloud&utm_content=&uid=currentUserId&sid=',
        );
    });

    it('should be able to override target, rel', () => {
        const state = {
            ...initialState,
            entities: {
                ...initialState.entities,
                general: {
                    ...initialState?.entities?.general,
                    config: {
                        DiagnosticsEnabled: 'true',
                    },
                },
            },
        };
        renderWithContext(
            <ExternalLink
                target='test'
                rel='test'
                href='https://google.com'
                location='test'
            >{'Click Me'}</ExternalLink>,
            state,
        );

        expect(screen.queryByText('Click Me')).toHaveAttribute(
            'target',
            expect.stringMatching(
                'test',
            ),
        );
        expect(screen.queryByText('Click Me')).toHaveAttribute(
            'rel',
            expect.stringMatching('test'),
        );
    });

    it('renders href correctly when url contains anchor by setting anchor at the end', () => {
        const state = {
            ...initialState,
            entities: {
                ...initialState.entities,
                general: {
                    ...initialState?.entities?.general,
                    config: {
                        DiagnosticsEnabled: 'true',
                    },
                },
            },
        };
        renderWithContext(
            <ExternalLink
                location='test'
                href='https://mattermost.com#desktop'
            >
                {'Click Me'}
            </ExternalLink>,
            state,
        );

        expect(screen.queryByText('Click Me')).toHaveAttribute(
            'href',
            'https://mattermost.com?utm_source=mattermost&utm_medium=in-product-cloud&utm_content=test&uid=currentUserId&sid=#desktop',
        );
    });
});
