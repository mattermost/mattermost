// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {FormattedMessage, defineMessage} from 'react-intl';

import type {AccessControlPolicy} from '@mattermost/types/admin';

import type {ActionResult} from 'mattermost-redux/types/actions';

import PolicySelectionModal from 'components/admin_console/access_control/modals/policy_selection/policy_selection_modal';
import AdminPanelWithButton from 'components/widgets/admin_console/admin_panel_with_button';

import {getHistory} from 'utils/browser_history';

import './channel_access_control_policy.scss';

interface Props {
    accessControlPolicies: AccessControlPolicy[];
    actions: {
        searchPolicies: (term: string, type: string, after: string, limit: number) => Promise<ActionResult>;
        onPolicySelected?: (policy: AccessControlPolicy) => void;
        onPolicyRemoved: () => void;
    };
}

export const ChannelAccessControl: React.FC<Props> = (props: Props): JSX.Element => {
    const {accessControlPolicies, actions} = props;
    const [showPolicySelectionModal, setShowPolicySelectionModal] = useState<boolean>(false);

    const handlePolicySelected = (policy: AccessControlPolicy) => {
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
        if (!accessControlPolicies || accessControlPolicies.length === 0) {
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
                        {accessControlPolicies.map((policy) => (
                            <tr key={policy.id}>
                                <td className='policy-name'>{policy.name}</td>
                                <td className='text-right'>
                                    <a
                                        className='policy-edit-icon'
                                        onClick={(e) => {
                                            e.preventDefault();
                                            getHistory().push('/admin_console/user_management/attribute_based_access_control/edit_policy/' + policy.id);
                                        }}
                                        aria-label='Go to the policy'
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

    // Attribute based access is enabled, but no policy
    if (accessControlPolicies.length === 0) {
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
                <PolicySelectionModal
                    show={showPolicySelectionModal}
                    onHide={handleClosePolicyModal}
                    onPolicySelected={handlePolicySelected}
                    actions={{
                        searchPolicies: actions.searchPolicies,
                    }}
                />
            </AdminPanelWithButton>
        );
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
                actions.onPolicyRemoved();
            }}
        >
            <div className='group-teams-and-channels'>
                <div className='group-teams-and-channels--body'>
                    <div className='access-policy-container'>
                        {!accessControlPolicies && (
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
