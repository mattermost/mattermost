// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import cloneDeep from 'lodash/cloneDeep';
import React, {useState, useEffect, useMemo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import {buttonClassNames} from '@mattermost/shared/components/button';
import type {AccessControlPolicy, AccessControlPolicyActiveUpdate, AccessControlPolicyRule} from '@mattermost/types/access_control';
import {getMembershipRule, buildRulesWithMembership} from '@mattermost/types/access_control';
import type {ChannelSearchOpts, ChannelWithTeamData} from '@mattermost/types/channels';
import type {AccessControlSettings} from '@mattermost/types/config';
import type {JobTypeBase} from '@mattermost/types/jobs';
import type {UserPropertyField} from '@mattermost/types/properties';

import type {ActionResult} from 'mattermost-redux/types/actions';

import BlockableLink from 'components/admin_console/blockable_link';
import Card from 'components/card/card';
import TitleAndButtonCardHeader from 'components/card/title_and_button_card_header/title_and_button_card_header';
import ChannelSelectorModal from 'components/channel_selector_modal';
import SaveButton from 'components/save_button';
import SectionNotice from 'components/section_notice';
import AdminHeader from 'components/widgets/admin_console/admin_header';
import TextSetting from 'components/widgets/settings/text_setting';

import {useChannelAccessControlActions} from 'hooks/useChannelAccessControlActions';
import {getHistory} from 'utils/browser_history';
import Constants from 'utils/constants';

import ChannelList from './channel_list';

import CELEditor from '../editors/cel_editor/editor';
import {hasUsableAttributes, isSimpleExpression} from '../editors/shared';
import TableEditor from '../editors/table_editor/table_editor';
import PolicyConfirmationModal from '../modals/confirmation/confirmation_modal';

import './policy_details.scss';

interface PolicyActions {
    fetchPolicy: (id: string) => Promise<ActionResult>;
    createPolicy: (policy: AccessControlPolicy) => Promise<ActionResult>;
    deletePolicy: (id: string) => Promise<ActionResult>;
    searchChannels: (id: string, term: string, opts: ChannelSearchOpts) => Promise<ActionResult>;
    setNavigationBlocked: (blocked: boolean) => void;
    assignChannelsToAccessControlPolicy: (policyId: string, channelIds: string[]) => Promise<ActionResult>;
    unassignChannelsFromAccessControlPolicy: (policyId: string, channelIds: string[]) => Promise<ActionResult>;
    createJob: (job: JobTypeBase & { data: any }) => Promise<ActionResult>;
    updateAccessControlPoliciesActive: (states: AccessControlPolicyActiveUpdate[]) => Promise<ActionResult>;
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

interface PolicyActiveStatus {
    id: string;
    active: boolean;
}

function PolicyDetails({
    policy,
    policyId,
    actions,
    accessControlSettings,
}: PolicyDetailsProps): JSX.Element {
    const [policyName, setPolicyName] = useState(policy?.name || '');
    const [expression, setExpression] = useState(getMembershipRule(policy?.rules)?.expression || '');
    const [existingRules, setExistingRules] = useState<AccessControlPolicyRule[]>(policy?.rules || []);
    const [autoSyncMembership, setAutoSyncMembership] = useState(policy?.active || false);
    const [serverError, setServerError] = useState<string | undefined>(undefined);
    const [addChannelOpen, setAddChannelOpen] = useState(false);
    const [editorMode, setEditorMode] = useState<'cel' | 'table'>('table');
    const [channelChanges, setChannelChanges] = useState<ChannelChanges>({
        removed: {},
        added: {},
        removedCount: 0,
    });
    const [policyActiveStatusChanges, setPolicyActiveStatusChanges] = useState<PolicyActiveStatus[]>([]);
    const [saveNeeded, setSaveNeeded] = useState(false);
    const [saving, setSaving] = useState(false);
    const [channelsCount, setChannelsCount] = useState(0);

    // Map of saved channelId → channel type. Lets the confirmation modal show
    // the right messaging for mixed / public-only / private-only policies.
    const [savedChannelTypes, setSavedChannelTypes] = useState<Record<string, string>>({});
    const [autocompleteResult, setAutocompleteResult] = useState<UserPropertyField[]>([]);
    const [attributesLoaded, setAttributesLoaded] = useState(false);
    const [showConfirmationModal, setShowConfirmationModal] = useState(false);
    const [showDeleteConfirmationModal, setShowDeleteConfirmationModal] = useState(false);
    const {formatMessage} = useIntl();

    const abacActions = useChannelAccessControlActions();

    // Memoize the custom no options message to avoid recreating it on every render
    const customNoChannelsMessage = useMemo(() => (
        <div
            key='no-channels-available'
            className='no-channel-message'
        >
            <p className='primary-message'>
                <FormattedMessage
                    id='admin.access_control.policy.edit_policy.no_channels_available'
                    defaultMessage='There are no channels available to add to this policy.'
                />
            </p>
        </div>
    ), []);

    // Check if there are any usable attributes for ABAC
    const noUsableAttributes = attributesLoaded && !hasUsableAttributes(autocompleteResult, accessControlSettings.EnableUserManagedAttributes);

    useEffect(() => {
        loadPage();
    }, [policyId]);

    // isSimpleExpression imported from ../editors/shared

    const loadPage = async (): Promise<void> => {
        // Fetch autocomplete fields first, as they are general and needed for both new and existing policies.
        const fieldsPromise = abacActions.getAccessControlFields('', 100).then((result) => {
            if (result.data) {
                setAutocompleteResult(result.data);
            }
            setAttributesLoaded(true);
        });

        if (policyId) {
            // For existing policies, fetch policy details and channels
            const policyPromise = actions.fetchPolicy(policyId).then((result) => {
                setPolicyName(result.data?.name || '');
                setExpression(getMembershipRule(result.data?.rules)?.expression || '');
                setExistingRules(result.data?.rules || []);
                setAutoSyncMembership(result.data?.active || false);
            });

            // Fetch the full assigned-channel list (not just a page) to know
            // the public/private split for the confirmation modal. The policy
            // assignment permission limits this to 1000; match that ceiling.
            const channelsPromise = actions.searchChannels(policyId, '', {per_page: 1000}).then((result) => {
                const channels: ChannelWithTeamData[] = result.data?.channels || [];
                setChannelsCount(result.data?.total_count || 0);
                setSavedChannelTypes(Object.fromEntries(channels.map((ch) => [ch.id, ch.type])));
            });

            // Wait for all fetches for an existing policy
            await Promise.all([fieldsPromise, policyPromise, channelsPromise]);
        } else {
            // For new policies, just ensure general fields are fetched.
            // Policy name, expression, etc., are already initialized from props or defaults by useState.
            await fieldsPromise;
        }
    };

    const preSaveCheck = () => {
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

    const handleSubmit = async (apply = false) => {
        setSaving(true);
        try {
            let success = true;
            let currentPolicyId = policyId;

            // --- Step 1: Create/Update Policy ---
            await actions.createPolicy({
                id: currentPolicyId || '',
                name: policyName,
                rules: buildRulesWithMembership(existingRules, expression),
                type: 'parent',
            }).then((result) => {
                if (result.error) {
                    if (result.error.server_error_id === 'app.pap.save_policy.name_exists.app_error') {
                        setServerError(formatMessage({id: 'admin.access_control.edit_policy.name_exists', defaultMessage: 'A policy with this name already exists. Please choose a different name.'}));
                    } else {
                        setServerError(result.error.message);
                    }
                    setShowConfirmationModal(false);
                    success = false;
                    return;
                }
                currentPolicyId = result.data?.id;
                setPolicyName(result.data?.name || '');
                setExpression(getMembershipRule(result.data?.rules)?.expression || '');
                setExistingRules(result.data?.rules || []);
                setAutoSyncMembership(result.data?.active || false);
            });

            if (!currentPolicyId || !success) {
                setShowConfirmationModal(false);
                return;
            }

            // --- Step 2: Assign Channels ---
            if (success) {
                try {
                    if (channelChanges.removedCount > 0) {
                        await actions.unassignChannelsFromAccessControlPolicy(currentPolicyId, Object.keys(channelChanges.removed));
                    }
                    if (Object.keys(channelChanges.added).length > 0) {
                        await actions.assignChannelsToAccessControlPolicy(currentPolicyId, Object.keys(channelChanges.added));
                    }

                    setChannelChanges({removed: {}, added: {}, removedCount: 0});
                } catch (error) {
                    setServerError(formatMessage({
                        id: 'admin.access_control.policy.edit_policy.error.assign_channels',
                        defaultMessage: 'Error assigning channels: {error}',
                    }, {error: error.message}));
                    setShowConfirmationModal(false);
                    success = false;
                    return;
                }
            }

            // --- Step 3: Handle Policy Active Status Changes ---
            if (success && policyActiveStatusChanges.length > 0) {
                try {
                    await actions.updateAccessControlPoliciesActive(policyActiveStatusChanges);
                } catch (error) {
                    setServerError(formatMessage({
                        id: 'admin.access_control.policy.edit_policy.error.update_active_status',
                        defaultMessage: 'Error updating policy active status: {error}',
                    }, {error: error.message}));
                    success = false;
                    return;
                }
                setPolicyActiveStatusChanges([]);
            }

            // --- Step 4: Create Job if necessary ---
            if (apply) {
                try {
                    await abacActions.createAccessControlSyncJob({
                        policy_id: currentPolicyId,
                    });
                } catch (error) {
                    setServerError(formatMessage({
                        id: 'admin.access_control.policy.edit_policy.error.create_job',
                        defaultMessage: 'Error creating job: {error}',
                    }, {error: error.message}));
                    setShowConfirmationModal(false);
                    success = false;
                    return;
                }
            }

            // --- Step 5: Navigate lastly ---
            setSaveNeeded(false);
            setShowConfirmationModal(false);
            actions.setNavigationBlocked(false);
            getHistory().push('/admin_console/system_attributes/membership_policies');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!policyId) {
            return; // Should not happen if delete button is enabled correctly
        }

        let success = true;

        // --- Step 1: Unassign Channels (if necessary) ---
        if (channelChanges.removedCount > 0) {
            try {
                await actions.unassignChannelsFromAccessControlPolicy(policyId, Object.keys(channelChanges.removed));
            } catch (error) {
                setServerError(formatMessage({
                    id: 'admin.access_control.policy.edit_policy.error.unassign_channels',
                    defaultMessage: 'Error unassigning channels: {error}',
                }, {error: error.message}));
                success = false;
            }
        }

        // --- Step 2: Delete Policy and Navigate ---
        if (success) {
            try {
                await actions.deletePolicy(policyId);
            } catch (error) {
                setServerError(formatMessage({
                    id: 'admin.access_control.policy.edit_policy.error.delete_policy',
                    defaultMessage: 'Error deleting policy: {error}',
                }, {error: error.message}));
            }
        }

        if (success) {
            getHistory().push('/admin_console/system_attributes/membership_policies');
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
        setSaveNeeded(true);
        actions.setNavigationBlocked(true);
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
        setSaveNeeded(true);
        actions.setNavigationBlocked(true);
    };

    const handlePolicyActiveStatusChange = (changes: PolicyActiveStatus[]) => {
        setPolicyActiveStatusChanges(changes);
        setSaveNeeded(true);
        actions.setNavigationBlocked(true);
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
                        to='/admin_console/system_attributes/membership_policies'
                        className='fa fa-angle-left back'
                    />
                    <FormattedMessage
                        id='admin.access_control.policy.edit_policy.title'
                        defaultMessage='Edit Membership Policy'
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
                                    defaultMessage='Membership policy name:'
                                />
                            }
                            value={policyName}
                            placeholder={formatMessage({
                                id: 'admin.access_control.policy.edit_policy.policyName.placeholder',
                                defaultMessage: 'Add a unique policy name',
                            })}
                            onChange={(_, value) => {
                                setPolicyName(value);
                                setSaveNeeded(true);
                                actions.setNavigationBlocked(true);
                            }}
                            labelClassName='col-sm-4 vertically-centered-label'
                            inputClassName='col-sm-8'
                            autoFocus={policyId === undefined}
                        />
                    </div>
                    {noUsableAttributes && (<div className='admin-console__warning-notice'>
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
                                        defaultMessage='Attribute-based membership rules'
                                    />
                                }
                                subtitle={
                                    <FormattedMessage
                                        id='admin.access_control.policy.edit_policy.access_rules.subtitle'
                                        defaultMessage='Select user attributes and values that qualifying users must have'
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
                                isDisabled={noUsableAttributes || (editorMode === 'cel' && !isSimpleExpression(expression))}
                                tooltipText={(() => {
                                    if (noUsableAttributes) {
                                        return formatMessage({
                                            id: 'admin.access_control.policy.edit_policy.no_usable_attributes_tooltip',
                                            defaultMessage: 'Please configure user attributes to use the editor.',
                                        });
                                    }
                                    if (editorMode === 'cel' && !isSimpleExpression(expression)) {
                                        return formatMessage({
                                            id: 'admin.access_control.policy.edit_policy.complex_expression_tooltip',
                                            defaultMessage: 'Complex expression detected. Simple expressions editor is not available at the moment.',
                                        });
                                    }
                                    return undefined;
                                })()}
                            />
                        </Card.Header>
                        <Card.Body>
                            {editorMode === 'cel' ? (
                                <CELEditor
                                    value={expression}
                                    onChange={(value) => {
                                        setExpression(value);
                                        setSaveNeeded(true);
                                        actions.setNavigationBlocked(true);
                                    }}
                                    onValidate={() => {}}
                                    disabled={noUsableAttributes}
                                    userAttributes={autocompleteResult.
                                        filter((attr) => {
                                            if (accessControlSettings.EnableUserManagedAttributes) {
                                                return true;
                                            }
                                            const isSynced = attr.attrs?.ldap || attr.attrs?.saml;
                                            const isAdminManaged = attr.attrs?.managed === 'admin';
                                            const isProtected = attr.attrs?.protected;
                                            return isSynced || isAdminManaged || isProtected;
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
                                        setSaveNeeded(true);
                                        actions.setNavigationBlocked(true);
                                    }}
                                    onValidate={() => {}}
                                    disabled={noUsableAttributes}
                                    userAttributes={autocompleteResult}
                                    onParseError={() => {
                                        setEditorMode('cel');
                                    }}
                                    enableUserManagedAttributes={accessControlSettings.EnableUserManagedAttributes}
                                    actions={abacActions}
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
                                        defaultMessage='Add channels that this membership policy will apply to.'
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
                                policyActiveStatusChanges={policyActiveStatusChanges}
                                onPolicyActiveStatusChange={handlePolicyActiveStatusChange}
                                saving={saving}
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
                    excludeTypes={['D', 'G']}
                    customNoOptionsMessage={customNoChannelsMessage}
                    excludeGroupConstrained={true}
                    excludeDefaultChannels={true}
                />
            )}

            {showConfirmationModal && (() => {
                // Effective channel mix = (saved - removed) + added. The
                // confirmation modal messages the user differently for mixed,
                // private-only, and public-only selections.
                let publicCount = 0;
                let privateCount = 0;
                for (const [id, type] of Object.entries(savedChannelTypes)) {
                    if (channelChanges.removed[id]) {
                        continue;
                    }
                    if (type === Constants.OPEN_CHANNEL) {
                        publicCount++;
                    } else if (type === Constants.PRIVATE_CHANNEL) {
                        privateCount++;
                    }
                }
                for (const ch of Object.values(channelChanges.added)) {
                    if (ch.type === Constants.OPEN_CHANNEL) {
                        publicCount++;
                    } else if (ch.type === Constants.PRIVATE_CHANNEL) {
                        privateCount++;
                    }
                }
                return (
                    <PolicyConfirmationModal
                        active={autoSyncMembership}
                        onExited={() => setShowConfirmationModal(false)}
                        onConfirm={handleSubmit}
                        channelsAffected={(channelsCount - channelChanges.removedCount) + Object.keys(channelChanges.added).length}
                        publicChannelsAffected={publicCount}
                        privateChannelsAffected={privateCount}
                    />
                );
            })()}

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
                    confirmButtonVariant='destructive'
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
                    disabled={!saveNeeded}
                    saving={saving}
                    onClick={() => {
                        if (!preSaveCheck()) {
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
                    className={buttonClassNames({emphasis: 'quaternary'})}
                    to='/admin_console/system_attributes/membership_policies'
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
