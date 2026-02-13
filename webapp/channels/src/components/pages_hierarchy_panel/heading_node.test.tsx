// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext} from 'tests/react_testing_utils';
import type {Heading} from 'utils/page_outline';

import type {GlobalState} from 'types/store';

import HeadingNode from './heading_node';

describe('HeadingNode', () => {
    const baseProps = {
        heading: {
            id: 'heading-0',
            text: 'Test Heading',
            level: 1,
        } as Heading,
        pageId: 'page123',
        depth: 1,
        teamName: 'test-team',
    };

    const initialState: DeepPartial<GlobalState> = {
        entities: {
            users: {
                currentUserId: 'user-1',
            },
            teams: {
                currentTeamId: 'test-team',
                teams: {
                    'test-team': {
                        id: 'test-team',
                        name: 'test-team',
                        display_name: 'Test Team',
                        delete_at: 0,
                        create_at: 0,
                        update_at: 0,
                        type: 'O',
                        company_name: '',
                        allowed_domains: '',
                        invite_id: '',
                        allow_open_invite: false,
                        scheme_id: '',
                        group_constrained: false,
                        policy_id: '',
                        description: '',
                        email: '',
                    },
                },
            },
            channels: {
                currentChannelId: 'current-channel',
            },
        },
    };

    describe('Rendering', () => {
        test('should render heading node with correct text', () => {
            const {container} = renderWithContext(<HeadingNode {...baseProps}/>, initialState);

            expect(screen.getByText('Test Heading')).toBeInTheDocument();
            expect(container.querySelector('.HeadingNode__text')).toHaveTextContent('Test Heading');
        });

        test('should render button with text', () => {
            const {container} = renderWithContext(<HeadingNode {...baseProps}/>, initialState);

            const button = container.querySelector('.HeadingNode__button');
            expect(button).toBeInTheDocument();
            expect(button).toHaveTextContent('Test Heading');
        });

        test('should apply correct padding based on depth and level', () => {
            const {container} = renderWithContext(<HeadingNode {...baseProps}/>, initialState);

            const expectedPadding = ((baseProps.heading.level - 1) * 12) + 18;
            const button = container.querySelector('.HeadingNode__button');
            expect(button).toHaveStyle({
                paddingLeft: `${expectedPadding}px`,
            });
        });

        test('should apply correct padding for nested heading (depth=2, level=2)', () => {
            const props = {
                ...baseProps,
                heading: {...baseProps.heading, level: 2},
                depth: 2,
            };
            const {container} = renderWithContext(<HeadingNode {...props}/>, initialState);

            const expectedPadding = ((2 - 1) * 12) + 18;
            const button = container.querySelector('.HeadingNode__button');
            expect(button).toHaveStyle({
                paddingLeft: `${expectedPadding}px`,
            });
        });

        test('should have correct ARIA attributes', () => {
            const {container} = renderWithContext(<HeadingNode {...baseProps}/>, initialState);
            const button = container.querySelector('.HeadingNode__button');

            expect(button).toHaveAttribute('role', 'treeitem');
            expect(button).toHaveAttribute('aria-level', String(baseProps.heading.level));
        });

        test('should render different heading levels with correct ARIA levels', () => {
            const levels = [1, 2, 3];

            levels.forEach((level) => {
                const props = {
                    ...baseProps,
                    heading: {...baseProps.heading, level},
                };
                const {container} = renderWithContext(<HeadingNode {...props}/>, initialState);
                const button = container.querySelector('.HeadingNode__button');

                expect(button).toHaveAttribute('aria-level', String(level));
            });
        });

        test('should render with correct class names', () => {
            const {container} = renderWithContext(<HeadingNode {...baseProps}/>, initialState);

            expect(container.querySelector('.HeadingNode')).toBeInTheDocument();
            expect(container.querySelector('.HeadingNode__button')).toBeInTheDocument();
            expect(container.querySelector('.HeadingNode__text')).toBeInTheDocument();
        });

        test('should handle long heading text', () => {
            const longText = 'This is a very long heading text that should be handled properly without breaking the layout or causing issues';
            const props = {
                ...baseProps,
                heading: {...baseProps.heading, text: longText},
            };
            const {container} = renderWithContext(<HeadingNode {...props}/>, initialState);

            expect(screen.getByText(longText)).toBeInTheDocument();
            expect(container.querySelector('.HeadingNode__text')).toHaveTextContent(longText);
        });

        test('should handle special characters in heading text', () => {
            const specialText = 'Heading with *markdown* **bold** and `code`';
            const props = {
                ...baseProps,
                heading: {...baseProps.heading, text: specialText},
            };
            const {container} = renderWithContext(<HeadingNode {...props}/>, initialState);

            expect(screen.getByText(specialText)).toBeInTheDocument();
            expect(container.querySelector('.HeadingNode__text')).toHaveTextContent(specialText);
        });
    });

    describe('Structure', () => {
        test('should render button element', () => {
            const {container} = renderWithContext(<HeadingNode {...baseProps}/>, initialState);

            const button = container.querySelector('.HeadingNode__button');
            expect(button?.tagName).toBe('BUTTON');
        });

        test('should render text within button', () => {
            const {container} = renderWithContext(<HeadingNode {...baseProps}/>, initialState);

            const button = container.querySelector('.HeadingNode__button');
            const text = button?.querySelector('.HeadingNode__text');

            expect(text).toBeInTheDocument();
            expect(text).toHaveTextContent('Test Heading');
        });
    });

    describe('Multiple Heading Levels', () => {
        test('should render level 1 heading with correct padding', () => {
            const props = {
                ...baseProps,
                heading: {...baseProps.heading, level: 1},
            };
            const {container} = renderWithContext(<HeadingNode {...props}/>, initialState);

            const expectedPadding = ((1 - 1) * 12) + 18; // 18px
            const button = container.querySelector('.HeadingNode__button');
            expect(button).toHaveStyle({paddingLeft: `${expectedPadding}px`});
        });

        test('should render level 2 heading with correct padding', () => {
            const props = {
                ...baseProps,
                heading: {...baseProps.heading, level: 2},
            };
            const {container} = renderWithContext(<HeadingNode {...props}/>, initialState);

            const expectedPadding = ((2 - 1) * 12) + 18; // 30px
            const button = container.querySelector('.HeadingNode__button');
            expect(button).toHaveStyle({paddingLeft: `${expectedPadding}px`});
        });

        test('should render level 3 heading with correct padding', () => {
            const props = {
                ...baseProps,
                heading: {...baseProps.heading, level: 3},
            };
            const {container} = renderWithContext(<HeadingNode {...props}/>, initialState);

            const expectedPadding = ((3 - 1) * 12) + 18; // 42px
            const button = container.querySelector('.HeadingNode__button');
            expect(button).toHaveStyle({paddingLeft: `${expectedPadding}px`});
        });
    });

    describe('Edge Cases', () => {
        test('should handle empty heading text', () => {
            const props = {
                ...baseProps,
                heading: {...baseProps.heading, text: ''},
            };
            const {container} = renderWithContext(<HeadingNode {...props}/>, initialState);

            const textElement = container.querySelector('.HeadingNode__text');
            expect(textElement).toBeInTheDocument();
            expect(textElement).toHaveTextContent('');
        });

        test('should handle heading with only whitespace', () => {
            const props = {
                ...baseProps,
                heading: {...baseProps.heading, text: '   '},
            };
            const {container} = renderWithContext(<HeadingNode {...props}/>, initialState);

            const textElement = container.querySelector('.HeadingNode__text');
            expect(textElement).toBeInTheDocument();
        });

        test('should handle heading at maximum depth', () => {
            const props = {
                ...baseProps,
                heading: {...baseProps.heading, level: 6},
                depth: 10,
            };
            const {container} = renderWithContext(<HeadingNode {...props}/>, initialState);

            const expectedPadding = ((6 - 1) * 12) + 18; // 78px
            const button = container.querySelector('.HeadingNode__button');
            expect(button).toHaveStyle({paddingLeft: `${expectedPadding}px`});
        });
    });
});
