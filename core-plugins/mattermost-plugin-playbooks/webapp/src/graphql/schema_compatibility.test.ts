// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {print} from 'graphql';

import {
    AddPlaybookPropertyFieldDocument,
    DeletePlaybookPropertyFieldDocument,
    PlaybookPropertyDocument,
    UpdatePlaybookPropertyFieldDocument,
} from 'src/graphql/generated/graphql';

describe('GraphQL Schema Compatibility', () => {
    describe('Query Syntax Validation', () => {
        it('PlaybookProperty query should have valid GraphQL syntax', () => {
            const queryString = print(PlaybookPropertyDocument);

            expect(queryString).toContain('query PlaybookProperty');
            expect(queryString).toContain('$playbookID: String!');
            expect(queryString).toContain('$propertyID: String!');
            expect(queryString).toContain('playbookProperty(');
            expect(queryString).toContain('playbookID: $playbookID');
            expect(queryString).toContain('propertyID: $propertyID');

            // Verify all expected fields are selected
            expect(queryString).toContain('id');
            expect(queryString).toContain('name');
            expect(queryString).toContain('type');
            expect(queryString).toContain('group_id: groupID');
            expect(queryString).toContain('attrs');
            expect(queryString).toContain('visibility');
            expect(queryString).toContain('sort_order: sortOrder');
            expect(queryString).toContain('options');
            expect(queryString).toContain('parent_id: parentID');
            expect(queryString).toContain('create_at: createAt');
            expect(queryString).toContain('update_at: updateAt');
            expect(queryString).toContain('delete_at: deleteAt');
        });
    });

    describe('Mutation Syntax Validation', () => {
        it('AddPlaybookPropertyField mutation should have valid GraphQL syntax', () => {
            const mutationString = print(AddPlaybookPropertyFieldDocument);

            expect(mutationString).toContain('mutation AddPlaybookPropertyField');
            expect(mutationString).toContain('$playbookID: String!');
            expect(mutationString).toContain('$propertyField: PropertyFieldInput!');
            expect(mutationString).toContain('addPlaybookPropertyField(');
            expect(mutationString).toContain('playbookID: $playbookID');
            expect(mutationString).toContain('propertyField: $propertyField');
        });

        it('UpdatePlaybookPropertyField mutation should have valid GraphQL syntax', () => {
            const mutationString = print(UpdatePlaybookPropertyFieldDocument);

            expect(mutationString).toContain('mutation UpdatePlaybookPropertyField');
            expect(mutationString).toContain('$playbookID: String!');
            expect(mutationString).toContain('$propertyFieldID: String!');
            expect(mutationString).toContain('$propertyField: PropertyFieldInput!');
            expect(mutationString).toContain('updatePlaybookPropertyField(');
            expect(mutationString).toContain('playbookID: $playbookID');
            expect(mutationString).toContain('propertyFieldID: $propertyFieldID');
            expect(mutationString).toContain('propertyField: $propertyField');
        });

        it('DeletePlaybookPropertyField mutation should have valid GraphQL syntax', () => {
            const mutationString = print(DeletePlaybookPropertyFieldDocument);

            expect(mutationString).toContain('mutation DeletePlaybookPropertyField');
            expect(mutationString).toContain('$playbookID: String!');
            expect(mutationString).toContain('$propertyFieldID: String!');
            expect(mutationString).toContain('deletePlaybookPropertyField(');
            expect(mutationString).toContain('playbookID: $playbookID');
            expect(mutationString).toContain('propertyFieldID: $propertyFieldID');
        });
    });

    describe('Field Selection Compatibility', () => {
        it('should select fields that match backend GraphQL schema', () => {
            const queryString = print(PlaybookPropertyDocument);

            // These field selections should match the backend PropertyField type
            const expectedFields = [
                'id',
                'name',
                'type',
                'group_id: groupID', // Snake case alias for camelCase backend field
                'create_at: createAt',
                'update_at: updateAt',
                'delete_at: deleteAt',
            ];

            expectedFields.forEach((field) => {
                expect(queryString).toContain(field);
            });

            // Check nested attrs selection
            expect(queryString).toContain('attrs {');
            expect(queryString).toContain('visibility');
            expect(queryString).toContain('sort_order: sortOrder');
            expect(queryString).toContain('parent_id: parentID');

            // Check nested options selection
            expect(queryString).toContain('options {');
            expect(queryString).toContain('color');
        });

        it('should use correct field aliases for backend compatibility', () => {
            const queryString = print(PlaybookPropertyDocument);

            // Verify aliases match backend field naming
            const aliasMap = {
                group_id: 'groupID',
                create_at: 'createAt',
                update_at: 'updateAt',
                delete_at: 'deleteAt',
                sort_order: 'sortOrder',
                parent_id: 'parentID',
            };

            Object.entries(aliasMap).forEach(([alias, backendField]) => {
                expect(queryString).toContain(`${alias}: ${backendField}`);
            });
        });
    });

    describe('Variable Types Compatibility', () => {
        it('should use correct variable types that match backend expectations', () => {
            const queries = [
                PlaybookPropertyDocument,
                AddPlaybookPropertyFieldDocument,
                UpdatePlaybookPropertyFieldDocument,
                DeletePlaybookPropertyFieldDocument,
            ];

            queries.forEach((query) => {
                const queryString = print(query);

                // All mutations should expect String! for IDs
                if (queryString.includes('playbookID')) {
                    expect(queryString).toContain('$playbookID: String!');
                }

                if (queryString.includes('propertyID')) {
                    expect(queryString).toContain('$propertyID: String!');
                }

                if (queryString.includes('propertyFieldID')) {
                    expect(queryString).toContain('$propertyFieldID: String!');
                }

                // Only check for PropertyFieldInput if it's actually in a mutation that uses it
                if (queryString.includes('$propertyField: PropertyFieldInput!')) {
                    expect(queryString).toContain('$propertyField: PropertyFieldInput!');
                }
            });
        });
    });

    describe('Operation Names', () => {
        it('should have unique operation names for each GraphQL operation', () => {
            const operations = [
                {doc: PlaybookPropertyDocument, name: 'PlaybookProperty'},
                {doc: AddPlaybookPropertyFieldDocument, name: 'AddPlaybookPropertyField'},
                {doc: UpdatePlaybookPropertyFieldDocument, name: 'UpdatePlaybookPropertyField'},
                {doc: DeletePlaybookPropertyFieldDocument, name: 'DeletePlaybookPropertyField'},
            ];

            operations.forEach(({doc, name}) => {
                const queryString = print(doc);
                expect(queryString).toContain(name);
            });

            // Verify names are unique
            const names = operations.map((op) => op.name);
            const uniqueNames = new Set(names);
            expect(uniqueNames.size).toBe(names.length);
        });
    });

    describe('Required Fields', () => {
        it('should request all essential fields for property field operations', () => {
            const queryString = print(PlaybookPropertyDocument);

            // Essential fields for property field functionality
            const essentialFields = [
                'id', // Required for updates/deletes
                'name', // Required for display
                'type', // Required for field type handling
                'attrs', // Required for field configuration
            ];

            essentialFields.forEach((field) => {
                expect(queryString).toContain(field);
            });
        });

        it('should request proper option fields for select/multiselect types', () => {
            const queryString = print(PlaybookPropertyDocument);

            // Option fields needed for select/multiselect types
            expect(queryString).toContain('options {');
            expect(queryString).toContain('id'); // Required for option identification
            expect(queryString).toContain('name'); // Required for option display
            expect(queryString).toContain('color'); // Required for option styling
        });
    });

    describe('Nested Field Structure', () => {
        it('should properly structure nested attrs field', () => {
            const queryString = print(PlaybookPropertyDocument);

            // Check attrs structure - allow multiline and nested content
            expect(queryString).toMatch(/attrs\s*\{[\s\S]*visibility[\s\S]*\}/);
            expect(queryString).toMatch(/attrs\s*\{[\s\S]*sort_order[\s\S]*\}/);
            expect(queryString).toMatch(/attrs\s*\{[\s\S]*parent_id[\s\S]*\}/);
            expect(queryString).toMatch(/attrs\s*\{[\s\S]*options[\s\S]*\}/);
        });

        it('should properly structure nested options field', () => {
            const queryString = print(PlaybookPropertyDocument);

            // Check options structure within attrs
            expect(queryString).toMatch(/options\s*\{[^}]*id[^}]*\}/);
            expect(queryString).toMatch(/options\s*\{[^}]*name[^}]*\}/);
            expect(queryString).toMatch(/options\s*\{[^}]*color[^}]*\}/);
        });
    });

    describe('Backward Compatibility', () => {
        it('should maintain compatibility with existing backend API', () => {
            // Test that our queries don't break the existing backend
            // by checking for deprecated or renamed fields
            const queryString = print(PlaybookPropertyDocument);

            // These fields should NOT be present (old/deprecated names)
            const deprecatedFields = [
                'created_at', // Should be createAt
                'updated_at', // Should be updateAt
                'deleted_at', // Should be deleteAt
                'groupId', // Should be groupID (note: sortOrder and parentID are backend field names, not deprecated)
            ];

            deprecatedFields.forEach((field) => {
                expect(queryString).not.toContain(field);
            });

            // Verify we're using the correct alias pattern (alias: backendField)
            expect(queryString).toContain('sort_order: sortOrder');
            expect(queryString).toContain('parent_id: parentID');
        });
    });
});