// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import {FormattedMessage, defineMessage} from 'react-intl';
import type {AccessControlPolicy} from '@mattermost/types/admin';
import { ActionResult } from 'mattermost-redux/types/actions';
import { getHistory } from 'utils/browser_history';
import AdminPanelWithButton from 'components/widgets/admin_console/admin_panel_with_button';

import PolicySelectionModal from 'components/admin_console/access_control/modals/policy_selection/policy_selection_modal';

import './channel_access_control_policy.scss';

interface Props {
    policyEnforced: boolean;
    accessControlPolicy?: AccessControlPolicy;
    onToggle: (isSynced: boolean, isPublic: boolean, policyEnforced: boolean) => void;
    onPolicyRemoved: () => void;
    isPublic: boolean;
    isSynced: boolean;
    actions: {
        getAccessControlPolicy: (policyId: string) => Promise<ActionResult>;
        searchPolicies: (term: string, type: string, after: string, limit: number) => Promise<ActionResult>;
        assignChannelToAccessControlPolicy: (policyId: string, channelId: string) => Promise<ActionResult>;
        onPolicySelected?: (policy: AccessControlPolicy) => void;
    };
    channelId: string;
}

export const ChannelAccessControl: React.FC<Props> = (props: Props): JSX.Element => {
    const {policyEnforced, onToggle, accessControlPolicy, actions, isPublic, isSynced, channelId, onPolicyRemoved} = props;
    const [importedPolicies, setImportedPolicies] = useState<AccessControlPolicy[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [showPolicySelectionModal, setShowPolicySelectionModal] = useState<boolean>(false);
    const [selectedPolicy, setSelectedPolicy] = useState<AccessControlPolicy | undefined>(undefined);

    useEffect(() => {
        const fetchImportedPolicies = async () => {
            if (accessControlPolicy?.imports && accessControlPolicy.imports.length > 0) {
                setLoading(true);
                const policies: AccessControlPolicy[] = [];
                
                for (const policyId of accessControlPolicy.imports) {
                    try {
                        const result = await actions.getAccessControlPolicy(policyId);
                        if (result.data) {
                            policies.push(result.data as AccessControlPolicy);
                        }
                    } catch (error) {
                        console.error('Error fetching policy', error);
                    }
                }
                
                setImportedPolicies(policies);
                setLoading(false);
            } else {
                setLoading(false);
            }
        };

        fetchImportedPolicies();
    }, [accessControlPolicy?.imports]);

    const handlePolicySelected = (policy: AccessControlPolicy) => {
        // Using the parent component's onToggle method to update parent state
        onToggle(isSynced, isPublic, true);
        
        // Store the selected policy in the parent component's state
        if (actions.onPolicySelected && policy) {
            actions.onPolicySelected(policy);
        }
        
        setShowPolicySelectionModal(false);
    };

    const handleClosePolicyModal = () => {
        setShowPolicySelectionModal(false);
    };

    const handleOpenPolicyModal = () => {
        setShowPolicySelectionModal(true);
    };

    const renderTable = () => {
        if (loading) {
            return (
                <div className='loading-container'>
                    <FormattedMessage
                        id='admin.channel_settings.channel_detail.access_control_policy_loading'
                        defaultMessage='Loading...'
                    />
                </div>
            );
        }

        if (!accessControlPolicy?.imports && !accessControlPolicy?.id) {
            return null;
        }

        return (
            <div className='policy-table-container'>
                <table className='policy-table'>
                    <thead>
                        <tr>
                            <th>
                                <FormattedMessage
                                    id='admin.channel_settings.channel_detail.access_control_policy_name'
                                    defaultMessage='Name'
                                />
                            </th>
                            <th className='text-right'>
                                <span className='sr-only'>
                                    <FormattedMessage
                                        id='admin.channel_settings.channel_detail.access_control_policy_actions'
                                        defaultMessage='Actions'
                                    />
                                </span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {importedPolicies.map((policy) => (
                            <tr key={policy.id}>
                                <td className='policy-name'>{policy.name}</td>
                                <td className='text-right'>
                                    <a
                                        className='policy-edit-icon'
                                        onClick={(e) => {
                                            e.preventDefault();
                                            getHistory().push('/admin_console/user_management/attribute_based_access_control/edit_policy/' + policy.id);
                                        }}
                                        aria-label='Edit policy'
                                        href='#'
                                    >
                                        <i className='fa fa-external-link'/>
                                    </a>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    // Attribute based access is disabled
    if (!policyEnforced) {
        return <></>;
    }

    // Attribute based access is enabled, but no policy
    if (policyEnforced && (!accessControlPolicy?.imports || accessControlPolicy.imports.length === 0)) {
        return (
            <AdminPanelWithButton
                id='channel_access_control_policy'
                title={defineMessage({id: 'admin.channel_settings.channel_detail.access_control_policy_title', defaultMessage: 'Access policy'})}
                subtitle={defineMessage({id: 'admin.channel_settings.channel_detail.access_control_policy_description', defaultMessage: 'Select an access policy for this channel to restrict membership.'})}
                buttonText={defineMessage({id: 'admin.channel_settings.channel_detail.link_policy', defaultMessage: 'Link to a policy'})}
                onButtonClick={() => {
                    handleOpenPolicyModal();
                }}
            >
                {showPolicySelectionModal && (
                    <PolicySelectionModal
                        show={showPolicySelectionModal}
                        onHide={handleClosePolicyModal}
                        onPolicySelected={handlePolicySelected}
                        actions={{
                            searchPolicies: actions.searchPolicies,
                        }}
                    />
                )}
            </AdminPanelWithButton>
        )
    }

    return (
        <AdminPanelWithButton
            id='channel_access_control_with_policy'
            title={defineMessage({id: 'admin.channel_settings.channel_detail.access_control_policy_title', defaultMessage: 'Access Policy'})}
            subtitle={defineMessage({id: 'admin.channel_settings.channel_detail.policy_following', defaultMessage: 'This channel is currently using the following access policy.'})}
            buttonText={
                defineMessage({id: 'admin.channel_settings.channel_detail.remove_policy', defaultMessage: 'Remove policy'})
            }
            onButtonClick={() => {
                onToggle(isSynced, isPublic, true);
                onPolicyRemoved();
            }}
        >
            <div className='group-teams-and-channels'>
                <div className='group-teams-and-channels--body'>
                    <div className='access-policy-container'>
                        {!accessControlPolicy && (
                            <div className='access-policy-description'>
                                <FormattedMessage
                                    id='admin.channel_settings.channel_detail.select_policy'
                                    defaultMessage='Select an access policy for this channel to restrict membership'
                                />
                            </div>
                        )}
                        {renderTable()}
                    </div>
                </div>
            </div>
        </AdminPanelWithButton>
    );
};
