// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {FormattedList, FormattedMessage, defineMessages, useIntl} from 'react-intl';

import type {AccessControlPolicy} from '@mattermost/types/access_control';

import AlertBanner from 'components/alert_banner';

import './system_policy_indicator.scss';

export type SystemPolicyIndicatorProps = {
    policies?: AccessControlPolicy[];
    resourceType?: 'channel' | 'team' | 'file';
    showPolicyNames?: boolean;
    variant?: 'compact' | 'detailed';
    className?: string;
    testId?: string;
    onMorePoliciesClick?: () => void;
};

// Each message selects on resourceType so that translators write whole sentences. Channels and
// teams use membership wording because the policy governs who becomes a member; files keep
// access wording, since a user doesn't become a "member" of a file.
const singlePolicyMessages = defineMessages({
    summary: {
        id: 'system_policy_indicator.summary.single',
        defaultMessage: '{resourceType, select, team {This team has a system-level membership policy applied} file {This file has a system-level access policy applied} other {This channel has a system-level membership policy applied}}',
    },
    title: {
        id: 'system_policy_indicator.title.single',
        defaultMessage: '{resourceType, select, team {System membership policy applied to this team} file {System access policy applied to this file} other {System membership policy applied to this channel}}',
    },
    description: {
        id: 'system_policy_indicator.description.single',
        defaultMessage: '{resourceType, select, team {This team has a system-level membership policy applied. Any custom membership rules you set here will be applied in addition to this policy.} file {This file has a system-level access policy applied. Any custom access rules you set here will be applied in addition to this policy.} other {This channel has a system-level membership policy applied. Any custom membership rules you set here will be applied in addition to this policy.}}',
    },
    descriptionWithNames: {
        id: 'system_policy_indicator.description_with_names.single',
        defaultMessage: '{resourceType, select, team {This team has a system-level membership policy applied: {policies}. Any custom membership rules you set here will be applied in addition to this policy.} file {This file has a system-level access policy applied: {policies}. Any custom access rules you set here will be applied in addition to this policy.} other {This channel has a system-level membership policy applied: {policies}. Any custom membership rules you set here will be applied in addition to this policy.}}',
    },
});

const multiplePolicyMessages = defineMessages({
    summary: {
        id: 'system_policy_indicator.summary.multiple',
        defaultMessage: '{resourceType, select, team {This team has system-level membership policies applied} file {This file has system-level access policies applied} other {This channel has system-level membership policies applied}}',
    },
    title: {
        id: 'system_policy_indicator.title.multiple',
        defaultMessage: '{resourceType, select, team {Multiple system membership policies applied to this team} file {Multiple system access policies applied to this file} other {Multiple system membership policies applied to this channel}}',
    },
    description: {
        id: 'system_policy_indicator.description.multiple',
        defaultMessage: '{resourceType, select, team {This team has system-level membership policies applied. Any custom membership rules you set here will be applied in addition to these policies.} file {This file has system-level access policies applied. Any custom access rules you set here will be applied in addition to these policies.} other {This channel has system-level membership policies applied. Any custom membership rules you set here will be applied in addition to these policies.}}',
    },
    descriptionWithNames: {
        id: 'system_policy_indicator.description_with_names.multiple',
        defaultMessage: '{resourceType, select, team {This team has system-level membership policies applied: {policies}. Any custom membership rules you set here will be applied in addition to these policies.} file {This file has system-level access policies applied: {policies}. Any custom access rules you set here will be applied in addition to these policies.} other {This channel has system-level membership policies applied: {policies}. Any custom membership rules you set here will be applied in addition to these policies.}}',
    },
});

const MAX_NAMED_POLICIES = 2;

const SystemPolicyIndicator: React.FC<SystemPolicyIndicatorProps> = ({
    policies = [],
    resourceType = 'channel',
    showPolicyNames = true,
    variant = 'detailed',
    className = '',
    testId = 'system-policy-indicator',
    onMorePoliciesClick,
}) => {
    const {formatMessage} = useIntl();

    // Handle malformed data - ensure policies is always an array
    const safePolicies = useMemo(() => {
        if (!policies || !Array.isArray(policies)) {
            return [];
        }
        return policies.filter((policy) => policy && typeof policy === 'object' && policy.id);
    }, [policies]);

    const messages = safePolicies.length > 1 ? multiplePolicyMessages : singlePolicyMessages;

    const handleMorePoliciesClick = useCallback((event: React.MouseEvent | React.KeyboardEvent) => {
        event.preventDefault();
        event.stopPropagation();
        if (onMorePoliciesClick) {
            onMorePoliciesClick();
        }
    }, [onMorePoliciesClick]);

    const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
            handleMorePoliciesClick(event);
        }
    }, [handleMorePoliciesClick]);

    const policyList = useMemo(() => {
        const items = safePolicies.slice(0, MAX_NAMED_POLICIES).map((policy) => (
            <strong key={policy.id}>
                {policy.name || policy.id || formatMessage({
                    id: 'system_policy_indicator.unknown_policy',
                    defaultMessage: 'Unknown Policy',
                })}
            </strong>
        ));

        const remainingCount = safePolicies.length - MAX_NAMED_POLICIES;
        if (remainingCount > 0) {
            items.push(
                <button
                    key='more'
                    type='button'
                    className='system-policy-indicator__more-link'
                    onClick={handleMorePoliciesClick}
                    onKeyDown={handleKeyDown}
                    aria-label={formatMessage({
                        id: 'system_policy_indicator.more_policies_aria_label',
                        defaultMessage: 'View {count, plural, one {# more policy} other {# more policies}}',
                    }, {count: remainingCount})}
                    tabIndex={0}
                >
                    <FormattedMessage
                        id='system_policy_indicator.more_policies'
                        defaultMessage='{count} more'
                        values={{count: remainingCount}}
                    />
                </button>,
            );
        }

        return (
            <FormattedList
                key='policies'
                type='conjunction'
                value={items}
            />
        );
    }, [safePolicies, handleMorePoliciesClick, handleKeyDown, formatMessage]);

    const renderDetailedMessage = () => (
        <>
            <div
                className='system-policy-indicator__title'
                role='heading'
                aria-level={3}
            >
                <FormattedMessage
                    {...messages.title}
                    values={{resourceType}}
                />
            </div>
            <div
                className='system-policy-indicator__description'
                role='region'
                aria-label={formatMessage({
                    id: 'system_policy_indicator.details_aria_label',
                    defaultMessage: 'System policy details',
                })}
            >
                {showPolicyNames ? (
                    <FormattedMessage
                        {...messages.descriptionWithNames}
                        values={{resourceType, policies: policyList}}
                    />
                ) : (
                    <FormattedMessage
                        {...messages.description}
                        values={{resourceType}}
                    />
                )}
            </div>
        </>
    );

    if (safePolicies.length === 0) {
        return null;
    }

    return (
        <AlertBanner
            id={testId}
            mode='info'
            className={`system-policy-indicator ${className}`}
            variant='app'
            message={variant === 'compact' ? (
                <FormattedMessage
                    {...messages.summary}
                    values={{resourceType}}
                />
            ) : renderDetailedMessage()}
        />
    );
};

export default SystemPolicyIndicator;
