// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    AddPlaybookPropertyFieldDocument,
    DeletePlaybookPropertyFieldDocument,
    PlaybookPropertyDocument,
    PropertyFieldAttrsInput,
    PropertyFieldInput,
    PropertyFieldType,
    PropertyOptionInput,
    UpdatePlaybookPropertyFieldDocument,
} from 'src/graphql/generated/graphql';

describe('Property Fields GraphQL Operations', () => {
    describe('Query Documents', () => {
        it('PlaybookPropertyDocument should have correct structure', () => {
            expect(PlaybookPropertyDocument).toBeDefined();
            expect(PlaybookPropertyDocument.kind).toBe('Document');
            expect(PlaybookPropertyDocument.definitions).toHaveLength(1);

            const operation = PlaybookPropertyDocument.definitions[0] as any;
            expect(operation.kind).toBe('OperationDefinition');
            expect(operation.operation).toBe('query');
            expect(operation.name?.value).toBe('PlaybookProperty');

            // Check variables
            expect(operation.variableDefinitions).toHaveLength(2);
            const variables = operation.variableDefinitions!.map((v: any) => v.variable.name.value);
            expect(variables).toContain('playbookID');
            expect(variables).toContain('propertyID');
        });

        it('PlaybookPropertyDocument should request all required fields', () => {
            const operation = PlaybookPropertyDocument.definitions[0] as any;
            const selectionSet = operation.selectionSet.selections[0].selectionSet;
            const fieldNames = selectionSet.selections.map((s: any) => s.alias?.value || s.name.value);

            // Check that all expected fields are requested
            expect(fieldNames).toContain('id');
            expect(fieldNames).toContain('name');
            expect(fieldNames).toContain('type');
            expect(fieldNames).toContain('group_id');
            expect(fieldNames).toContain('create_at');
            expect(fieldNames).toContain('update_at');
            expect(fieldNames).toContain('delete_at');
            expect(fieldNames).toContain('attrs');
        });
    });

    describe('Mutation Documents', () => {
        it('AddPlaybookPropertyFieldDocument should have correct structure', () => {
            expect(AddPlaybookPropertyFieldDocument).toBeDefined();
            expect(AddPlaybookPropertyFieldDocument.kind).toBe('Document');

            const operation = AddPlaybookPropertyFieldDocument.definitions[0] as any;
            expect(operation.kind).toBe('OperationDefinition');
            expect(operation.operation).toBe('mutation');
            expect(operation.name?.value).toBe('AddPlaybookPropertyField');

            // Check variables
            const variables = operation.variableDefinitions!.map((v: any) => v.variable.name.value);
            expect(variables).toContain('playbookID');
            expect(variables).toContain('propertyField');
        });

        it('UpdatePlaybookPropertyFieldDocument should have correct structure', () => {
            expect(UpdatePlaybookPropertyFieldDocument).toBeDefined();

            const operation = UpdatePlaybookPropertyFieldDocument.definitions[0] as any;
            expect(operation.operation).toBe('mutation');
            expect(operation.name?.value).toBe('UpdatePlaybookPropertyField');

            // Check variables
            const variables = operation.variableDefinitions!.map((v: any) => v.variable.name.value);
            expect(variables).toContain('playbookID');
            expect(variables).toContain('propertyFieldID');
            expect(variables).toContain('propertyField');
        });

        it('DeletePlaybookPropertyFieldDocument should have correct structure', () => {
            expect(DeletePlaybookPropertyFieldDocument).toBeDefined();

            const operation = DeletePlaybookPropertyFieldDocument.definitions[0] as any;
            expect(operation.operation).toBe('mutation');
            expect(operation.name?.value).toBe('DeletePlaybookPropertyField');

            // Check variables
            const variables = operation.variableDefinitions!.map((v: any) => v.variable.name.value);
            expect(variables).toContain('playbookID');
            expect(variables).toContain('propertyFieldID');
        });
    });

    describe('Type Safety', () => {
        it('PropertyFieldType enum should have all expected values', () => {
            expect(PropertyFieldType.Text).toBe('text');
            expect(PropertyFieldType.Select).toBe('select');
            expect(PropertyFieldType.Multiselect).toBe('multiselect');
            expect(PropertyFieldType.Date).toBe('date');
            expect(PropertyFieldType.User).toBe('user');
            expect(PropertyFieldType.Multiuser).toBe('multiuser');
        });

        it('PropertyFieldInput should accept valid input', () => {
            const validInput: PropertyFieldInput = {
                name: 'Test Field',
                type: PropertyFieldType.Select,
                attrs: {
                    visibility: 'always',
                    sortOrder: 1,
                    options: [
                        {
                            name: 'Option 1',
                            color: 'red',
                        },
                        {
                            id: 'existing-option',
                            name: 'Option 2',
                            color: 'blue',
                        },
                    ],
                },
            };

            // TypeScript compilation should pass for valid input
            expect(validInput.name).toBe('Test Field');
            expect(validInput.type).toBe(PropertyFieldType.Select);
            expect(validInput.attrs?.options).toHaveLength(2);
        });

        it('PropertyFieldAttrsInput should be optional', () => {
            const minimalInput: PropertyFieldInput = {
                name: 'Minimal Field',
                type: PropertyFieldType.Text,

                // attrs is optional
            };

            expect(minimalInput.name).toBe('Minimal Field');
            expect(minimalInput.attrs).toBeUndefined();
        });

        it('PropertyOptionInput should handle both new and existing options', () => {
            // New option (no ID)
            const newOption: PropertyOptionInput = {
                name: 'New Option',
                color: 'green',
            };

            // Existing option (with ID)
            const existingOption: PropertyOptionInput = {
                id: 'option-123',
                name: 'Existing Option',
                color: 'blue',
            };

            expect(newOption.id).toBeUndefined();
            expect(newOption.name).toBe('New Option');

            expect(existingOption.id).toBe('option-123');
            expect(existingOption.name).toBe('Existing Option');
        });
    });

    describe('Input Validation', () => {
        it('should handle text field input correctly', () => {
            const textFieldInput: PropertyFieldInput = {
                name: 'Description',
                type: PropertyFieldType.Text,
                attrs: {
                    visibility: 'when_set',
                    sortOrder: 2,
                },
            };

            expect(textFieldInput.type).toBe('text');
            expect(textFieldInput.attrs?.visibility).toBe('when_set');
            expect(textFieldInput.attrs?.options).toBeUndefined();
        });

        it('should handle select field input with options', () => {
            const selectFieldInput: PropertyFieldInput = {
                name: 'Priority',
                type: PropertyFieldType.Select,
                attrs: {
                    visibility: 'always',
                    sortOrder: 1,
                    options: [
                        {name: 'High', color: 'red'},
                        {name: 'Medium', color: 'yellow'},
                        {name: 'Low', color: 'green'},
                    ],
                },
            };

            expect(selectFieldInput.type).toBe('select');
            expect(selectFieldInput.attrs?.options).toHaveLength(3);
            expect(selectFieldInput.attrs?.options?.[0].name).toBe('High');
        });

        it('should handle multiselect field input', () => {
            const multiselectFieldInput: PropertyFieldInput = {
                name: 'Tags',
                type: PropertyFieldType.Multiselect,
                attrs: {
                    visibility: 'always',
                    sortOrder: 3,
                    options: [
                        {name: 'Frontend', color: 'blue'},
                        {name: 'Backend', color: 'purple'},
                        {name: 'DevOps', color: 'orange'},
                    ],
                },
            };

            expect(multiselectFieldInput.type).toBe('multiselect');
            expect(multiselectFieldInput.attrs?.options).toHaveLength(3);
        });

        it('should handle date field input', () => {
            const dateFieldInput: PropertyFieldInput = {
                name: 'Due Date',
                type: PropertyFieldType.Date,
                attrs: {
                    visibility: 'when_set',
                    sortOrder: 4,
                },
            };

            expect(dateFieldInput.type).toBe('date');
            expect(dateFieldInput.attrs?.options).toBeUndefined();
        });

        it('should handle user field input', () => {
            const userFieldInput: PropertyFieldInput = {
                name: 'Assignee',
                type: PropertyFieldType.User,
                attrs: {
                    visibility: 'always',
                    sortOrder: 5,
                },
            };

            expect(userFieldInput.type).toBe('user');
            expect(userFieldInput.attrs?.options).toBeUndefined();
        });

        it('should handle multiuser field input', () => {
            const multiuserFieldInput: PropertyFieldInput = {
                name: 'Reviewers',
                type: PropertyFieldType.Multiuser,
                attrs: {
                    visibility: 'always',
                    sortOrder: 6,
                },
            };

            expect(multiuserFieldInput.type).toBe('multiuser');
            expect(multiuserFieldInput.attrs?.options).toBeUndefined();
        });
    });

    describe('Visibility Options', () => {
        it('should accept valid visibility values', () => {
            const visibilityOptions = ['always', 'when_set', 'hidden'];

            visibilityOptions.forEach((visibility) => {
                const attrs: PropertyFieldAttrsInput = {
                    visibility,
                    sortOrder: 1,
                };

                expect(attrs.visibility).toBe(visibility);
            });
        });
    });

    describe('Sort Order', () => {
        it('should accept numeric sort order', () => {
            const attrs: PropertyFieldAttrsInput = {
                sortOrder: 42.5,
                visibility: 'always',
            };

            expect(attrs.sortOrder).toBe(42.5);
        });

        it('should allow undefined sort order', () => {
            const attrs: PropertyFieldAttrsInput = {
                visibility: 'always',

                // sortOrder is optional
            };

            expect(attrs.sortOrder).toBeUndefined();
        });
    });

    describe('Nested Options', () => {
        it('should handle parent-child relationships', () => {
            const parentAttrs: PropertyFieldAttrsInput = {
                visibility: 'always',
                sortOrder: 1,
            };

            const childAttrs: PropertyFieldAttrsInput = {
                visibility: 'when_set',
                sortOrder: 2,
                parentID: 'parent-field-id',
            };

            expect(parentAttrs.parentID).toBeUndefined();
            expect(childAttrs.parentID).toBe('parent-field-id');
        });
    });

    describe('Option Colors', () => {
        it('should handle optional colors for options', () => {
            const optionWithColor: PropertyOptionInput = {
                name: 'Colored Option',
                color: 'red',
            };

            const optionWithoutColor: PropertyOptionInput = {
                name: 'Plain Option',

                // color is optional
            };

            expect(optionWithColor.color).toBe('red');
            expect(optionWithoutColor.color).toBeUndefined();
        });
    });
});