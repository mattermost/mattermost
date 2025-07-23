// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import cloneDeep from 'lodash/cloneDeep';
import React, {useState, useEffect, useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import type {AccessControlPolicy, AccessControlPolicyRule} from '@mattermost/types/access_control';
import type {ChannelSearchOpts, ChannelWithTeamData} from '@mattermost/types/channels';
import type {AccessControlSettings} from '@mattermost/types/config';
import type {JobTypeBase} from '@mattermost/types/jobs';
import type {UserPropertyField} from '@mattermost/types/properties';

import type {ActionResult} from 'mattermost-redux/types/actions';

import BlockableLink from 'components/admin_console/blockable_link';
import BooleanSetting from 'components/admin_console/boolean_setting';
import Card from 'components/card/card';
import TitleAndButtonCardHeader from 'components/card/title_and_button_card_header/title_and_button_card_header';
import ChannelSelectorModal from 'components/channel_selector_modal';
import SaveButton from 'components/save_button';
import SectionNotice from 'components/section_notice';
import AdminHeader from 'components/widgets/admin_console/admin_header';
import TextSetting from 'components/widgets/settings/text_setting';

import {getHistory} from 'utils/browser_history';
import {JobTypes} from 'utils/constants';

import ChannelList from './channel_list';

import CELEditor from '../editors/cel_editor/editor';
import TableEditor from '../editors/table_editor/table_editor';
import PolicyConfirmationModal from '../modals/confirmation/confirmation_modal';

import './policy_details.scss';

const DEFAULT_PAGE_SIZE = 10;

interface PolicyActions {
    fetchPolicy: (id: string) => Promise<ActionResult>;
    createPolicy: (policy: AccessControlPolicy) => Promise<ActionResult>;
    deletePolicy: (id: string) => Promise<ActionResult>;
    searchChannels: (id: string, term: string, opts: ChannelSearchOpts) => Promise<ActionResult>;
    setNavigationBlocked: (blocked: boolean) => void;
    assignChannelsToAccessControlPolicy: (policyId: string, channelIds: string[]) => Promise<ActionResult>;
    unassignChannelsFromAccessControlPolicy: (policyId: string, channelIds: string[]) => Promise<ActionResult>;
    getAccessControlFields: (after: string, limit: number) => Promise<ActionResult>;
    createJob: (job: JobTypeBase & { data: any }) => Promise<ActionResult>;
    updateAccessControlPolicyActive: (policyId: string, active: boolean) => Promise<ActionResult>;
    getVisualAST: (expression: string) => Promise<ActionResult>;
}

export interface PolicyDetailsProps {
    policy?: AccessControlPolicy;
    policyId?: string;
    accessControlSettings: AccessControlSettings;
    actions: PolicyActions;
}

interface ChannelChanges {
    removed: Record<string, ChannelWithTeamData>;
    added: Record<string, ChannelWithTeamData>;
    removedCount: number;
}

interface PolicyFormData {
    name: string;
    expression: string;
    autoSyncMembership: boolean;
}

// Custom hook to handle policy business logic
function usePolicySubmission(
    actions: PolicyActions,
    policyId?: string,
) {
    const {formatMessage} = useIntl();

    const createOrUpdatePolicy = async (formData: PolicyFormData): Promise<{success: boolean; policyId?: string; error?: string}> => {
        try {
            const result = await actions.createPolicy({
                id: policyId || '',
                name: formData.name,
                rules: [{expression: formData.expression, actions: ['*']}] as AccessControlPolicyRule[],
                type: 'parent',
                version: 'v0.1',
            });

            if (result.error) {
                return {success: false, error: result.error.message};
            }

            return {success: true, policyId: result.data?.id};
        } catch (error) {
            return {success: false, error: error.message || 'Unknown error occurred'};
        }
    };

    const updatePolicyActiveStatus = async (policyId: string, active: boolean): Promise<{success: boolean; error?: string}> => {
        try {
            await actions.updateAccessControlPolicyActive(policyId, active);
            return {success: true};
        } catch (error) {
            return {
                success: false,
                error: formatMessage({
                    id: 'admin.access_control.policy.edit_policy.error.update_active_status',
                    defaultMessage: 'Error updating policy active status: {error}',
                }, {error: error.message}),
            };
        }
    };

    const updateChannelAssignments = async (
        policyId: string,
        channelChanges: ChannelChanges,
    ): Promise<{success: boolean; error?: string}> => {
        try {
            // Remove channels first
            if (channelChanges.removedCount > 0) {
                await actions.unassignChannelsFromAccessControlPolicy(
                    policyId,
                    Object.keys(channelChanges.removed),
                );
            }

            // Then add new channels
            if (Object.keys(channelChanges.added).length > 0) {
                await actions.assignChannelsToAccessControlPolicy(
                    policyId,
                    Object.keys(channelChanges.added),
                );
            }

            return {success: true};
        } catch (error) {
            return {
                success: false,
                error: formatMessage({
                    id: 'admin.access_control.policy.edit_policy.error.assign_channels',
                    defaultMessage: 'Error assigning channels: {error}',
                }, {error: error.message}),
            };
        }
    };

    const createSyncJob = async (policyId: string): Promise<{success: boolean; error?: string}> => {
        try {
            const job: JobTypeBase & { data: any } = {
                type: JobTypes.ACCESS_CONTROL_SYNC,
                data: {parent_id: policyId},
            };
            await actions.createJob(job);
            return {success: true};
        } catch (error) {
            return {
                success: false,
                error: formatMessage({
                    id: 'admin.access_control.policy.edit_policy.error.create_job',
                    defaultMessage: 'Error creating job: {error}',
                }, {error: error.message}),
            };
        }
    };

    const submitPolicy = async (
        formData: PolicyFormData,
        channelChanges: ChannelChanges,
        shouldApplyImmediately = false,
    ): Promise<{success: boolean; error?: string}> => {
        // Step 1: Create or update the policy
        const policyResult = await createOrUpdatePolicy(formData);
        if (!policyResult.success || !policyResult.policyId) {
            return {success: false, error: policyResult.error};
        }

        const currentPolicyId = policyResult.policyId;

        // Step 2: Update active status
        const activeResult = await updatePolicyActiveStatus(currentPolicyId, formData.autoSyncMembership);
        if (!activeResult.success) {
            return {success: false, error: activeResult.error};
        }

        // Step 3: Update channel assignments
        const channelResult = await updateChannelAssignments(currentPolicyId, channelChanges);
        if (!channelResult.success) {
            return {success: false, error: channelResult.error};
        }

        // Step 4: Create sync job if needed
        if (shouldApplyImmediately) {
            const jobResult = await createSyncJob(currentPolicyId);
            if (!jobResult.success) {
                return {success: false, error: jobResult.error};
            }
        }

        return {success: true};
    };

    const deletePolicy = async (channelChanges: ChannelChanges): Promise<{success: boolean; error?: string}> => {
        if (!policyId) {
            return {success: false, error: 'No policy ID provided'};
        }

        // Step 1: Unassign channels if necessary
        if (channelChanges.removedCount > 0) {
            const unassignResult = await updateChannelAssignments(policyId, {
                removed: channelChanges.removed,
                added: {},
                removedCount: channelChanges.removedCount,
            });
            if (!unassignResult.success) {
                return {success: false, error: unassignResult.error};
            }
        }

        // Step 2: Delete the policy
        try {
            await actions.deletePolicy(policyId);
            return {success: true};
        } catch (error) {
            return {
                success: false,
                error: formatMessage({
                    id: 'admin.access_control.policy.edit_policy.error.delete_policy',
                    defaultMessage: 'Error deleting policy: {error}',
                }, {error: error.message}),
            };
        }
    };

    return {
        submitPolicy,
        deletePolicy,
    };
}

function PolicyDetails({
    policy,
    policyId,
    actions,
    accessControlSettings,
}: PolicyDetailsProps): JSX.Element {
    const [policyName, setPolicyName] = useState(policy?.name || '');
    const [expression, setExpression] = useState(policy?.rules?.[0]?.expression || '');
    const [autoSyncMembership, setAutoSyncMembership] = useState(policy?.active || false);
    const [serverError, setServerError] = useState<string | undefined>(undefined);
    const [addChannelOpen, setAddChannelOpen] = useState(false);
    const [editorMode, setEditorMode] = useState<'cel' | 'table'>('table');
    const [channelChanges, setChannelChanges] = useState<ChannelChanges>({
        removed: {},
        added: {},
        removedCount: 0,
    });
    const [saveNeeded, setSaveNeeded] = useState(false);
    const [channelsCount, setChannelsCount] = useState(0);
    const [autocompleteResult, setAutocompleteResult] = useState<UserPropertyField[]>([]);
    const [attributesLoaded, setAttributesLoaded] = useState(false);
    const [showConfirmationModal, setShowConfirmationModal] = useState(false);
    const [showDeleteConfirmationModal, setShowDeleteConfirmationModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const {formatMessage} = useIntl();

    const {submitPolicy, deletePolicy} = usePolicySubmission(actions, policyId);

    useEffect(() => {
        loadPage();
    }, [policyId]);

    // Check if expression is simple enough for table mode
    const isSimpleExpression = (expr: string): boolean => {
        if (!expr) {
            return true;
        }

        // Expression is simple if it only contains user.attributes.X == "Y" or user.attributes.X in ["Y", "Z"]
        // or user.attributes.X.startsWith/endsWith/contains("Y")
        return expr.split('&&').every((condition) => {
            const trimmed = condition.trim();
            return trimmed.match(/^user\.attributes\.\w+\s*(==|!=)\s*['"][^'"]*['"]$/) ||
                   trimmed.match(/^user\.attributes\.\w+\s+in\s+\[.*?\]$/) ||
                   trimmed.match(/^user\.attributes\.\w+\.startsWith\(['"][^'"]*['"].*?\)$/) ||
                   trimmed.match(/^user\.attributes\.\w+\.endsWith\(['"][^'"]*['"].*?\)$/) ||
                   trimmed.match(/^user\.attributes\.\w+\.contains\(['"][^'"]*['"].*?\)$/);
        });
    };

    const loadPage = async (): Promise<void> => {
        // Fetch autocomplete fields first, as they are general and needed for both new and existing policies.
        const fieldsPromise = actions.getAccessControlFields('', 100).then((result) => {
            if (result.data) {
                setAutocompleteResult(result.data);
            }
            setAttributesLoaded(true);
        });

        if (policyId) {
            // For existing policies, fetch policy details and channels
            const policyPromise = actions.fetchPolicy(policyId).then((result) => {
                setPolicyName(result.data?.name || '');
                setExpression(result.data?.rules?.[0]?.expression || '');
                setAutoSyncMembership(result.data?.active || false);
            });

            const channelsPromise = actions.searchChannels(policyId, '', {per_page: DEFAULT_PAGE_SIZE}).then((result) => {
                setChannelsCount(result.data?.total_count || 0);
            });

            // Wait for all fetches for an existing policy
            await Promise.all([fieldsPromise, policyPromise, channelsPromise]);
        } else {
            // For new policies, just ensure general fields are fetched.
            // Policy name, expression, etc., are already initialized from props or defaults by useState.
            await fieldsPromise;
        }
    };

    const validateForm = (): boolean => {
        if (policyName.length === 0) {
            setServerError(formatMessage({
                id: 'admin.access_control.policy.edit_policy.error.name_required',
                defaultMessage: 'Please add a name to the policy',
            }));
            return false;
        }
        if (expression.length === 0) {
            setServerError(formatMessage({
                id: 'admin.access_control.policy.edit_policy.error.expression_required',
                defaultMessage: 'Please add an expression to the policy',
            }));
            return false;
        }

        return true;
    };

    const handleFormChange = useCallback(() => {
        setServerError(undefined);
        setSaveNeeded(true);
        actions.setNavigationBlocked(true);
    }, [actions]);

    const navigateToAccessControlList = useCallback(() => {
        getHistory().push('/admin_console/system_attributes/attribute_based_access_control');
    }, []);

    const resetFormState = useCallback(() => {
        setSaveNeeded(false);
        setShowConfirmationModal(false);
        setChannelChanges({removed: {}, added: {}, removedCount: 0});
        actions.setNavigationBlocked(false);
    }, [actions]);

    const handleSubmit = async (shouldApplyImmediately = false) => {
        if (!validateForm() || isSubmitting) {
            return;
        }

        setIsSubmitting(true);
        setServerError(undefined);

        const formData: PolicyFormData = {
            name: policyName,
            expression,
            autoSyncMembership,
        };

        const result = await submitPolicy(formData, channelChanges, shouldApplyImmediately);

        setIsSubmitting(false);

        // Always close the confirmation modal after submission attempt
        setShowConfirmationModal(false);

        if (result.success) {
            resetFormState();
            navigateToAccessControlList();
        } else {
            setServerError(result.error);
        }
    };

    const handleDelete = async () => {
        if (!policyId || isSubmitting) {
            return;
        }

        setIsSubmitting(true);
        setServerError(undefined);

        const result = await deletePolicy(channelChanges);

        setIsSubmitting(false);

        // Always close the delete confirmation modal after deletion attempt
        setShowDeleteConfirmationModal(false);

        if (result.success) {
            navigateToAccessControlList();
        } else {
            setServerError(result.error);
        }
    };

    const addToNewChannels = (channels: ChannelWithTeamData[]) => {
        setChannelChanges((prev) => {
            const newChanges = cloneDeep(prev);
            channels.forEach((channel: ChannelWithTeamData) => {
                if (newChanges.removed[channel.id]?.id === channel.id) {
                    delete newChanges.removed[channel.id];
                    newChanges.removedCount--;
                } else {
                    newChanges.added[channel.id] = channel;
                }
            });
            return newChanges;
        });
        handleFormChange();
    };

    const addToRemovedChannels = (channel: ChannelWithTeamData) => {
        setChannelChanges((prev) => {
            const newChanges = cloneDeep(prev);
            if (newChanges.added[channel.id]?.id === channel.id) {
                delete newChanges.added[channel.id];
            } else if (newChanges.removed[channel.id]?.id !== channel.id) {
                newChanges.removedCount++;
                newChanges.removed[channel.id] = channel;
            }
            return newChanges;
        });
        handleFormChange();
    };

    const hasChannels = () => {
        // If there are channels on the server (minus any pending removals) or newly added channels
        return (
            (channelsCount > channelChanges.removedCount) ||
            (Object.keys(channelChanges.added).length > 0)
        );
    };

    return (
        <div className='wrapper--fixed AccessControlPolicySettings'>
            <AdminHeader withBackButton={true}>
                <div>
                    <BlockableLink
                        to='/admin_console/system_attributes/attribute_based_access_control'
                        className='fa fa-angle-left back'
                    />
                    <FormattedMessage
                        id='admin.access_control.policy.edit_policy.title'
                        defaultMessage='Edit Access Control Policy'
                    />
                </div>
            </AdminHeader>
            <div className='admin-console__wrapper'>
                <div className='admin-console__content'>
                    <div className='admin-console__setting-group'>
                        <TextSetting
                            id='admin.access_control.policy.edit_policy.policyName'
                            label={
                                <FormattedMessage
                                    id='admin.access_control.policy.edit_policy.policyName'
                                    defaultMessage='Access control policy name:'
                                />
                            }
                            value={policyName}
                            placeholder={formatMessage({
                                id: 'admin.access_control.policy.edit_policy.policyName.placeholder',
                                defaultMessage: 'Add a unique policy name',
                            })}
                            onChange={(_, value) => {
                                setPolicyName(value);
                                handleFormChange();
                            }}
                            labelClassName='col-sm-4 vertically-centered-label'
                            inputClassName='col-sm-8'
                            autoFocus={policyId === undefined}
                        />
                        <BooleanSetting
                            id='admin.access_control.policy.edit_policy.autoSyncMembership'
                            label={
                                <div className='vertically-centered-label'>
                                    <FormattedMessage
                                        id='admin.access_control.policy.edit_policy.autoSyncMembership'
                                        defaultMessage='Auto-add members based on access rules:'
                                    />
                                </div>
                            }
                            value={autoSyncMembership}
                            onChange={(_, value) => {
                                setAutoSyncMembership(value);
                                handleFormChange();
                            }}
                            setByEnv={false}
                            helpText={
                                <FormattedMessage
                                    id='admin.access_control.policy.edit_policy.autoSyncMembership.description'
                                    defaultMessage='Users who match the attribute values configured below will be automatically added as new members. Regardless of this setting, users who later no longer match the configured attribute values will be removed from the channel after the next sync.'
                                />
                            }
                        />
                    </div>
                    {attributesLoaded && autocompleteResult.length === 0 && (<div className='admin-console__warning-notice'>
                        <SectionNotice
                            type='warning'
                            title={
                                <FormattedMessage
                                    id='admin.access_control.policy.edit_policy.notice.title'
                                    defaultMessage='Please add user attributes and values to use Attribute-Based Access Control'
                                />
                            }
                            text={formatMessage({
                                id: 'admin.access_control.policy.edit_policy.notice.text',
                                defaultMessage: 'You havent configured any user attributes yet. Attribute-Based Access Control requires user attributes that are either synced from an external system (like LDAP or SAML) or manually configured and enabled on this server. To start using attribute based access, please configure user attributes in System Attributes.',
                            })}
                            primaryButton={{
                                text: formatMessage({
                                    id: 'admin.access_control.policy.edit_policy.notice.button',
                                    defaultMessage: 'Configure user attributes',
                                }),
                                onClick: () => {
                                    getHistory().push('/admin_console/system_attributes/user_attributes');
                                },
                            }}
                        />
                    </div>)}
                    <Card
                        expanded={true}
                        className={'console'}
                    >
                        <Card.Header>
                            <TitleAndButtonCardHeader
                                title={
                                    <FormattedMessage
                                        id='admin.access_control.policy.edit_policy.access_rules.title'
                                        defaultMessage='Attribute-based access rules'
                                    />
                                }
                                subtitle={
                                    <FormattedMessage
                                        id='admin.access_control.policy.edit_policy.access_rules.subtitle'
                                        defaultMessage='Select user attributes and values as rules to restrict channel membership.'
                                    />
                                }
                                buttonText={
                                    editorMode === 'table' ? (
                                        <FormattedMessage
                                            id='admin.access_control.policy.edit_policy.switch_to_advanced'
                                            defaultMessage='Switch to Advanced Mode'
                                        />
                                    ) : (
                                        <FormattedMessage
                                            id='admin.access_control.policy.edit_policy.switch_to_simple'
                                            defaultMessage='Switch to Simple Mode'
                                        />
                                    )
                                }
                                onClick={() => setEditorMode(editorMode === 'table' ? 'cel' : 'table')}
                                isDisabled={editorMode === 'cel' && !isSimpleExpression(expression)}
                                tooltipText={
                                    editorMode === 'cel' && !isSimpleExpression(expression) ?
                                        formatMessage({
                                            id: 'admin.access_control.policy.edit_policy.complex_expression_tooltip',
                                            defaultMessage: 'Complex expression detected. Simple expressions editor is not available at the moment.',
                                        }) :
                                        undefined
                                }
                            />
                        </Card.Header>
                        <Card.Body>
                            {editorMode === 'cel' ? (
                                <CELEditor
                                    value={expression}
                                    onChange={(value) => {
                                        setExpression(value);
                                        handleFormChange();
                                    }}
                                    onValidate={() => {}}
                                    userAttributes={autocompleteResult.
                                        filter((attr) => {
                                            if (accessControlSettings.EnableUserManagedAttributes) {
                                                return true;
                                            }
                                            return attr.attrs?.ldap || attr.attrs?.saml;
                                        }).
                                        map((attr) => ({
                                            attribute: attr.name,
                                            values: [],
                                        }))}
                                />
                            ) : (
                                <TableEditor
                                    value={expression}
                                    onChange={(value) => {
                                        setExpression(value);
                                        handleFormChange();
                                    }}
                                    onValidate={() => {}}
                                    userAttributes={autocompleteResult}
                                    onParseError={() => {
                                        setEditorMode('cel');
                                    }}
                                    enableUserManagedAttributes={accessControlSettings.EnableUserManagedAttributes}
                                    actions={{
                                        getVisualAST: actions.getVisualAST,
                                    }}
                                />
                            )}
                        </Card.Body>
                    </Card>

                    <Card
                        expanded={true}
                        className={'console add-channels'}
                    >
                        <Card.Header>
                            <TitleAndButtonCardHeader
                                title={
                                    <FormattedMessage
                                        id='admin.access_control.policy.edit_policy.channel_selector.title'
                                        defaultMessage='Assigned channels'
                                    />
                                }
                                subtitle={
                                    <FormattedMessage
                                        id='admin.access_control.policy.edit_policy.channel_selector.subtitle'
                                        defaultMessage='Add channels that this attribute-based access policy will apply to.'
                                    />
                                }
                                buttonText={
                                    <FormattedMessage
                                        id='admin.access_control.policy.edit_policy.channel_selector.addChannels'
                                        defaultMessage='Add channels'
                                    />
                                }
                                onClick={() => setAddChannelOpen(true)}
                            />
                        </Card.Header>
                        <Card.Body expanded={true}>
                            <ChannelList
                                onRemoveCallback={(channel) => addToRemovedChannels(channel)}
                                channelsToRemove={channelChanges.removed}
                                channelsToAdd={channelChanges.added}
                                policyId={policyId}
                            />
                        </Card.Body>
                    </Card>
                    {policyId && (
                        <Card
                            expanded={true}
                            className={'console delete-policy'}
                        >
                            <Card.Header>
                                <TitleAndButtonCardHeader
                                    title={
                                        <FormattedMessage
                                            id='admin.access_control.policy.edit_policy.delete_policy.title'
                                            defaultMessage='Delete policy'
                                        />
                                    }
                                    subtitle={
                                        hasChannels() ? (
                                            <FormattedMessage
                                                id='admin.access_control.policy.edit_policy.delete_policy.subtitle.has_resources'
                                                defaultMessage='Remove all assigned resources (eg. Channels) to be able to delete this policy'
                                            />
                                        ) : (
                                            <FormattedMessage
                                                id='admin.access_control.policy.edit_policy.delete_policy.subtitle'
                                                defaultMessage='This policy will be deleted and cannot be recovered.'
                                            />
                                        )
                                    }
                                    buttonText={
                                        <FormattedMessage
                                            id='admin.access_control.policy.edit_policy.delete_policy.delete'
                                            defaultMessage='Delete'
                                        />
                                    }
                                    onClick={() => {
                                        if (hasChannels()) {
                                            return;
                                        }
                                        setShowDeleteConfirmationModal(true);
                                    }}
                                    isDisabled={hasChannels()}
                                />
                            </Card.Header>
                        </Card>
                    )}
                </div>
            </div>

            {addChannelOpen && (
                <ChannelSelectorModal
                    onModalDismissed={() => setAddChannelOpen(false)}
                    onChannelsSelected={(channels) => addToNewChannels(channels)}
                    groupID={''}
                    alreadySelected={Object.values(channelChanges.added).map((channel) => channel.id)}
                    excludeAccessControlPolicyEnforced={true}
                    excludeTypes={['O', 'D', 'G']}
                />
            )}

            {showConfirmationModal && (
                <PolicyConfirmationModal
                    active={autoSyncMembership}
                    onExited={() => setShowConfirmationModal(false)}
                    onConfirm={handleSubmit}
                    channelsAffected={(channelsCount - channelChanges.removedCount) + Object.keys(channelChanges.added).length}
                />
            )}

            {showDeleteConfirmationModal && (
                <GenericModal
                    onExited={() => setShowDeleteConfirmationModal(false)}
                    handleConfirm={handleDelete}
                    handleCancel={() => setShowDeleteConfirmationModal(false)}
                    modalHeaderText={
                        <FormattedMessage
                            id='admin.access_control.policy.edit_policy.delete_confirmation.title'
                            defaultMessage='Confirm Policy Deletion'
                        />
                    }
                    confirmButtonText={
                        <FormattedMessage
                            id='admin.access_control.policy.edit_policy.delete_confirmation.confirm_button'
                            defaultMessage='Delete Policy'
                        />
                    }
                    confirmButtonClassName='btn btn-danger'
                    isDeleteModal={true}
                    compassDesign={true}
                >
                    <FormattedMessage
                        id='admin.access_control.policy.edit_policy.delete_confirmation.message'
                        defaultMessage='Are you sure you want to delete this policy? This action cannot be undone.'
                    />
                </GenericModal>
            )}

            <div className='admin-console-save'>
                <SaveButton
                    disabled={!saveNeeded || isSubmitting}
                    onClick={() => {
                        if (!validateForm()) {
                            return;
                        }
                        if (hasChannels()) {
                            setShowConfirmationModal(true);
                        } else {
                            handleSubmit();
                        }
                    }}
                    defaultMessage={
                        <FormattedMessage
                            id='admin.access_control.edit_policy.save'
                            defaultMessage='Save'
                        />
                    }
                />
                <BlockableLink
                    className='btn btn-quaternary'
                    to='/admin_console/system_attributes/attribute_based_access_control'
                >
                    <FormattedMessage
                        id='admin.access_control.edit_policy.cancel'
                        defaultMessage='Cancel'
                    />
                </BlockableLink>
                {serverError && (
                    <span className='EditPolicy__error'>
                        <i className='icon icon-alert-outline'/>
                        <FormattedMessage
                            id='admin.access_control.edit_policy.serverError'
                            defaultMessage='There are errors in the form above: {serverError}'
                            values={{serverError}}
                        />
                    </span>
                )}
            </div>
        </div>
    );
}

export default PolicyDetails;
