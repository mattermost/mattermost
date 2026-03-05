// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {FormattedMessage} from 'react-intl';

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

const SystemPolicyIndicator: React.FC<SystemPolicyIndicatorProps> = ({
    policies = [],
    resourceType = 'channel',
    showPolicyNames = true,
    variant = 'detailed',
    className = '',
    testId = 'system-policy-indicator',
    onMorePoliciesClick,
}) => {
    // Handle malformed data - ensure policies is always an array
    const safePolicies = useMemo(() => {
        if (!policies || !Array.isArray(policies)) {
            return [];
        }
        return policies.filter((policy) => policy && typeof policy === 'object' && policy.id);
    }, [policies]);

    const hasMultiplePolicies = safePolicies.length > 1;

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

    const getPolicyDisplayName = useCallback((policy: AccessControlPolicy): string => {
        return policy.name || policy.id || 'Unknown Policy';
    }, []);

    const renderPolicyList = useCallback(() => {
        if (!showPolicyNames || safePolicies.length === 0) {
            return '';
        }

        if (safePolicies.length === 1) {
            return <strong>{getPolicyDisplayName(safePolicies[0])}</strong>;
        }

        if (safePolicies.length === 2) {
            return (
                <>
                    <strong>{getPolicyDisplayName(safePolicies[0])}</strong>
                    {' and '}
                    <strong>{getPolicyDisplayName(safePolicies[1])}</strong>
                </>
            );
        }

        // More than 2 policies: show first two and "X more"
        const remainingCount = safePolicies.length - 2;
        return (
            <>
                <strong>{getPolicyDisplayName(safePolicies[0])}</strong>
                {', '}
                <strong>{getPolicyDisplayName(safePolicies[1])}</strong>
                {' and '}
                <button
                    type='button'
                    className='system-policy-indicator__more-link'
                    onClick={handleMorePoliciesClick}
                    onKeyDown={handleKeyDown}
                    aria-label={`View ${remainingCount} more policies`}
                    tabIndex={0}
                >
                    <FormattedMessage
                        id='system_policy_indicator.more_policies'
                        defaultMessage='{count} more'
                        values={{
                            count: remainingCount,
                        }}
                    />
                </button>
            </>
        );
    }, [showPolicyNames, safePolicies, getPolicyDisplayName, handleMorePoliciesClick, handleKeyDown]);

    const renderCompactMessage = useCallback(() => {
        return (
            <FormattedMessage
                id='system_policy_indicator.base_message'
                defaultMessage='This {resourceType} has system-level access {policyText} applied'
                values={{
                    resourceType,
                    policyText: hasMultiplePolicies ? 'policies' : 'policy',
                }}
            />
        );
    }, [resourceType, hasMultiplePolicies]);

    const renderDetailedMessage = useCallback(() => {
        const title = hasMultiplePolicies ? (
            <FormattedMessage
                id='system_policy_indicator.multiple_policies_title'
                defaultMessage='Multiple system access policies applied to this {resourceType}'
                values={{resourceType}}
            />
        ) : (
            <FormattedMessage
                id='system_policy_indicator.single_policy_title'
                defaultMessage='System access policy applied to this {resourceType}'
                values={{resourceType}}
            />
        );

        return (
            <>
                <div
                    className='system-policy-indicator__title'
                    role='heading'
                    aria-level={3}
                >
                    {title}
                </div>
                <div
                    className='system-policy-indicator__description'
                    role='region'
                    aria-label='System policy details'
                >
                    <FormattedMessage
                        id='system_policy_indicator.description_with_policies'
                        defaultMessage='This {resourceType} has system-level access policies applied: {policyList}. Any custom access rules you set here will be applied in addition to this policy.'
                        values={{
                            resourceType,
                            policyList: renderPolicyList(),
                        }}
                    />
                </div>
            </>
        );
    }, [hasMultiplePolicies, resourceType, renderPolicyList]);

    const renderMessage = useCallback(() => {
        if (variant === 'compact') {
            return renderCompactMessage();
        }
        return renderDetailedMessage();
    }, [variant, renderCompactMessage, renderDetailedMessage]);

    const alertMessage = useMemo(() => renderMessage(), [renderMessage]);

    if (safePolicies.length === 0) {
        return null;
    }

    return (
        <AlertBanner
            id={testId}
            mode='info'
            className={`system-policy-indicator ${className}`}
            variant='app'
            message={alertMessage}
        />
    );
};

export default SystemPolicyIndicator;
