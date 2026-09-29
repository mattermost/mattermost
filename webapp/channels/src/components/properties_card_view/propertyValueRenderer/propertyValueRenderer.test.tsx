// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import type {FieldType, PropertyField, PropertyValue, SelectPropertyField} from '@mattermost/types/properties';

import {renderWithContext} from 'tests/react_testing_utils';

import PropertyValueRenderer from './propertyValueRenderer';
import {SPECIALISED_TEXT_SUBTYPES, canRenderPropertyValue} from './renderable';

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

jest.mock('./option_property_renderer/option_property_renderer', () => {
    return function MockOptionPropertyRenderer({field, value, maxItems}: {field: PropertyField; value: PropertyValue<unknown>; maxItems?: number}) {
        return (
            <div data-testid='mock-option-property'>
                {JSON.stringify(value.value)}
                <span data-testid='mock-option-field-type'>{field.type}</span>
                <span data-testid='mock-option-max-items'>{String(maxItems)}</span>
            </div>
        );
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

        // Falls back rather than blanking: a subtype added server-side before
        // this client knows about it still stores a string, and a caller that
        // budgeted a slot for it (the post chip row) would otherwise spend the
        // slot on nothing.
        it('should render an unknown text subtype as plain text', () => {
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

            renderWithContext(
                <PropertyValueRenderer
                    field={field}
                    value={value}
                />,
            );

            expect(screen.getByTestId('mock-text-property')).toBeInTheDocument();
            expect(screen.getByText('test value')).toBeInTheDocument();
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

    // One renderer for the whole option-bearing family, so the dispatch test is
    // about which types reach it and what cap they carry, not about markup.
    describe('option-bearing field types', () => {
        const optionField = (type: string) => ({
            id: 'field-1',
            name: 'Option Field',
            type,
            attrs: {
                options: [
                    {id: 'option1', name: 'Option 1', color: 'blue'},
                    {id: 'option2', name: 'Option 2', color: 'red'},
                ],
            },
        } as SelectPropertyField);

        it.each(['select', 'rank', 'multiselect'])('should render OptionPropertyRenderer for a %s field', (type) => {
            renderWithContext(
                <PropertyValueRenderer
                    field={optionField(type)}
                    value={{value: 'option1'} as PropertyValue<string>}
                />,
            );

            expect(screen.getByTestId('mock-option-property')).toBeInTheDocument();
            expect(screen.getByTestId('mock-option-field-type')).toHaveTextContent(type);
        });

        // Without this, the chip row's budget stops at the field boundary and a
        // single multiselect holding twelve entries renders twelve chips.
        it('should pass maxItems through to the renderer', () => {
            renderWithContext(
                <PropertyValueRenderer
                    field={optionField('multiselect')}
                    value={{value: ['option1', 'option2']} as PropertyValue<string[]>}
                    maxItems={1}
                />,
            );

            expect(screen.getByTestId('mock-option-max-items')).toHaveTextContent('1');
        });

        it('should leave maxItems undefined when the caller sets no budget', () => {
            renderWithContext(
                <PropertyValueRenderer
                    field={optionField('multiselect')}
                    value={{value: ['option1', 'option2']} as PropertyValue<string[]>}
                />,
            );

            expect(screen.getByTestId('mock-option-max-items')).toHaveTextContent('undefined');
        });
    });

    describe('multiuser field type', () => {
        const multiuserField = {
            id: 'field-1',
            name: 'Reviewers',
            type: 'multiuser',
            attrs: {},
        } as unknown as PropertyField;

        it('should render one UserPropertyRenderer per stored id', () => {
            renderWithContext(
                <PropertyValueRenderer
                    field={multiuserField}
                    value={{value: ['user-id-1', 'user-id-2']} as PropertyValue<string[]>}
                />,
            );

            expect(screen.getAllByTestId('mock-user-property').map((node) => node.textContent)).
                toEqual(['user-id-1', 'user-id-2']);
        });

        // The chip row's budget stops at the field boundary otherwise, and one
        // multiuser holding twelve ids renders twelve chips in one slot.
        it('should cap the list at maxItems', () => {
            renderWithContext(
                <PropertyValueRenderer
                    field={multiuserField}
                    value={{value: ['user-id-1', 'user-id-2', 'user-id-3']} as PropertyValue<string[]>}
                    maxItems={2}
                />,
            );

            expect(screen.getAllByTestId('mock-user-property').map((node) => node.textContent)).
                toEqual(['user-id-1', 'user-id-2']);
        });

        // `toValueList` normalises, so a field that holds one id without an array
        // around it behaves as `user` does rather than rendering nothing.
        it('should render a bare value as a single entry', () => {
            renderWithContext(
                <PropertyValueRenderer
                    field={multiuserField}
                    value={{value: 'user-id-1'} as PropertyValue<string>}
                />,
            );

            expect(screen.getAllByTestId('mock-user-property').map((node) => node.textContent)).
                toEqual(['user-id-1']);
        });
    });

    describe('unsupported field types', () => {
        it.each([
            ['an unrecognised type', 'unsupported', 'test value'],
            ['date', 'date', 1642694400000],
        ])('should return null for %s', (_label, type, raw) => {
            const field = {
                id: 'field-1',
                name: 'Unrendered Field',
                type,
                attrs: {},
            } as unknown as PropertyField;

            const {container} = renderWithContext(
                <PropertyValueRenderer
                    field={field}
                    value={{value: raw} as PropertyValue<unknown>}
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

describe('canRenderPropertyValue agrees with what PropertyValueRenderer draws', () => {
    function makeField(type: FieldType, attrs: PropertyField['attrs']): PropertyField {
        return {
            id: 'field_1',
            group_id: 'group_1',
            name: 'attr',
            type,
            target_id: '',
            target_type: 'system',
            object_type: 'post',
            create_at: 1,
            update_at: 1,
            delete_at: 0,
            created_by: 'user_1',
            updated_by: 'user_1',
            attrs,
        };
    }

    function drawsSomething(field: PropertyField, raw: unknown): boolean {
        const {container, unmount} = renderWithContext(
            <PropertyValueRenderer
                field={field}
                value={{value: raw} as PropertyValue<unknown>}
            />,
        );
        const drawn = container.innerHTML !== '';
        unmount();
        return drawn;
    }

    /*
     * A value shaped to suit each type, so no type reads as unrenderable merely
     * because it was handed the wrong shape.
     *
     * Typed as a total Record, which is the point: adding a member to
     * `FieldType` fails to compile here until it is given a sample value, and
     * the case below then forces a decision about whether it renders.
     */
    const VALUE_BY_TYPE: Record<FieldType, unknown> = {
        text: 'MM-1',
        select: 'opt_1',
        rank: 'opt_1',
        multiselect: ['opt_1'],
        user: 'user_1',
        multiuser: ['user_1'],
        date: 1700000000000,
        graph: ['opt_1'],
    };

    const ALL_FIELD_TYPES = Object.keys(VALUE_BY_TYPE) as FieldType[];

    it.each(ALL_FIELD_TYPES)('%s', (type) => {
        const field = makeField(type, {options: [{id: 'opt_1', name: 'OPT'}]});

        expect(canRenderPropertyValue(field)).toBe(drawsSomething(field, VALUE_BY_TYPE[type]));
    });

    // 'text' and an unknown subtype both fall back to the plain renderer, so
    // every one of these draws something.
    it.each([...SPECIALISED_TEXT_SUBTYPES, 'text', 'not_a_subtype'])('text subtype %s', (subType) => {
        const field = makeField('text', {subType});

        expect(canRenderPropertyValue(field)).toBe(true);
        expect(drawsSomething(field, 'MM-1')).toBe(true);
    });
});
