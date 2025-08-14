// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import type {PropertyField, PropertyValue, SelectPropertyField, TextPropertyField} from '@mattermost/types/properties';

import {renderWithContext} from 'tests/react_testing_utils';

import PropertyValueRenderer from './propertyValueRenderer';

// Mock all child components
jest.mock('./text_property_renderer/textPropertyRenderer', () => {
    return function MockTextPropertyRenderer({value}: {value: PropertyValue<unknown>}) {
        return <div data-testid="mock-text-property">{String(value.value)}</div>;
    };
});

jest.mock('./user_property_renderer/userPropertyRenderer', () => {
    return function MockUserPropertyRenderer({field, value}: {field: PropertyField; value: PropertyValue<unknown>}) {
        return <div data-testid="mock-user-property">{String(value.value)}</div>;
    };
});

jest.mock('./select_property_renderer/selectPropertyRenderer', () => {
    return function MockSelectPropertyRenderer({field, value}: {field: PropertyField; value: PropertyValue<unknown>}) {
        return <div data-testid="mock-select-property">{String(value.value)}</div>;
    };
});

jest.mock('./post_preview_property_renderer/post_preview_property_renderer', () => {
    return function MockPostPreviewPropertyRenderer({value}: {value: PropertyValue<unknown>}) {
        return <div data-testid="mock-post-preview-property">{String(value.value)}</div>;
    };
});

jest.mock('./channel_property_renderer/channel_property_renderer', () => {
    return function MockChannelPropertyRenderer({value}: {value: PropertyValue<unknown>}) {
        return <div data-testid="mock-channel-property">{String(value.value)}</div>;
    };
});

jest.mock('./team_property_renderer/team_property_renderer', () => {
    return function MockTeamPropertyRenderer({value}: {value: PropertyValue<unknown>}) {
        return <div data-testid="mock-team-property">{String(value.value)}</div>;
    };
});

jest.mock('./timestamp_property_renderer/timestamp_property_renderer', () => {
    return function MockTimestampPropertyRenderer({value}: {value: PropertyValue<unknown>}) {
        return <div data-testid="mock-timestamp-property">{String(value.value)}</div>;
    };
});

describe('PropertyValueRenderer', () => {
    describe('text field type', () => {
        it('should render TextPropertyRenderer for text subtype', () => {
            const field: TextPropertyField = {
                id: 'field-1',
                name: 'Text Field',
                type: 'text',
                attrs: {
                    subType: 'text',
                },
            };
            const value: PropertyValue<string> = {
                value: 'test text',
            };

            renderWithContext(
                <PropertyValueRenderer field={field} value={value}/>,
            );

            expect(screen.getByTestId('mock-text-property')).toBeInTheDocument();
            expect(screen.getByText('test text')).toBeInTheDocument();
        });

        it('should render TextPropertyRenderer for text field without subType', () => {
            const field: TextPropertyField = {
                id: 'field-1',
                name: 'Text Field',
                type: 'text',
                attrs: {},
            };
            const value: PropertyValue<string> = {
                value: 'test text',
            };

            renderWithContext(
                <PropertyValueRenderer field={field} value={value}/>,
            );

            expect(screen.getByTestId('mock-text-property')).toBeInTheDocument();
            expect(screen.getByText('test text')).toBeInTheDocument();
        });

        it('should render PostPreviewPropertyRenderer for post subtype', () => {
            const field: TextPropertyField = {
                id: 'field-1',
                name: 'Post Field',
                type: 'text',
                attrs: {
                    subType: 'post',
                },
            };
            const value: PropertyValue<string> = {
                value: 'post-id-123',
            };

            renderWithContext(
                <PropertyValueRenderer field={field} value={value}/>,
            );

            expect(screen.getByTestId('mock-post-preview-property')).toBeInTheDocument();
            expect(screen.getByText('post-id-123')).toBeInTheDocument();
        });

        it('should render ChannelPropertyRenderer for channel subtype', () => {
            const field: TextPropertyField = {
                id: 'field-1',
                name: 'Channel Field',
                type: 'text',
                attrs: {
                    subType: 'channel',
                },
            };
            const value: PropertyValue<string> = {
                value: 'channel-id-123',
            };

            renderWithContext(
                <PropertyValueRenderer field={field} value={value}/>,
            );

            expect(screen.getByTestId('mock-channel-property')).toBeInTheDocument();
            expect(screen.getByText('channel-id-123')).toBeInTheDocument();
        });

        it('should render TeamPropertyRenderer for team subtype', () => {
            const field: TextPropertyField = {
                id: 'field-1',
                name: 'Team Field',
                type: 'text',
                attrs: {
                    subType: 'team',
                },
            };
            const value: PropertyValue<string> = {
                value: 'team-id-123',
            };

            renderWithContext(
                <PropertyValueRenderer field={field} value={value}/>,
            );

            expect(screen.getByTestId('mock-team-property')).toBeInTheDocument();
            expect(screen.getByText('team-id-123')).toBeInTheDocument();
        });

        it('should render TimestampPropertyRenderer for timestamp subtype', () => {
            const field: TextPropertyField = {
                id: 'field-1',
                name: 'Timestamp Field',
                type: 'text',
                attrs: {
                    subType: 'timestamp',
                },
            };
            const value: PropertyValue<number> = {
                value: 1642694400000,
            };

            renderWithContext(
                <PropertyValueRenderer field={field} value={value}/>,
            );

            expect(screen.getByTestId('mock-timestamp-property')).toBeInTheDocument();
            expect(screen.getByText('1642694400000')).toBeInTheDocument();
        });

        it('should return null for unknown text subtype', () => {
            const field: TextPropertyField = {
                id: 'field-1',
                name: 'Unknown Field',
                type: 'text',
                attrs: {
                    subType: 'unknown' as any,
                },
            };
            const value: PropertyValue<string> = {
                value: 'test value',
            };

            const {container} = renderWithContext(
                <PropertyValueRenderer field={field} value={value}/>,
            );

            expect(container.firstChild).toBeNull();
        });
    });

    describe('user field type', () => {
        it('should render UserPropertyRenderer for user field', () => {
            const field: PropertyField = {
                id: 'field-1',
                name: 'User Field',
                type: 'user',
                attrs: {},
            };
            const value: PropertyValue<string> = {
                value: 'user-id-123',
            };

            renderWithContext(
                <PropertyValueRenderer field={field} value={value}/>,
            );

            expect(screen.getByTestId('mock-user-property')).toBeInTheDocument();
            expect(screen.getByText('user-id-123')).toBeInTheDocument();
        });
    });

    describe('select field type', () => {
        it('should render SelectPropertyRenderer for select field', () => {
            const field: SelectPropertyField = {
                id: 'field-1',
                name: 'Select Field',
                type: 'select',
                attrs: {
                    options: [
                        {id: 'option1', name: 'Option 1', color: 'blue'},
                    ],
                },
            };
            const value: PropertyValue<string> = {
                value: 'option1',
            };

            renderWithContext(
                <PropertyValueRenderer field={field} value={value}/>,
            );

            expect(screen.getByTestId('mock-select-property')).toBeInTheDocument();
            expect(screen.getByText('option1')).toBeInTheDocument();
        });
    });

    describe('unsupported field types', () => {
        it('should return null for unsupported field type', () => {
            const field: PropertyField = {
                id: 'field-1',
                name: 'Unsupported Field',
                type: 'unsupported' as any,
                attrs: {},
            };
            const value: PropertyValue<string> = {
                value: 'test value',
            };

            const {container} = renderWithContext(
                <PropertyValueRenderer field={field} value={value}/>,
            );

            expect(container.firstChild).toBeNull();
        });

        it('should return null for multiselect field type', () => {
            const field: PropertyField = {
                id: 'field-1',
                name: 'Multiselect Field',
                type: 'multiselect',
                attrs: {},
            };
            const value: PropertyValue<string[]> = {
                value: ['option1', 'option2'],
            };

            const {container} = renderWithContext(
                <PropertyValueRenderer field={field} value={value}/>,
            );

            expect(container.firstChild).toBeNull();
        });

        it('should return null for date field type', () => {
            const field: PropertyField = {
                id: 'field-1',
                name: 'Date Field',
                type: 'date',
                attrs: {},
            };
            const value: PropertyValue<number> = {
                value: 1642694400000,
            };

            const {container} = renderWithContext(
                <PropertyValueRenderer field={field} value={value}/>,
            );

            expect(container.firstChild).toBeNull();
        });
    });

    describe('edge cases', () => {
        it('should handle text field without attrs', () => {
            const field: PropertyField = {
                id: 'field-1',
                name: 'Text Field',
                type: 'text',
            };
            const value: PropertyValue<string> = {
                value: 'test text',
            };

            renderWithContext(
                <PropertyValueRenderer field={field} value={value}/>,
            );

            expect(screen.getByTestId('mock-text-property')).toBeInTheDocument();
            expect(screen.getByText('test text')).toBeInTheDocument();
        });

        it('should handle empty string value', () => {
            const field: PropertyField = {
                id: 'field-1',
                name: 'Text Field',
                type: 'text',
                attrs: {},
            };
            const value: PropertyValue<string> = {
                value: '',
            };

            renderWithContext(
                <PropertyValueRenderer field={field} value={value}/>,
            );

            expect(screen.getByTestId('mock-text-property')).toBeInTheDocument();
            expect(screen.getByText('')).toBeInTheDocument();
        });

        it('should handle null value', () => {
            const field: PropertyField = {
                id: 'field-1',
                name: 'Text Field',
                type: 'text',
                attrs: {},
            };
            const value: PropertyValue<null> = {
                value: null,
            };

            renderWithContext(
                <PropertyValueRenderer field={field} value={value}/>,
            );

            expect(screen.getByTestId('mock-text-property')).toBeInTheDocument();
            expect(screen.getByText('null')).toBeInTheDocument();
        });

        it('should handle undefined value', () => {
            const field: PropertyField = {
                id: 'field-1',
                name: 'Text Field',
                type: 'text',
                attrs: {},
            };
            const value: PropertyValue<undefined> = {
                value: undefined,
            };

            renderWithContext(
                <PropertyValueRenderer field={field} value={value}/>,
            );

            expect(screen.getByTestId('mock-text-property')).toBeInTheDocument();
            expect(screen.getByText('undefined')).toBeInTheDocument();
        });
    });
});
