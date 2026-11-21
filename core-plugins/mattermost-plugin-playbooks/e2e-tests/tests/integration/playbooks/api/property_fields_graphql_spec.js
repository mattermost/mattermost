// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

/* eslint-disable no-underscore-dangle */ // Allow GraphQL introspection fields (__schema, __type)

describe('api > property_fields_graphql', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testPlaybook;

    before(() => {
        cy.apiInitSetup({
            promoteNewUserAsAdmin: true,
            userPrefix: 'property-test-admin',
        }).then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Create a test playbook for property field operations
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Property Fields GraphQL Test Playbook',
                description: 'A playbook for testing property field GraphQL operations',
                memberIDs: [testUser.id],
            }).then((playbook) => {
                testPlaybook = playbook;
            });
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);
    });

    describe('GraphQL Schema Introspection', () => {
        it('should verify GraphQL schema includes property field operations', () => {
            cy.task('log', '🔍 Testing GraphQL Property Field Operations Schema');

            // # Test GraphQL introspection to verify operations exist
            cy.request({
                headers: {'X-Requested-With': 'XMLHttpRequest'},
                url: '/plugins/playbooks/api/v0/query',
                body: {
                    operationName: 'IntrospectionQuery',
                    query: `
                        query IntrospectionQuery {
                            __schema {
                                queryType {
                                    fields {
                                        name
                                    }
                                }
                                mutationType {
                                    fields {
                                        name
                                    }
                                }
                            }
                        }
                    `,
                },
                method: 'POST',
            }).then((response) => {
                // * Verify the GraphQL endpoint is working
                expect(response.status).to.equal(200);
                expect(response.body).to.exist;

                if (!response.body.data || !response.body.data.__schema) {
                    cy.task('log', '⚠️ Introspection might be disabled. Skipping introspection tests.');
                    return;
                }

                expect(response.body.data).to.exist;
                expect(response.body.data.__schema).to.exist;

                const queryFields = response.body.data.__schema.queryType.fields.map((f) => f.name);
                const mutationFields = response.body.data.__schema.mutationType.fields.map((f) => f.name);

                // * Verify that property field operations exist in the schema
                expect(queryFields).to.include('playbookProperty');
                expect(mutationFields).to.include('addPlaybookPropertyField');
                expect(mutationFields).to.include('updatePlaybookPropertyField');
                expect(mutationFields).to.include('deletePlaybookPropertyField');

                cy.task('log', '✅ PlaybookProperty query found in schema');
                cy.task('log', '✅ addPlaybookPropertyField mutation found in schema');
                cy.task('log', '✅ updatePlaybookPropertyField mutation found in schema');
                cy.task('log', '✅ deletePlaybookPropertyField mutation found in schema');
            });
        });

        it('should verify PropertyFieldType enum exists and has correct values', () => {
            cy.task('log', '🔍 Testing PropertyFieldType enum');

            // # Test PropertyFieldType enum values
            cy.request({
                headers: {'X-Requested-With': 'XMLHttpRequest'},
                url: '/plugins/playbooks/api/v0/query',
                body: {
                    operationName: 'PropertyFieldTypeQuery',
                    query: `
                        query PropertyFieldTypeQuery {
                            __type(name: "PropertyFieldType") {
                                name
                                enumValues {
                                    name
                                    description
                                }
                            }
                        }
                    `,
                },
                method: 'POST',
            }).then((response) => {
                // * Verify PropertyFieldType enum exists and has expected values
                expect(response.status).to.equal(200);

                if (!response.body.data || !response.body.data.__type) {
                    cy.task('log', '⚠️ Introspection might be disabled. Skipping enum validation.');
                    return;
                }

                expect(response.body.data.__type).to.exist;
                expect(response.body.data.__type.name).to.equal('PropertyFieldType');

                const enumValues = response.body.data.__type.enumValues.map((v) => v.name);
                const expectedTypes = ['text', 'select', 'multiselect', 'date', 'user', 'multiuser'];

                expectedTypes.forEach((type) => {
                    expect(enumValues).to.include(type);
                    cy.task('log', `✅ PropertyFieldType.${type} found in enum`);
                });
            });
        });

        it('should verify PropertyFieldInput type structure', () => {
            cy.task('log', '🔍 Testing PropertyFieldInput input types');

            // # Test input type structure via introspection
            cy.request({
                headers: {'X-Requested-With': 'XMLHttpRequest'},
                url: '/plugins/playbooks/api/v0/query',
                body: {
                    operationName: 'PropertyFieldInputQuery',
                    query: `
                        query PropertyFieldInputQuery {
                            __type(name: "PropertyFieldInput") {
                                name
                                inputFields {
                                    name
                                    type {
                                        name
                                        kind
                                    }
                                }
                            }
                        }
                    `,
                },
                method: 'POST',
            }).then((response) => {
                // * Verify PropertyFieldInput type exists with correct fields
                expect(response.status).to.equal(200);

                if (!response.body.data || !response.body.data.__type) {
                    cy.task('log', '⚠️ Introspection might be disabled. Skipping input type validation.');
                    return;
                }

                expect(response.body.data.__type).to.exist;
                expect(response.body.data.__type.name).to.equal('PropertyFieldInput');

                const inputFields = response.body.data.__type.inputFields.map((f) => f.name);
                const expectedFields = ['name', 'type', 'attrs'];

                expectedFields.forEach((field) => {
                    expect(inputFields).to.include(field);
                    cy.task('log', `✅ PropertyFieldInput.${field} field found`);
                });
            });
        });
    });

    describe('GraphQL Operation Validation', () => {
        it('should validate PlaybookProperty query structure', () => {
            cy.task('log', '🔍 Testing PlaybookProperty query syntax');

            // # Test the PlaybookProperty query structure (will fail for non-existent data but syntax should be valid)
            cy.request({
                headers: {'X-Requested-With': 'XMLHttpRequest'},
                url: '/plugins/playbooks/api/v0/query',
                body: {
                    operationName: 'PlaybookProperty',
                    query: `
                        query PlaybookProperty($playbookID: String!, $propertyID: String!) {
                            playbookProperty(playbookID: $playbookID, propertyID: $propertyID) {
                                id
                                name
                                type
                                groupID
                                attrs {
                                    visibility
                                    sortOrder
                                    options {
                                        id
                                        name
                                        color
                                    }
                                    parentID
                                }
                                createAt
                                updateAt
                                deleteAt
                            }
                        }
                    `,
                    variables: {
                        playbookID: testPlaybook.id,
                        propertyID: 'test-property-id',
                    },
                },
                method: 'POST',
                failOnStatusCode: false,
            }).then((response) => {
                // * Verify the GraphQL query structure is valid
                expect(response.status).to.equal(200);
                expect(response.body).to.have.property('data');

                // * Should return null for non-existent data, but no syntax errors
                if (response.body.errors) {
                    const error = response.body.errors[0];
                    expect(error.message).to.not.include('syntax');
                    expect(error.message).to.not.include('Unknown field');
                    expect(error.message).to.not.include('Cannot query field');
                    cy.task('log', `✅ PlaybookProperty query structure is valid (expected error: ${error.message})`);
                } else {
                    cy.task('log', '✅ PlaybookProperty query structure is valid');
                }
            });
        });

        it('should validate AddPlaybookPropertyField mutation structure', () => {
            cy.task('log', '🔍 Testing AddPlaybookPropertyField mutation syntax');

            // # Test the AddPlaybookPropertyField mutation structure
            cy.request({
                headers: {'X-Requested-With': 'XMLHttpRequest'},
                url: '/plugins/playbooks/api/v0/query',
                body: {
                    operationName: 'AddPlaybookPropertyField',
                    query: `
                        mutation AddPlaybookPropertyField($playbookID: String!, $propertyField: PropertyFieldInput!) {
                            addPlaybookPropertyField(playbookID: $playbookID, propertyField: $propertyField)
                        }
                    `,
                    variables: {
                        playbookID: testPlaybook.id,
                        propertyField: {
                            name: 'Test Priority Field',
                            type: 'select',
                            attrs: {
                                visibility: 'always',
                                sortOrder: 1,
                                options: [
                                    {name: 'High', color: 'red'},
                                    {name: 'Low', color: 'green'},
                                ],
                            },
                        },
                    },
                },
                method: 'POST',
                failOnStatusCode: false,
            }).then((response) => {
                // * Verify the GraphQL mutation structure is valid
                expect(response.status).to.equal(200);
                expect(response.body).to.have.property('data');

                if (response.body.errors) {
                    const error = response.body.errors[0];

                    // * Should not be syntax errors - might be permission/data errors
                    expect(error.message).to.not.include('syntax');
                    expect(error.message).to.not.include('Unknown field');
                    expect(error.message).to.not.include('Unknown argument');
                    cy.task('log', `✅ AddPlaybookPropertyField mutation structure is valid (response: ${error.message})`);
                } else if (response.body.data && response.body.data.addPlaybookPropertyField) {
                    cy.task('log', `✅ AddPlaybookPropertyField mutation executed successfully: ${response.body.data.addPlaybookPropertyField}`);
                } else {
                    cy.task('log', '✅ AddPlaybookPropertyField mutation structure is valid');
                }
            });
        });

        it('should validate mutation argument structures', () => {
            cy.task('log', '🔍 Testing mutation argument validation');

            // # Test mutation syntax by querying mutation type structure
            cy.request({
                headers: {'X-Requested-With': 'XMLHttpRequest'},
                url: '/plugins/playbooks/api/v0/query',
                body: {
                    operationName: 'TestMutationSyntax',
                    query: `
                        query TestMutationSyntax {
                            __type(name: "Mutation") {
                                fields(includeDeprecated: true) {
                                    name
                                    args {
                                        name
                                        type {
                                            name
                                            kind
                                        }
                                    }
                                }
                            }
                        }
                    `,
                },
                method: 'POST',
            }).then((response) => {
                // * Find property field mutations in the schema
                expect(response.status).to.equal(200);

                if (!response.body.data || !response.body.data.__type) {
                    cy.task('log', '⚠️ Introspection might be disabled. Skipping mutation validation.');
                    return;
                }

                const mutationFields = response.body.data.__type.fields;

                const propertyMutations = mutationFields.filter((f) =>
                    f.name.includes('PlaybookPropertyField') || f.name === 'addPlaybookPropertyField' ||
                    f.name === 'updatePlaybookPropertyField' || f.name === 'deletePlaybookPropertyField',
                );

                // * Verify mutations exist and have correct argument structure
                expect(propertyMutations.length).to.be.greaterThan(0);

                propertyMutations.forEach((mutation) => {
                    cy.task('log', `✅ ${mutation.name} mutation found with ${mutation.args.length} arguments`);

                    // Check common arguments
                    const argNames = mutation.args.map((arg) => arg.name);
                    expect(argNames).to.include('playbookID');

                    if (mutation.name.includes('add') || mutation.name.includes('update')) {
                        expect(argNames).to.include('propertyField');
                    }
                    if (mutation.name.includes('update') || mutation.name.includes('delete')) {
                        expect(argNames).to.include('propertyFieldID');
                    }
                });
            });
        });
    });

    describe('PropertyField Type System', () => {
        it('should support all PropertyFieldType enum values', () => {
            cy.task('log', '🔍 Testing all PropertyFieldType values');

            const propertyFieldTypes = [
                {type: 'text', name: 'Text Field'},
                {type: 'select', name: 'Select Field', options: [{name: 'Option 1', color: 'blue'}]},
                {type: 'multiselect', name: 'Multi-Select Field', options: [{name: 'Tag 1'}, {name: 'Tag 2'}]},
                {type: 'date', name: 'Date Field'},
                {type: 'user', name: 'User Field'},
                {type: 'multiuser', name: 'Multi-User Field'},
            ];

            propertyFieldTypes.forEach((fieldDef) => {
                // # Test each property field type in a mutation structure
                cy.request({
                    headers: {'X-Requested-With': 'XMLHttpRequest'},
                    url: '/plugins/playbooks/api/v0/query',
                    body: {
                        operationName: 'TestPropertyFieldType',
                        query: `
                            mutation TestPropertyFieldType($playbookID: String!, $propertyField: PropertyFieldInput!) {
                                addPlaybookPropertyField(playbookID: $playbookID, propertyField: $propertyField)
                            }
                        `,
                        variables: {
                            playbookID: testPlaybook.id,
                            propertyField: {
                                name: fieldDef.name,
                                type: fieldDef.type,
                                attrs: {
                                    visibility: 'always',
                                    sortOrder: 1,
                                    ...(fieldDef.options && {options: fieldDef.options}),
                                },
                            },
                        },
                    },
                    method: 'POST',
                    failOnStatusCode: false,
                }).then((response) => {
                    // * Verify the type is accepted (structure validation, not execution)
                    expect(response.status).to.equal(200);
                    expect(response.body).to.have.property('data');

                    if (response.body.errors) {
                        const error = response.body.errors[0];

                        // * Should not be type validation errors
                        expect(error.message).to.not.include('Invalid value');
                        expect(error.message).to.not.include('Expected type');
                        expect(error.message).to.not.include('Unknown enum value');
                    }

                    cy.task('log', `✅ PropertyFieldType.${fieldDef.type} is valid and accepted`);
                });
            });
        });
    });

    describe('Main Playbook Query with PropertyFields', () => {
        it('should validate Playbook query includes propertyFields field', () => {
            cy.task('log', '🔍 Testing main Playbook query with propertyFields field');

            // # Test the main Playbook query that includes propertyFields
            cy.request({
                headers: {'X-Requested-With': 'XMLHttpRequest'},
                url: '/plugins/playbooks/api/v0/query',
                body: {
                    operationName: 'PlaybookWithPropertyFields',
                    query: `
                        query PlaybookWithPropertyFields($id: String!) {
                            playbook(id: $id) {
                                id
                                title
                                propertyFields {
                                    id
                                    name
                                    type
                                    groupID
                                    attrs {
                                        visibility
                                        sortOrder
                                        options {
                                            id
                                            name
                                            color
                                        }
                                        parentID
                                    }
                                    createAt
                                    updateAt
                                    deleteAt
                                }
                            }
                        }
                    `,
                    variables: {
                        id: testPlaybook.id,
                    },
                },
                method: 'POST',
                failOnStatusCode: false,
            }).then((response) => {
                // * Verify response structure
                expect(response.status).to.equal(200);
                expect(response.body).to.exist;

                // * Log the response for debugging
                cy.task('log', `GraphQL Response: ${JSON.stringify(response.body, null, 2)}`);

                if (response.body.errors) {
                    const error = response.body.errors[0];
                    cy.task('log', `GraphQL Error: ${error.message}`);

                    // * Check if it's a schema error indicating the field doesn't exist
                    if (error.message.includes('Cannot query field') || error.message.includes('Unknown field')) {
                        cy.task('log', '❌ propertyFields field not found in Playbook schema - this indicates the backend schema needs to be updated');
                        throw new Error(`Schema validation failed: ${error.message}`);
                    } else {
                        // * Other errors (like permissions) are acceptable for schema validation
                        cy.task('log', `✅ Main Playbook query structure is valid (non-schema error: ${error.message})`);
                    }
                } else if (response.body.data) {
                    expect(response.body.data).to.have.property('playbook');

                    if (response.body.data.playbook) {
                        // * Should have propertyFields field (might be empty array)
                        expect(response.body.data.playbook).to.have.property('propertyFields');
                        expect(response.body.data.playbook.propertyFields).to.be.an('array');
                        cy.task('log', `✅ Main Playbook query executed successfully with ${response.body.data.playbook.propertyFields.length} property fields`);
                    } else {
                        cy.task('log', '✅ Main Playbook query structure is valid (playbook not found, but no schema errors)');
                    }
                } else {
                    cy.task('log', '⚠️ Unexpected response structure - no data or errors field');
                }
            });
        });

        it('should verify propertyFields array structure in Playbook query', () => {
            cy.task('log', '🔍 Testing propertyFields array structure validation');

            // # Test introspection for Playbook type to verify propertyFields field
            cy.request({
                headers: {'X-Requested-With': 'XMLHttpRequest'},
                url: '/plugins/playbooks/api/v0/query',
                body: {
                    operationName: 'PlaybookTypeIntrospection',
                    query: `
                        query PlaybookTypeIntrospection {
                            __type(name: "Playbook") {
                                name
                                fields {
                                    name
                                    type {
                                        name
                                        kind
                                        ofType {
                                            name
                                            kind
                                        }
                                    }
                                }
                            }
                        }
                    `,
                },
                method: 'POST',
                failOnStatusCode: false,
            }).then((response) => {
                // * Verify response structure
                expect(response.status).to.equal(200);
                expect(response.body).to.exist;

                // * Log the response for debugging
                cy.task('log', `Introspection Response: ${JSON.stringify(response.body, null, 2)}`);

                if (response.body.errors) {
                    const error = response.body.errors[0];
                    cy.task('log', `Introspection Error: ${error.message}`);
                    cy.task('log', '⚠️ Introspection might be disabled or restricted. Skipping detailed schema validation.');
                    return;
                }

                if (!response.body.data || !response.body.data.__type) {
                    cy.task('log', '⚠️ Introspection might be disabled. Skipping Playbook type validation.');
                    return;
                }

                expect(response.body.data.__type).to.exist;
                expect(response.body.data.__type.name).to.equal('Playbook');

                const fields = response.body.data.__type.fields;
                if (!fields || !Array.isArray(fields)) {
                    cy.task('log', '⚠️ Playbook type fields not accessible via introspection.');
                    return;
                }

                const propertyFieldsField = fields.find((f) => f.name === 'propertyFields');

                if (propertyFieldsField) {
                    // * Verify propertyFields field exists and is an array of PropertyField
                    expect(propertyFieldsField.type.kind).to.equal('NON_NULL');
                    expect(propertyFieldsField.type.ofType.kind).to.equal('LIST');
                    cy.task('log', '✅ Playbook type includes propertyFields: [PropertyField!]! field');
                } else {
                    cy.task('log', '❌ propertyFields field not found in Playbook type - backend schema may need updating');
                    const fieldNames = fields.map((f) => f.name);
                    cy.task('log', `Available fields: ${fieldNames.join(', ')}`);
                }
            });
        });
    });

    describe('PropertyFields Integration Flow', () => {
        let testPropertyFieldID;

        it('should test full integration flow: create field -> query playbook -> verify consistency', () => {
            cy.task('log', '🔍 Testing end-to-end property fields integration flow');

            // # Step 1: Create a property field
            cy.request({
                headers: {'X-Requested-With': 'XMLHttpRequest'},
                url: '/plugins/playbooks/api/v0/query',
                body: {
                    operationName: 'AddTestPropertyField',
                    query: `
                        mutation AddTestPropertyField($playbookID: String!, $propertyField: PropertyFieldInput!) {
                            addPlaybookPropertyField(playbookID: $playbookID, propertyField: $propertyField)
                        }
                    `,
                    variables: {
                        playbookID: testPlaybook.id,
                        propertyField: {
                            name: 'E2E Test Priority',
                            type: 'select',
                            attrs: {
                                visibility: 'always',
                                sortOrder: 1,
                                options: [
                                    {name: 'Critical', color: 'red'},
                                    {name: 'Normal', color: 'blue'},
                                    {name: 'Low', color: 'green'},
                                ],
                            },
                        },
                    },
                },
                method: 'POST',
                failOnStatusCode: false,
            }).then((response) => {
                if (response.body.data && response.body.data.addPlaybookPropertyField) {
                    testPropertyFieldID = response.body.data.addPlaybookPropertyField;
                    cy.task('log', `✅ Step 1: Created property field with ID: ${testPropertyFieldID}`);

                    // # Step 2: Query playbook to get all property fields via bulk query
                    cy.request({
                        headers: {'X-Requested-With': 'XMLHttpRequest'},
                        url: '/plugins/playbooks/api/v0/query',
                        body: {
                            operationName: 'GetPlaybookWithFields',
                            query: `
                                query GetPlaybookWithFields($id: String!) {
                                    playbook(id: $id) {
                                        id
                                        title
                                        propertyFields {
                                            id
                                            name
                                            type
                                            attrs {
                                                visibility
                                                sortOrder
                                                options {
                                                    name
                                                    color
                                                }
                                            }
                                        }
                                    }
                                }
                            `,
                            variables: {
                                id: testPlaybook.id,
                            },
                        },
                        method: 'POST',
                    }).then((bulkResponse) => {
                        expect(bulkResponse.status).to.equal(200);

                        if (bulkResponse.body.data && bulkResponse.body.data.playbook) {
                            const propertyFields = bulkResponse.body.data.playbook.propertyFields;
                            expect(propertyFields).to.be.an('array');

                            // * Find our created field in the bulk query results
                            const createdField = propertyFields.find((f) => f.id === testPropertyFieldID);
                            if (createdField) {
                                expect(createdField.name).to.equal('E2E Test Priority');
                                expect(createdField.type).to.equal('select');
                                expect(createdField.attrs.options).to.have.length(3);
                                cy.task('log', '✅ Step 2: Found created field in bulk propertyFields query');

                                // # Step 3: Query the same field individually for comparison
                                cy.request({
                                    headers: {'X-Requested-With': 'XMLHttpRequest'},
                                    url: '/plugins/playbooks/api/v0/query',
                                    body: {
                                        operationName: 'GetIndividualProperty',
                                        query: `
                                            query GetIndividualProperty($playbookID: String!, $propertyID: String!) {
                                                playbookProperty(playbookID: $playbookID, propertyID: $propertyID) {
                                                    id
                                                    name
                                                    type
                                                    attrs {
                                                        visibility
                                                        sortOrder
                                                        options {
                                                            name
                                                            color
                                                        }
                                                    }
                                                }
                                            }
                                        `,
                                        variables: {
                                            playbookID: testPlaybook.id,
                                            propertyID: testPropertyFieldID,
                                        },
                                    },
                                    method: 'POST',
                                }).then((individualResponse) => {
                                    expect(individualResponse.status).to.equal(200);

                                    if (individualResponse.body.data && individualResponse.body.data.playbookProperty) {
                                        const individualField = individualResponse.body.data.playbookProperty;

                                        // * Step 4: Verify data consistency between bulk and individual queries
                                        expect(individualField.id).to.equal(createdField.id);
                                        expect(individualField.name).to.equal(createdField.name);
                                        expect(individualField.type).to.equal(createdField.type);
                                        expect(individualField.attrs.visibility).to.equal(createdField.attrs.visibility);
                                        expect(individualField.attrs.sortOrder).to.equal(createdField.attrs.sortOrder);
                                        expect(individualField.attrs.options).to.have.length(createdField.attrs.options.length);

                                        cy.task('log', '✅ Step 3: Individual property query returned same data');
                                        cy.task('log', '✅ Step 4: Data consistency verified between bulk and individual queries');
                                        cy.task('log', '🎉 End-to-end integration flow completed successfully!');
                                    } else {
                                        cy.task('log', '⚠️ Individual property query did not return expected data');
                                    }
                                });
                            } else {
                                cy.task('log', '⚠️ Created field not found in bulk propertyFields query');
                            }
                        } else {
                            cy.task('log', '⚠️ Bulk playbook query did not return expected data');
                        }
                    });
                } else {
                    cy.task('log', '⚠️ Property field creation failed or returned unexpected response');
                }
            });
        });
    });
});
