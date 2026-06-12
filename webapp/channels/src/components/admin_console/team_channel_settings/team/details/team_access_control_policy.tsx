// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {FormattedMessage, defineMessage, useIntl} from 'react-intl';
import {Link} from 'react-router-dom';

import type {AccessControlPolicy} from '@mattermost/types/access_control';

import type {ActionResult} from 'mattermost-redux/types/actions';

import PolicySelectionModal from 'components/admin_console/access_control/modals/policy_selection/policy_selection_modal';
import AdminPanelWithButton from 'components/widgets/admin_console/admin_panel_with_button';

import '../../channel/details/channel_access_control_policy.scss';

interface Props {
    parentPolicies: AccessControlPolicy[];
    actions: {
        searchPolicies: (term: string, type: string, after: string, limit: number) => Promise<ActionResult>;
        onPolicySelected?: (policy: AccessControlPolicy) => void;
        onPolicyRemoveAll: () => void;
        onPolicyRemove: (policyId: string) => void;
    };
}

export const TeamAccessControl: React.FC<Props> = (props: Props): JSX.Element => {
    const {parentPolicies: accessControlPolicies, actions} = props;
    const [showPolicySelectionModal, setShowPolicySelectionModal] = useState<boolean>(false);

    const intl = useIntl();

    const handlePolicySelected = useCallback((policy: AccessControlPolicy) => {
        if (actions.onPolicySelected && policy) {
            actions.onPolicySelected(policy);
        }
        setShowPolicySelectionModal(false);
    }, [actions]);

    const handleClosePolicyModal = useCallback(() => {
        setShowPolicySelectionModal(false);
    }, []);

    const handleOpenPolicyModal = useCallback(() => {
        setShowPolicySelectionModal(true);
    }, []);

    const handleRemoveAll = useCallback(() => {
        actions.onPolicyRemoveAll();
    }, [actions]);

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
                                    id='admin.team_settings.team_detail.access_control_policy_name'
                                    defaultMessage='Name'
                                />
                            </th>
                            <th className='text-right'>
                                <span className='sr-only'>
                                    <FormattedMessage
                                        id='admin.team_settings.team_detail.access_control_policy_actions'
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
                                    <Link
                                        to={'/admin_console/system_attributes/membership_policies/edit_policy/' + policy.id}
                                        className='policy-edit-icon'
                                        aria-label={intl.formatMessage({
                                            id: 'admin.team_settings.team_detail.go_to_policy.aria_label',
                                            defaultMessage: 'Go to the policy',
                                        })}
                                    >
                                        <i className='fa fa-external-link'/>
                                    </Link>
                                    <button
                                        className='policy-remove-icon'
                                        aria-label={intl.formatMessage({
                                            id: 'admin.team_settings.team_detail.remove_policy.aria_label',
                                            defaultMessage: 'Remove policy',
                                        })}
                                        onClick={() => {
                                            actions.onPolicyRemove(policy.id);
                                        }}
                                    >
                                        <i className='fa fa-trash'/>
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    // Attribute based access is enabled, but no policy assigned yet.
    if (accessControlPolicies.length === 0) {
        return (
            <AdminPanelWithButton
                id='team_access_control_policy'
                title={defineMessage({id: 'admin.team_settings.team_detail.access_control_policy_title', defaultMessage: 'Membership policy'})}
                subtitle={defineMessage({id: 'admin.team_settings.team_detail.access_control_policy_description', defaultMessage: 'Select a membership policy for this team.'})}
                buttonText={defineMessage({id: 'admin.team_settings.team_detail.link_policy', defaultMessage: 'Link to a policy'})}
                onButtonClick={handleOpenPolicyModal}
            >
                <div className='group-teams-and-channels'>
                    <div className='group-teams-and-channels--body'>
                        <FormattedMessage
                            id='admin.team_settings.team_detail.no_policy_assigned'
                            defaultMessage='No membership policy assigned. <link>Manage membership policies</link>.'
                            values={{
                                link: (msg: React.ReactNode) => (
                                    <Link to='/admin_console/system_attributes/membership_policies'>{msg}</Link>
                                ),
                            }}
                        />
                    </div>
                </div>
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
            id='team_access_control_with_policy'
            title={defineMessage({id: 'admin.team_settings.team_detail.access_control_policy_title', defaultMessage: 'Membership policy'})}
            subtitle={defineMessage({id: 'admin.team_settings.team_detail.policy_following', defaultMessage: 'This team is currently using the following membership policy.'})}
            buttonText={defineMessage({id: 'admin.team_settings.team_detail.remove_policy', defaultMessage: 'Remove all'})}
            onButtonClick={handleRemoveAll}
        >
            <div className='group-teams-and-channels'>
                <div className='group-teams-and-channels--body'>
                    <div className='access-policy-container'>
                        {renderTable()}
                    </div>
                </div>
            </div>
        </AdminPanelWithButton>
    );
};
