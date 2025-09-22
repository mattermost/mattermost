// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useState, useEffect} from 'react';
import {useDispatch} from 'react-redux';

import type {AccessControlPolicy} from '@mattermost/types/access_control';
import type {Channel} from '@mattermost/types/channels';

import {getAccessControlPolicy} from 'mattermost-redux/actions/access_control';

import type {ActionFunc} from 'types/store';

interface UseChannelSystemPoliciesResult {
    policies: AccessControlPolicy[];
    loading: boolean;
    error: string | null;
}

/**
 * Custom hook to fetch system-level policies applied to a channel
 * @param channel - The channel to fetch policies for
 * @returns Object containing policies array, loading state, and error
 */
export function useChannelSystemPolicies(channel: Channel | null): UseChannelSystemPoliciesResult {
    const dispatch = useDispatch();
    const [policies, setPolicies] = useState<AccessControlPolicy[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!channel) {
            setPolicies([]);
            setLoading(false);
            return;
        }

        const fetchPolicies = async () => {
            setLoading(true);
            setError(null);

            try {
                // Check if channel has policy_enforced flag (ABAC enabled)
                if (!channel.policy_enforced) {
                    setPolicies([]);
                    setLoading(false);
                    return;
                }

                // In ABAC, the policy ID is the same as the channel ID
                // This is how the backend links policies to channels
                const channelPolicyResult = await dispatch(getAccessControlPolicy(channel.id) as unknown as ActionFunc);

                if (channelPolicyResult.error) {
                    // No policy found for this channel
                    setPolicies([]);
                    setLoading(false);
                    return;
                }

                const channelPolicy = channelPolicyResult.data as AccessControlPolicy;

                // If the channel policy has imports (parent policies), fetch them
                if (channelPolicy && channelPolicy.imports && channelPolicy.imports.length > 0) {
                    // Fetch all parent policies in parallel with channel context
                    const parentPromises = channelPolicy.imports.map((parentId) =>
                        dispatch(getAccessControlPolicy(parentId, channel.id) as unknown as ActionFunc),
                    );

                    const parentResults = await Promise.all(parentPromises);
                    const parentPolicies: AccessControlPolicy[] = [];

                    for (const result of parentResults) {
                        if (result && !result.error && result.data) {
                            parentPolicies.push(result.data as AccessControlPolicy);
                        }
                    }

                    // Return parent policies if channel inherits from them
                    setPolicies(parentPolicies);
                } else if (channelPolicy && channelPolicy.type === 'parent') {
                    // If the channel directly has a parent policy applied
                    setPolicies([channelPolicy]);
                } else if (channelPolicy) {
                    // Channel has its own policy (could be a channel policy without imports)
                    // For channel-level policies without imports, we might want to show them
                    // but typically these are custom rules, not system policies
                    setPolicies([]);
                } else {
                    setPolicies([]);
                }
            } catch (err) {
                setError('Failed to fetch policies');
                setPolicies([]);
            } finally {
                setLoading(false);
            }
        };

        fetchPolicies();
    }, [channel, channel?.id, channel?.policy_enforced, dispatch]);

    return {policies, loading, error};
}
