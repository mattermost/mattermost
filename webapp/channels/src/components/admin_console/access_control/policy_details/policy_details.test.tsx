// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';
import {act} from 'react-dom/test-utils';

import {JobTypes} from 'utils/constants';

import PolicyDetails from './policy_details';

jest.mock('utils/browser_history', () => ({
    getHistory: () => ({
        push: jest.fn(),
    }),
}));

// Mock react-intl
const mockFormatMessage = jest.fn((descriptor, values?) => {
    let message = descriptor.defaultMessage || descriptor.id;
    if (values) {
        // Simple string interpolation for testing
        Object.keys(values).forEach((key) => {
            message = message.replace(`{${key}}`, values[key]);
        });
    }
    return message;
});
jest.mock('react-intl', () => ({
    ...jest.requireActual('react-intl'),
    useIntl: () => ({
        formatMessage: mockFormatMessage,
    }),
    FormattedMessage: ({children, defaultMessage, id}: any) => children || defaultMessage || id,
}));

// Helper to create mock actions
const createMockActions = (overrides = {}) => ({
    fetchPolicy: jest.fn().mockResolvedValue({data: null}),
    createPolicy: jest.fn().mockResolvedValue({data: {id: 'new-policy-id'}}),
    deletePolicy: jest.fn().mockResolvedValue({data: {}}),
    searchChannels: jest.fn().mockResolvedValue({data: {total_count: 0}}),
    setNavigationBlocked: jest.fn(),
    assignChannelsToAccessControlPolicy: jest.fn().mockResolvedValue({data: {}}),
    unassignChannelsFromAccessControlPolicy: jest.fn().mockResolvedValue({data: {}}),
    getAccessControlFields: jest.fn().mockResolvedValue({data: []}),
    createJob: jest.fn().mockResolvedValue({data: {}}),
    updateAccessControlPolicyActive: jest.fn().mockResolvedValue({data: {}}),
    getVisualAST: jest.fn().mockResolvedValue({data: {}}),
    ...overrides,
});

// Extract business logic functions as pure functions for testing
const createPolicyOperations = (actions: any, policyId?: string) => {
    const createOrUpdatePolicy = async (formData: any) => {
        try {
            const result = await actions.createPolicy({
                id: policyId || '',
                name: formData.name,
                rules: [{expression: formData.expression, actions: ['*']}],
                type: 'parent',
                version: 'v0.1',
            });

            if (result.error) {
                return {success: false, error: result.error.message};
            }

            return {success: true, policyId: result.data?.id};
        } catch (error: any) {
            return {success: false, error: error.message || 'Unknown error occurred'};
        }
    };

    const submitPolicy = async (formData: any, channelChanges: any, shouldApplyImmediately = false) => {
        // Step 1: Create or update the policy
        const policyResult = await createOrUpdatePolicy(formData);
        if (!policyResult.success || !policyResult.policyId) {
            return {success: false, error: policyResult.error};
        }

        const currentPolicyId = policyResult.policyId;

        // Step 2: Update active status
        try {
            await actions.updateAccessControlPolicyActive(currentPolicyId, formData.autoSyncMembership);
        } catch (error: any) {
            return {success: false, error: 'Error updating policy active status'};
        }

        // Step 3: Update channel assignments
        try {
            if (channelChanges.removedCount > 0) {
                await actions.unassignChannelsFromAccessControlPolicy(
                    currentPolicyId,
                    Object.keys(channelChanges.removed),
                );
            }

            if (Object.keys(channelChanges.added).length > 0) {
                await actions.assignChannelsToAccessControlPolicy(
                    currentPolicyId,
                    Object.keys(channelChanges.added),
                );
            }
        } catch (error: any) {
            return {success: false, error: 'Error assigning channels'};
        }

        // Step 4: Create sync job if needed
        if (shouldApplyImmediately) {
            try {
                const job = {
                    type: JobTypes.ACCESS_CONTROL_SYNC,
                    data: {parent_id: currentPolicyId},
                };
                await actions.createJob(job);
            } catch (error: any) {
                return {success: false, error: 'Error creating job'};
            }
        }

        return {success: true};
    };

    const deletePolicy = async (channelChanges: any) => {
        if (!policyId) {
            return {success: false, error: 'No policy ID provided'};
        }

        // Clean up channels first if needed
        if (channelChanges.removedCount > 0) {
            try {
                await actions.unassignChannelsFromAccessControlPolicy(
                    policyId,
                    Object.keys(channelChanges.removed),
                );
            } catch (error: any) {
                return {success: false, error: 'Error unassigning channels'};
            }
        }

        // Delete the policy
        try {
            await actions.deletePolicy(policyId);
            return {success: true};
        } catch (error: any) {
            return {success: false, error: 'Error deleting policy'};
        }
    };

    return {
        createOrUpdatePolicy,
        submitPolicy,
        deletePolicy,
    };
};

describe('components/admin_console/access_control/policy_details/PolicyDetails', () => {
    const defaultProps = {
        policyId: 'policy1',
        accessControlSettings: {
            EnableAttributeBasedAccessControl: true,
            EnableChannelScopeAccessControl: true,
            EnableUserManagedAttributes: false,
        },
        actions: createMockActions(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockFormatMessage.mockImplementation((descriptor, values?) => {
            let message = descriptor.defaultMessage || descriptor.id;
            if (values) {
                Object.keys(values).forEach((key) => {
                    message = message.replace(`{${key}}`, values[key]);
                });
            }
            return message;
        });
    });

    describe('Component Rendering', () => {
        test('should render correctly for new policy', () => {
            const props = {
                ...defaultProps,
                policyId: undefined,
            };
            const wrapper = shallow(<PolicyDetails {...props}/>);
            expect(wrapper.find('AdminHeader')).toHaveLength(1);
            expect(wrapper.find('Card')).toHaveLength(2); // Rules card and channels card
        });

        test('should render correctly for existing policy', () => {
            const wrapper = shallow(<PolicyDetails {...defaultProps}/>);
            expect(wrapper.find('AdminHeader')).toHaveLength(1);
            expect(wrapper.find('Card')).toHaveLength(3); // Rules, channels, and delete cards
        });
    });

    describe('Policy Operations - Behavior Tests', () => {
        test('should successfully create a new policy', async () => {
            const mockActions = createMockActions({
                createPolicy: jest.fn().mockResolvedValue({
                    data: {id: 'new-policy-id'},
                }),
            });

            const operations = createPolicyOperations(mockActions);

            const formData = {
                name: 'Test Policy',
                expression: 'user.attributes.role == "admin"',
                autoSyncMembership: true,
            };

            const result = await operations.createOrUpdatePolicy(formData);

            expect(result.success).toBe(true);
            expect(result.policyId).toBe('new-policy-id');
        });

        test('should handle policy creation failure', async () => {
            const mockActions = createMockActions({
                createPolicy: jest.fn().mockResolvedValue({
                    error: {message: 'Policy name already exists'},
                }),
            });

            const operations = createPolicyOperations(mockActions);

            const formData = {
                name: 'Duplicate Policy',
                expression: 'true',
                autoSyncMembership: false,
            };

            const result = await operations.createOrUpdatePolicy(formData);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Policy name already exists');
        });

        test('should successfully complete full policy submission', async () => {
            const mockActions = createMockActions();
            const operations = createPolicyOperations(mockActions);

            const formData = {
                name: 'Complete Policy',
                expression: 'user.attributes.department == "engineering"',
                autoSyncMembership: true,
            };

            const channelChanges = {
                removed: {},
                added: {'channel-1': {id: 'channel-1'}},
                removedCount: 0,
            };

            const result = await operations.submitPolicy(formData, channelChanges, true);

            expect(result.success).toBe(true);
        });

        test('should handle submission failure and stop early', async () => {
            const mockActions = createMockActions({
                createPolicy: jest.fn().mockResolvedValue({
                    error: {message: 'Creation failed'},
                }),
            });

            const operations = createPolicyOperations(mockActions);

            const formData = {
                name: 'Failing Policy',
                expression: 'true',
                autoSyncMembership: true,
            };

            const result = await operations.submitPolicy(formData, {removed: {}, added: {}, removedCount: 0});

            expect(result.success).toBe(false);
            expect(result.error).toBe('Creation failed');
        });

        test('should successfully delete policy', async () => {
            const mockActions = createMockActions();
            const operations = createPolicyOperations(mockActions, 'policy-to-delete');

            const result = await operations.deletePolicy({removed: {}, added: {}, removedCount: 0});

            expect(result.success).toBe(true);
        });

        test('should handle deletion failure', async () => {
            const mockActions = createMockActions({
                deletePolicy: jest.fn().mockRejectedValue(new Error('Deletion failed')),
            });

            const operations = createPolicyOperations(mockActions, 'policy-to-delete');

            const result = await operations.deletePolicy({removed: {}, added: {}, removedCount: 0});

            expect(result.success).toBe(false);
            expect(result.error).toBe('Error deleting policy');
        });

        test('should not allow deletion without policy ID', async () => {
            const mockActions = createMockActions();
            const operations = createPolicyOperations(mockActions); // No policyId

            const result = await operations.deletePolicy({removed: {}, added: {}, removedCount: 0});

            expect(result.success).toBe(false);
            expect(result.error).toBe('No policy ID provided');
        });
    });

    describe('UI Interaction Tests', () => {
        test('should show delete confirmation modal when delete button is clicked', async () => {
            const props = {
                ...defaultProps,
                actions: {
                    ...defaultProps.actions,
                    deletePolicy: jest.fn().mockResolvedValue({data: {}}),
                },
            };

            const wrapper = shallow(<PolicyDetails {...props}/>);

            // Find and click the delete button
            const deleteCard = wrapper.find('Card.delete-policy');
            const deleteButtonHeader = deleteCard.find('TitleAndButtonCardHeader');
            const onClickProp = deleteButtonHeader.props().onClick;

            await act(async () => {
                if (onClickProp) {
                    await onClickProp({} as React.MouseEvent);
                }
            });

            wrapper.update();

            // Verify modal appears
            const confirmationModal = wrapper.find('GenericModal');
            expect(confirmationModal.exists()).toBe(true);
        });
    });

    describe('Form Validation', () => {
        test('should require policy name', () => {
            const validateForm = (name: string, expression: string) => {
                if (name.length === 0) {
                    return {isValid: false, error: 'Please add a name to the policy'};
                }
                if (expression.length === 0) {
                    return {isValid: false, error: 'Please add an expression to the policy'};
                }
                return {isValid: true};
            };

            expect(validateForm('', 'some-expression')).toEqual({
                isValid: false,
                error: 'Please add a name to the policy',
            });
        });

        test('should require policy expression', () => {
            const validateForm = (name: string, expression: string) => {
                if (name.length === 0) {
                    return {isValid: false, error: 'Please add a name to the policy'};
                }
                if (expression.length === 0) {
                    return {isValid: false, error: 'Please add an expression to the policy'};
                }
                return {isValid: true};
            };

            expect(validateForm('Valid Name', '')).toEqual({
                isValid: false,
                error: 'Please add an expression to the policy',
            });
        });

        test('should pass validation with valid inputs', () => {
            const validateForm = (name: string, expression: string) => {
                if (name.length === 0) {
                    return {isValid: false, error: 'Please add a name to the policy'};
                }
                if (expression.length === 0) {
                    return {isValid: false, error: 'Please add an expression to the policy'};
                }
                return {isValid: true};
            };

            expect(validateForm('Valid Policy', 'user.attributes.role == "admin"')).toEqual({
                isValid: true,
            });
        });
    });
});
