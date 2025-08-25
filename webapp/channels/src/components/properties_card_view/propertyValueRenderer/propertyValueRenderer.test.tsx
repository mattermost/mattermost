// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import type {PropertyField, PropertyValue, SelectPropertyField} from '@mattermost/types/properties';

import {renderWithContext} from 'tests/react_testing_utils';

import PropertyValueRenderer from './propertyValueRenderer';

// Mock all child components
jest.mock('./text_property_renderer/textPropertyRenderer', () => {
    return function MockTextPropertyRenderer({value}: {value: PropertyValue<unknown>}) {
        return <div data-testid='mock-text-property'>{String(value.value)}</div>;
    };
});

jest.mock('./user_property_renderer/userPropertyRenderer', () => {
    return function MockUserPropertyRenderer({value}: {field: PropertyField; value: PropertyValue<unknown>}) {
        return <div data-testid='mock-user-property'>{String(value.value)}</div>;
    };
});

jest.mock('./select_property_renderer/selectPropertyRenderer', () => {
    return function MockSelectPropertyRenderer({value}: {field: PropertyField; value: PropertyValue<unknown>}) {
        return <div data-testid='mock-select-property'>{String(value.value)}</div>;
    };
});

jest.mock('./post_preview_property_renderer/post_preview_property_renderer', () => {
    return function MockPostPreviewPropertyRenderer({value}: {value: PropertyValue<unknown>}) {
        return <div data-testid='mock-post-preview-property'>{String(value.value)}</div>;
    };
});

jest.mock('./channel_property_renderer/channel_property_renderer', () => {
    return function MockChannelPropertyRenderer({value}: {value: PropertyValue<unknown>}) {
        return <div data-testid='mock-channel-property'>{String(value.value)}</div>;
    };
});

jest.mock('./team_property_renderer/team_property_renderer', () => {
    return function MockTeamPropertyRenderer({value}: {value: PropertyValue<unknown>}) {
        return <div data-testid='mock-team-property'>{String(value.value)}</div>;
    };
});

jest.mock('./timestamp_property_renderer/timestamp_property_renderer', () => {
    return function MockTimestampPropertyRenderer({value}: {value: PropertyValue<unknown>}) {
        return <div data-testid='mock-timestamp-property'>{String(value.value)}</div>;
    };
});

describe('PropertyValueRenderer', () => {
    describe('text field type', () => {
        it('should render TextPropertyRenderer for text subtype', () => {
            const field = {
                id: 'field-1',
                name: 'Text Field',
                type: 'text',
                attrs: {
                    subType: 'text',
                },
            } as PropertyField;

            const value = {
                value: 'test text',
            } as PropertyValue<string>;

            renderWithContext(
                <PropertyValueRenderer
                    field={field}
                    value={value}
                />,
            );

            expect(screen.getByTestId('mock-text-property')).toBeInTheDocument();
            expect(screen.getByText('test text')).toBeInTheDocument();
        });

        it('should render TextPropertyRenderer for text field without subType', () => {
            const field = {
                id: 'field-1',
                name: 'Text Field',
                type: 'text',
                attrs: {},
            } as PropertyField;

            const value = {
                value: 'test text',
            } as PropertyValue<string>;

            renderWithContext(
                <PropertyValueRenderer
                    field={field}
                    value={value}
                />,
            );

            expect(screen.getByTestId('mock-text-property')).toBeInTheDocument();
            expect(screen.getByText('test text')).toBeInTheDocument();
        });

        it('should render PostPreviewPropertyRenderer for post subtype', () => {
            const field = {
                id: 'field-1',
                name: 'Post Field',
                type: 'text',
                attrs: {
                    subType: 'post',
                },
            } as PropertyField;

            const value = {
                value: 'post-id-123',
            } as PropertyValue<string>;

            renderWithContext(
                <PropertyValueRenderer
                    field={field}
                    value={value}
                />,
            );

            expect(screen.getByTestId('mock-post-preview-property')).toBeInTheDocument();
            expect(screen.getByText('post-id-123')).toBeInTheDocument();
        });

        it('should render ChannelPropertyRenderer for channel subtype', () => {
            const field = {
                id: 'field-1',
                name: 'Channel Field',
                type: 'text',
                attrs: {
                    subType: 'channel',
                },
            } as PropertyField;

            const value = {
                value: 'channel-id-123',
            } as PropertyValue<string>;

            renderWithContext(
                <PropertyValueRenderer
                    field={field}
                    value={value}
                />,
            );

            expect(screen.getByTestId('mock-channel-property')).toBeInTheDocument();
            expect(screen.getByText('channel-id-123')).toBeInTheDocument();
        });

        it('should render TeamPropertyRenderer for team subtype', () => {
            const field = {
                id: 'field-1',
                name: 'Team Field',
                type: 'text',
                attrs: {
                    subType: 'team',
                },
            } as PropertyField;

            const value = {
                value: 'team-id-123',
            } as PropertyValue<string>;

            renderWithContext(
                <PropertyValueRenderer
                    field={field}
                    value={value}
                />,
            );

            expect(screen.getByTestId('mock-team-property')).toBeInTheDocument();
            expect(screen.getByText('team-id-123')).toBeInTheDocument();
        });

        it('should render TimestampPropertyRenderer for timestamp subtype', () => {
            const field = {
                id: 'field-1',
                name: 'Timestamp Field',
                type: 'text',
                attrs: {
                    subType: 'timestamp',
                },
            } as PropertyField;

            const value = {
                value: 1642694400000,
            } as PropertyValue<number>;

            renderWithContext(
                <PropertyValueRenderer
                    field={field}
                    value={value}
                />,
            );

            expect(screen.getByTestId('mock-timestamp-property')).toBeInTheDocument();
            expect(screen.getByText('1642694400000')).toBeInTheDocument();
        });

        it('should return null for unknown text subtype', () => {
            const field = {
                id: 'field-1',
                name: 'Unknown Field',
                type: 'text',
                attrs: {
                    subType: 'unknown' as unknown,
                },
            } as PropertyField;

            const value = {
                value: 'test value',
            } as PropertyValue<string>;

            const {container} = renderWithContext(
                <PropertyValueRenderer
                    field={field}
                    value={value}
                />,
            );

            expect(container.firstChild).toBeNull();
        });
    });

    describe('user field type', () => {
        it('should render UserPropertyRenderer for user field', () => {
            const field = {
                id: 'field-1',
                name: 'User Field',
                type: 'user',
                attrs: {},
            } as PropertyField;

            const value = {
                value: 'user-id-123',
            } as PropertyValue<string>;

            renderWithContext(
                <PropertyValueRenderer
                    field={field}
                    value={value}
                />,
            );

            expect(screen.getByTestId('mock-user-property')).toBeInTheDocument();
            expect(screen.getByText('user-id-123')).toBeInTheDocument();
        });
    });

    describe('select field type', () => {
        it('should render SelectPropertyRenderer for select field', () => {
            const field = {
                id: 'field-1',
                name: 'Select Field',
                type: 'select',
                attrs: {
                    options: [
                        {id: 'option1', name: 'Option 1', color: 'blue'},
                    ],
                },
            } as SelectPropertyField;

            const value = {
                value: 'option1',
            } as PropertyValue<string>;

            renderWithContext(
                <PropertyValueRenderer
                    field={field}
                    value={value}
                />,
            );

            expect(screen.getByTestId('mock-select-property')).toBeInTheDocument();
            expect(screen.getByText('option1')).toBeInTheDocument();
        });
    });

    describe('unsupported field types', () => {
        it('should return null for unsupported field type', () => {
            const field = {
                id: 'field-1',
                name: 'Unsupported Field',
                type: 'unsupported' as unknown,
                attrs: {},
            } as PropertyField;

            const value = {
                value: 'test value',
            } as PropertyValue<string>;

            const {container} = renderWithContext(
                <PropertyValueRenderer
                    field={field}
                    value={value}
                />,
            );

            expect(container.firstChild).toBeNull();
        });

        it('should return null for multiselect field type', () => {
            const field = {
                id: 'field-1',
                name: 'Multiselect Field',
                type: 'multiselect',
                attrs: {},
            } as PropertyField;

            const value = {
                value: ['option1', 'option2'],
            } as PropertyValue<string[]>;

            const {container} = renderWithContext(
                <PropertyValueRenderer
                    field={field}
                    value={value}
                />,
            );

            expect(container.firstChild).toBeNull();
        });

        it('should return null for date field type', () => {
            const field = {
                id: 'field-1',
                name: 'Date Field',
                type: 'date',
                attrs: {},
            } as PropertyField;

            const value = {
                value: 1642694400000,
            } as PropertyValue<number>;

            const {container} = renderWithContext(
                <PropertyValueRenderer
                    field={field}
                    value={value}
                />,
            );

            expect(container.firstChild).toBeNull();
        });
    });

    describe('edge cases', () => {
        it('should handle text field without attrs', () => {
            const field = {
                id: 'field-1',
                name: 'Text Field',
                type: 'text',
            } as PropertyField;

            const value = {
                value: 'test text',
            } as PropertyValue<string>;

            renderWithContext(
                <PropertyValueRenderer
                    field={field}
                    value={value}
                />,
            );

            expect(screen.getByTestId('mock-text-property')).toBeInTheDocument();
            expect(screen.getByText('test text')).toBeInTheDocument();
        });

        it('should handle empty string value', () => {
            const field = {
                id: 'field-1',
                name: 'Text Field',
                type: 'text',
                attrs: {},
            } as PropertyField;

            const value = {
                value: '',
            } as PropertyValue<string>;

            renderWithContext(
                <PropertyValueRenderer
                    field={field}
                    value={value}
                />,
            );

            expect(screen.getByTestId('mock-text-property')).toBeInTheDocument();
            expect(screen.getByTestId('mock-text-property')).toHaveTextContent('');
        });

        it('should handle null value', () => {
            const field = {
                id: 'field-1',
                name: 'Text Field',
                type: 'text',
                attrs: {},
            } as PropertyField;
            const value: PropertyValue<null> = {
                value: null,
            } as PropertyValue<null>;

            renderWithContext(
                <PropertyValueRenderer
                    field={field}
                    value={value}
                />,
            );

            expect(screen.getByTestId('mock-text-property')).toBeInTheDocument();
            expect(screen.getByText('null')).toBeInTheDocument();
        });

        it('should handle undefined value', () => {
            const field = {
                id: 'field-1',
                name: 'Text Field',
                type: 'text',
                attrs: {},
            } as PropertyField;

            const value = {
                value: undefined,
            } as PropertyValue<unknown>;

            renderWithContext(
                <PropertyValueRenderer
                    field={field}
                    value={value}
                />,
            );

            expect(screen.getByTestId('mock-text-property')).toBeInTheDocument();
            expect(screen.getByText('undefined')).toBeInTheDocument();
        });
    });
});
