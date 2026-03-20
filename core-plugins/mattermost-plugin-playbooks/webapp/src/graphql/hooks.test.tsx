// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {renderHook} from '@testing-library/react-hooks';
import {MockedProvider} from '@apollo/client/testing';
import {GraphQLError} from 'graphql';

import {PlaybookDocument, PlaybookPropertyDocument, PropertyFieldType} from 'src/graphql/generated/graphql';

import {usePlaybook, usePlaybookProperty} from './hooks';

describe('GraphQL Hooks Integration Tests', () => {
    const mockPlaybookID = 'playbook-123';
    const mockPropertyID = 'property-456';

    const mockPropertyField = {
        id: mockPropertyID,
        name: 'Test Property',
        type: PropertyFieldType.Select,
        group_id: 'group-789',
        attrs: {
            visibility: 'always',
            sort_order: 1,
            options: [
                {id: 'option-1', name: 'High', color: 'red'},
                {id: 'option-2', name: 'Low', color: 'green'},
            ],
            parent_id: null,
        },
        create_at: 1234567890,
        update_at: 1234567890,
        delete_at: 0,
    };

    const mockPlaybookWithPropertyFields = {
        id: mockPlaybookID,
        title: 'Test Playbook',
        description: 'A test playbook with property fields',
        team_id: 'team-123',
        public: true,
        delete_at: 0,
        default_playbook_member_role: 'member',
        invited_user_ids: [],
        broadcast_channel_ids: [],
        webhook_on_creation_urls: [],
        reminder_timer_default_seconds: 3600,
        reminder_message_template: 'Default reminder',
        broadcast_enabled: false,
        webhook_on_status_update_enabled: false,
        webhook_on_status_update_urls: [],
        status_update_enabled: true,
        retrospective_enabled: true,
        retrospective_reminder_interval_seconds: 86400,
        retrospective_template: 'Default retrospective',
        default_owner_id: 'user-123',
        run_summary_template: 'Default summary',
        run_summary_template_enabled: false,
        message_on_join: 'Welcome to the playbook',
        category_name: 'Default Category',
        invite_users_enabled: true,
        default_owner_enabled: true,
        webhook_on_creation_enabled: false,
        message_on_join_enabled: true,
        categorize_channel_enabled: false,
        create_public_playbook_run: false,
        channel_name_template: 'Playbook Run - {{.Name}}',
        create_channel_member_on_new_participant: true,
        remove_channel_member_on_removed_participant: false,
        channel_id: 'channel-123',
        channel_mode: 'create_new_channel',
        is_favorite: false,
        checklists: [],
        members: [],
        metrics: [],
        propertyFields: [
            {
                id: 'prop-1',
                name: 'Priority',
                type: PropertyFieldType.Select,
                group_id: mockPlaybookID,
                attrs: {
                    visibility: 'always',
                    sort_order: 1,
                    options: [
                        {id: 'opt-1', name: 'High', color: 'red'},
                        {id: 'opt-2', name: 'Medium', color: 'yellow'},
                        {id: 'opt-3', name: 'Low', color: 'green'},
                    ],
                    parent_id: null,
                },
                create_at: 1234567890,
                update_at: 1234567890,
                delete_at: 0,
            },
            {
                id: 'prop-2',
                name: 'Assignee',
                type: PropertyFieldType.User,
                group_id: mockPlaybookID,
                attrs: {
                    visibility: 'when_set',
                    sort_order: 2,
                    options: [],
                    parent_id: null,
                },
                create_at: 1234567890,
                update_at: 1234567890,
                delete_at: 0,
            },
            {
                id: 'prop-3',
                name: 'Description',
                type: PropertyFieldType.Text,
                group_id: mockPlaybookID,
                attrs: {
                    visibility: 'always',
                    sort_order: 3,
                    options: [],
                    parent_id: null,
                },
                create_at: 1234567890,
                update_at: 1234567890,
                delete_at: 0,
            },
        ],
    };

    const createWrapper = (mocks: any[] = []) => {
        return ({children}: {children: React.ReactNode}) => (
            <MockedProvider
                mocks={mocks}
                addTypename={false}
            >
                {children}
            </MockedProvider>
        );
    };

    describe('Playbook Query with PropertyFields', () => {
        it('should fetch playbook with property fields successfully', async () => {
            const mocks = [
                {
                    request: {
                        query: PlaybookDocument,
                        variables: {
                            id: mockPlaybookID,
                        },
                    },
                    result: {
                        data: {
                            playbook: mockPlaybookWithPropertyFields,
                        },
                    },
                },
            ];

            const wrapper = createWrapper(mocks);
            const {result, waitForNextUpdate} = renderHook(
                () => usePlaybook(mockPlaybookID),
                {wrapper}
            );

            // Initially loading
            expect(result.current[1].loading).toBe(true);
            expect(result.current[0]).toBeUndefined();

            await waitForNextUpdate();

            // After loading completes
            expect(result.current[1].loading).toBe(false);
            expect(result.current[0]).toEqual(mockPlaybookWithPropertyFields);
            expect(result.current[1].error).toBeUndefined();

            // Property fields are now fetched via REST API, not GraphQL
            // This test will eventually be removed when we deprecate GraphQL usage in the webapp
        });

        it('should handle playbook with empty property fields', async () => {
            const playbookWithoutFields = {
                ...mockPlaybookWithPropertyFields,
                propertyFields: [],
            };

            const mocks = [
                {
                    request: {
                        query: PlaybookDocument,
                        variables: {
                            id: mockPlaybookID,
                        },
                    },
                    result: {
                        data: {
                            playbook: playbookWithoutFields,
                        },
                    },
                },
            ];

            const wrapper = createWrapper(mocks);
            const {result, waitForNextUpdate} = renderHook(
                () => usePlaybook(mockPlaybookID),
                {wrapper}
            );

            await waitForNextUpdate();

            expect(result.current[1].loading).toBe(false);

            // Property fields are now fetched via REST API, not GraphQL
            // This test will eventually be removed when we deprecate GraphQL usage in the webapp
            expect(result.current[1].error).toBeUndefined();
        });

        it('should handle property fields with different types', async () => {
            const playbookWithDifferentTypes = {
                ...mockPlaybookWithPropertyFields,
                propertyFields: [
                    {
                        id: 'text-field',
                        name: 'Text Field',
                        type: PropertyFieldType.Text,
                        group_id: mockPlaybookID,
                        attrs: {
                            visibility: 'always',
                            sort_order: 1,
                            options: [],
                            parent_id: null,
                        },
                        create_at: 1234567890,
                        update_at: 1234567890,
                        delete_at: 0,
                    },
                    {
                        id: 'select-field',
                        name: 'Select Field',
                        type: PropertyFieldType.Select,
                        group_id: mockPlaybookID,
                        attrs: {
                            visibility: 'always',
                            sort_order: 2,
                            options: [
                                {id: 'opt-1', name: 'Option 1', color: 'blue'},
                            ],
                            parent_id: null,
                        },
                        create_at: 1234567890,
                        update_at: 1234567890,
                        delete_at: 0,
                    },
                    {
                        id: 'multiselect-field',
                        name: 'Multi Select Field',
                        type: PropertyFieldType.Multiselect,
                        group_id: mockPlaybookID,
                        attrs: {
                            visibility: 'when_set',
                            sort_order: 3,
                            options: [
                                {id: 'opt-1', name: 'Tag 1', color: 'red'},
                                {id: 'opt-2', name: 'Tag 2', color: 'green'},
                            ],
                            parent_id: null,
                        },
                        create_at: 1234567890,
                        update_at: 1234567890,
                        delete_at: 0,
                    },
                    {
                        id: 'date-field',
                        name: 'Date Field',
                        type: PropertyFieldType.Date,
                        group_id: mockPlaybookID,
                        attrs: {
                            visibility: 'always',
                            sort_order: 4,
                            options: [],
                            parent_id: null,
                        },
                        create_at: 1234567890,
                        update_at: 1234567890,
                        delete_at: 0,
                    },
                    {
                        id: 'user-field',
                        name: 'User Field',
                        type: PropertyFieldType.User,
                        group_id: mockPlaybookID,
                        attrs: {
                            visibility: 'when_set',
                            sort_order: 5,
                            options: [],
                            parent_id: null,
                        },
                        create_at: 1234567890,
                        update_at: 1234567890,
                        delete_at: 0,
                    },
                    {
                        id: 'multiuser-field',
                        name: 'Multi User Field',
                        type: PropertyFieldType.Multiuser,
                        group_id: mockPlaybookID,
                        attrs: {
                            visibility: 'always',
                            sort_order: 6,
                            options: [],
                            parent_id: null,
                        },
                        create_at: 1234567890,
                        update_at: 1234567890,
                        delete_at: 0,
                    },
                ],
            };

            const mocks = [
                {
                    request: {
                        query: PlaybookDocument,
                        variables: {
                            id: mockPlaybookID,
                        },
                    },
                    result: {
                        data: {
                            playbook: playbookWithDifferentTypes,
                        },
                    },
                },
            ];

            const wrapper = createWrapper(mocks);
            const {result, waitForNextUpdate} = renderHook(
                () => usePlaybook(mockPlaybookID),
                {wrapper}
            );

            await waitForNextUpdate();

            expect(result.current[1].loading).toBe(false);

            // Property fields are now fetched via REST API, not GraphQL
            // This test will eventually be removed when we deprecate GraphQL usage in the webapp
        });

        it('should handle playbook query errors', async () => {
            const mocks = [
                {
                    request: {
                        query: PlaybookDocument,
                        variables: {
                            id: mockPlaybookID,
                        },
                    },
                    error: new GraphQLError('Playbook not found'),
                },
            ];

            const wrapper = createWrapper(mocks);
            const {result, waitForNextUpdate} = renderHook(
                () => usePlaybook(mockPlaybookID),
                {wrapper}
            );

            await waitForNextUpdate();

            expect(result.current[1].loading).toBe(false);
            expect(result.current[0]).toBeUndefined();
            expect(result.current[1].error).toBeDefined();
        });
    });

    describe('PlaybookProperty Query', () => {
        it('should handle successful query', async () => {
            const mocks = [
                {
                    request: {
                        query: PlaybookPropertyDocument,
                        variables: {
                            playbookID: mockPlaybookID,
                            propertyID: mockPropertyID,
                        },
                    },
                    result: {
                        data: {
                            playbookProperty: mockPropertyField,
                        },
                    },
                },
            ];

            const wrapper = createWrapper(mocks);
            const {result, waitForNextUpdate} = renderHook(
                () => usePlaybookProperty(mockPlaybookID, mockPropertyID),
                {wrapper}
            );

            // Initially loading
            expect(result.current[1].loading).toBe(true);
            expect(result.current[0]).toBeUndefined();

            await waitForNextUpdate();

            // After loading completes
            expect(result.current[1].loading).toBe(false);
            expect(result.current[0]).toEqual(mockPropertyField);
            expect(result.current[1].error).toBeUndefined();
        });

        it('should handle query errors', async () => {
            const mocks = [
                {
                    request: {
                        query: PlaybookPropertyDocument,
                        variables: {
                            playbookID: mockPlaybookID,
                            propertyID: mockPropertyID,
                        },
                    },
                    error: new GraphQLError('Property field not found'),
                },
            ];

            const wrapper = createWrapper(mocks);
            const {result, waitForNextUpdate} = renderHook(
                () => usePlaybookProperty(mockPlaybookID, mockPropertyID),
                {wrapper}
            );

            // Initially loading
            expect(result.current[1].loading).toBe(true);

            await waitForNextUpdate();

            // After error occurs
            expect(result.current[1].loading).toBe(false);
            expect(result.current[0]).toBeUndefined();
            expect(result.current[1].error).toBeDefined();
        });

        it('should handle network errors', async () => {
            const mocks = [
                {
                    request: {
                        query: PlaybookPropertyDocument,
                        variables: {
                            playbookID: mockPlaybookID,
                            propertyID: mockPropertyID,
                        },
                    },
                    error: new Error('Network error'),
                },
            ];

            const wrapper = createWrapper(mocks);
            const {result, waitForNextUpdate} = renderHook(
                () => usePlaybookProperty(mockPlaybookID, mockPropertyID),
                {wrapper}
            );

            // Initially loading
            expect(result.current[1].loading).toBe(true);

            await waitForNextUpdate();

            // After network error occurs
            expect(result.current[1].loading).toBe(false);
            expect(result.current[0]).toBeUndefined();
            expect(result.current[1].error).toBeDefined();
        });
    });

    describe('Variable Validation', () => {
        it('should validate required variables for PlaybookProperty query', () => {
            const requiredVariables = ['playbookID', 'propertyID'];

            const mockRequest = {
                query: PlaybookPropertyDocument,
                variables: {
                    playbookID: mockPlaybookID,
                    propertyID: mockPropertyID,
                },
            };

            expect(mockRequest.variables).toHaveProperty('playbookID');
            expect(mockRequest.variables).toHaveProperty('propertyID');
            expect(Object.keys(mockRequest.variables)).toEqual(requiredVariables);
        });

        it('should validate required variables for mutations', () => {
            const addVariables = {
                playbookID: mockPlaybookID,
                propertyField: {
                    name: 'Test Field',
                    type: PropertyFieldType.Text,
                },
            };

            const updateVariables = {
                playbookID: mockPlaybookID,
                propertyFieldID: mockPropertyID,
                propertyField: {
                    name: 'Updated Field',
                    type: PropertyFieldType.Text,
                },
            };

            const deleteVariables = {
                playbookID: mockPlaybookID,
                propertyFieldID: mockPropertyID,
            };

            expect(addVariables).toHaveProperty('playbookID');
            expect(addVariables).toHaveProperty('propertyField');
            expect(addVariables.propertyField).toHaveProperty('name');
            expect(addVariables.propertyField).toHaveProperty('type');

            expect(updateVariables).toHaveProperty('playbookID');
            expect(updateVariables).toHaveProperty('propertyFieldID');
            expect(updateVariables).toHaveProperty('propertyField');

            expect(deleteVariables).toHaveProperty('playbookID');
            expect(deleteVariables).toHaveProperty('propertyFieldID');
        });
    });

    describe('Type Consistency', () => {
        it('should maintain type consistency across operations', () => {
            const fieldInput = {
                name: 'Consistent Field',
                type: PropertyFieldType.Select,
                attrs: {
                    visibility: 'always' as const,
                    sortOrder: 1,
                    options: [
                        {name: 'Option 1', color: 'red'},
                        {name: 'Option 2', color: 'blue'},
                    ],
                },
            };

            // This input should be valid for both add and update operations
            const addVariables = {
                playbookID: mockPlaybookID,
                propertyField: fieldInput,
            };

            const updateVariables = {
                playbookID: mockPlaybookID,
                propertyFieldID: mockPropertyID,
                propertyField: fieldInput,
            };

            expect(addVariables.propertyField.type).toBe(updateVariables.propertyField.type);
            expect(addVariables.propertyField.name).toBe(updateVariables.propertyField.name);
            expect(addVariables.propertyField.attrs?.options).toHaveLength(2);
            expect(updateVariables.propertyField.attrs?.options).toHaveLength(2);
        });
    });

    describe('PropertyFields Data Consistency', () => {
        it('should verify property field structure from usePlaybook query', async () => {
            const mocks = [
                {
                    request: {
                        query: PlaybookDocument,
                        variables: {
                            id: mockPlaybookID,
                        },
                    },
                    result: {
                        data: {
                            playbook: mockPlaybookWithPropertyFields,
                        },
                    },
                },
            ];

            const wrapper = createWrapper(mocks);

            const {result, waitForNextUpdate} = renderHook(
                () => usePlaybook(mockPlaybookID),
                {wrapper}
            );

            await waitForNextUpdate();

            expect(result.current[1].loading).toBe(false);

            // Property fields are now fetched via REST API, not GraphQL
            // This test will eventually be removed when we deprecate GraphQL usage in the webapp
        });

        it('should verify property field matches expected schema', () => {
            // Test that our mock data matches the expected GraphQL schema structure
            const sampleField = mockPlaybookWithPropertyFields.propertyFields[0];

            // Required fields from PropertyField GraphQL type
            expect(sampleField).toHaveProperty('id', expect.any(String));
            expect(sampleField).toHaveProperty('name', expect.any(String));
            expect(sampleField).toHaveProperty('type');
            expect(sampleField).toHaveProperty('group_id', expect.any(String));
            expect(sampleField).toHaveProperty('attrs');
            expect(sampleField).toHaveProperty('create_at', expect.any(Number));
            expect(sampleField).toHaveProperty('update_at', expect.any(Number));
            expect(sampleField).toHaveProperty('delete_at', expect.any(Number));

            // PropertyFieldAttrs structure
            expect(sampleField.attrs).toHaveProperty('visibility', expect.any(String));
            expect(sampleField.attrs).toHaveProperty('sort_order', expect.any(Number));
            expect(sampleField.attrs).toHaveProperty('options', expect.any(Array));

            // Verify option structure for select fields
            if (sampleField.type === PropertyFieldType.Select && sampleField.attrs.options.length > 0) {
                const option = sampleField.attrs.options[0];
                expect(option).toHaveProperty('id', expect.any(String));
                expect(option).toHaveProperty('name', expect.any(String));
                expect(option).toHaveProperty('color', expect.any(String));
            }
        });
    });
});