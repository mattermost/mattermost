// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {FormattedMessage, defineMessage, useIntl} from 'react-intl';
import {Link} from 'react-router-dom';

import type {AccessControlPolicy} from '@mattermost/types/access_control';

import type {ActionResult} from 'mattermost-redux/types/actions';

import PolicySelectionModal from 'components/admin_console/access_control/modals/policy_selection/policy_selection_modal';
import AdminPanelWithButton from 'components/widgets/admin_console/admin_panel_with_button';

import './team_access_control_policy.scss';

const PAGE_SIZE = 10;

interface Props {
    parentPolicies: AccessControlPolicy[];
    actions: {
        searchPolicies: (term: string, type: string, after: string, limit: number) => Promise<ActionResult>;
        onPolicySelected?: (policy: AccessControlPolicy) => void;
        onPolicyRemove: (policyId: string) => void;
    };
}

export const TeamAccessControl: React.FC<Props> = (props: Props): JSX.Element => {
    const {parentPolicies: accessControlPolicies, actions} = props;
    const [showPolicySelectionModal, setShowPolicySelectionModal] = useState<boolean>(false);
    const [page, setPage] = useState(0);

    const intl = useIntl();

    const handlePolicySelected = useCallback((policy: AccessControlPolicy) => {
        if (actions.onPolicySelected && policy) {
            actions.onPolicySelected(policy);
        }
        setShowPolicySelectionModal(false);
    }, [actions]);

    const handleClosePolicyModal = useCallback(() => setShowPolicySelectionModal(false), []);
    const handleOpenPolicyModal = useCallback(() => setShowPolicySelectionModal(true), []);

    const total = accessControlPolicies.length;
    const startCount = (page * PAGE_SIZE) + 1;
    const endCount = Math.min((page + 1) * PAGE_SIZE, total);
    const visiblePolicies = accessControlPolicies.slice(startCount - 1, endCount);

    const policySelectionModal = (
        <PolicySelectionModal
            show={showPolicySelectionModal}
            onHide={handleClosePolicyModal}
            onPolicySelected={handlePolicySelected}
            actions={{searchPolicies: actions.searchPolicies}}
        />
    );

    if (accessControlPolicies.length === 0) {
        return (
            <AdminPanelWithButton
                id='team_access_control_policy'
                title={defineMessage({id: 'admin.team_settings.team_detail.access_control_policy_title', defaultMessage: 'Membership policies'})}
                subtitle={defineMessage({id: 'admin.team_settings.team_detail.access_control_policy_description', defaultMessage: 'Manage attribute based membership policies applicable to this team'})}
                buttonText={defineMessage({id: 'admin.team_settings.team_detail.link_policy', defaultMessage: 'Link to a policy'})}
                onButtonClick={handleOpenPolicyModal}
            >
                <div className='team-policy-list__empty'>
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
                {policySelectionModal}
            </AdminPanelWithButton>
        );
    }

    return (
        <AdminPanelWithButton
            id='team_access_control_with_policy'
            title={defineMessage({id: 'admin.team_settings.team_detail.access_control_policy_title', defaultMessage: 'Membership policies'})}
            subtitle={defineMessage({id: 'admin.team_settings.team_detail.policy_following', defaultMessage: 'Manage attribute based membership policies applicable to this team'})}
            buttonText={defineMessage({id: 'admin.team_settings.team_detail.add_policy', defaultMessage: '+ Add policy'})}
            onButtonClick={handleOpenPolicyModal}
        >
            <div className='team-policy-list'>
                <div className='team-policy-list__header'>
                    <span className='team-policy-list__col-name'>
                        <FormattedMessage
                            id='admin.team_settings.team_detail.access_control_policy_name'
                            defaultMessage='Policy Name'
                        />
                    </span>
                    <span className='team-policy-list__col-actions'>
                        <FormattedMessage
                            id='admin.team_settings.team_detail.access_control_policy_actions'
                            defaultMessage='Actions'
                        />
                    </span>
                </div>

                {visiblePolicies.map((policy) => (
                    <div
                        key={policy.id}
                        className='team-policy-list__row'
                    >
                        <span className='team-policy-list__col-name team-policy-list__policy-name'>
                            {policy.name}
                        </span>
                        <span className='team-policy-list__col-actions'>
                            <Link
                                to={'/admin_console/system_attributes/membership_policies/edit_policy/' + policy.id}
                                className='team-policy-list__action-btn'
                                aria-label={intl.formatMessage({
                                    id: 'admin.team_settings.team_detail.go_to_policy.aria_label',
                                    defaultMessage: 'Go to the policy',
                                })}
                            >
                                <i className='fa fa-external-link'/>
                            </Link>
                            <button
                                className='team-policy-list__action-btn team-policy-list__action-remove'
                                aria-label={intl.formatMessage({
                                    id: 'admin.team_settings.team_detail.remove_policy.aria_label',
                                    defaultMessage: 'Remove policy',
                                })}
                                onClick={() => actions.onPolicyRemove(policy.id)}
                            >
                                <i className='fa fa-trash'/>
                            </button>
                        </span>
                    </div>
                ))}

                <div className='team-policy-list__footer'>
                    <span className='team-policy-list__pagination-count'>
                        {`${startCount} - ${endCount} of ${total}`}
                    </span>
                    <button
                        className='team-policy-list__pagination-btn'
                        disabled={page === 0}
                        onClick={() => setPage((p) => p - 1)}
                        aria-label={intl.formatMessage({id: 'admin.team_settings.team_detail.prev_page', defaultMessage: 'Previous page'})}
                    >
                        <i className='fa fa-chevron-left'/>
                    </button>
                    <button
                        className='team-policy-list__pagination-btn'
                        disabled={endCount >= total}
                        onClick={() => setPage((p) => p + 1)}
                        aria-label={intl.formatMessage({id: 'admin.team_settings.team_detail.next_page', defaultMessage: 'Next page'})}
                    >
                        <i className='fa fa-chevron-right'/>
                    </button>
                </div>
            </div>
            {policySelectionModal}
        </AdminPanelWithButton>
    );
};
