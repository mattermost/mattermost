// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {useSelector} from 'react-redux';

import {PostTypes} from 'mattermost-redux/constants/posts';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentUser, getUser} from 'mattermost-redux/selectors/entities/users';
import {getDirectChannelName, getUserIdFromChannelName, isDirectChannel} from 'mattermost-redux/utils/channel_utils';

import {
    isBurnOnReadEnabled,
    getBurnOnReadDurationMinutes,
} from 'selectors/burn_on_read';

import BurnOnReadButton from 'components/burn_on_read/burn_on_read_button';
import BurnOnReadLabel from 'components/burn_on_read/burn_on_read_label';
import BurnOnReadTourTip from 'components/burn_on_read/burn_on_read_tour_tip';
import {useCreateBurnOnReadAccess} from 'components/common/hooks/useCreateBurnOnReadAccess';

import 'components/burn_on_read/burn_on_read_control.scss';

import type {GlobalState} from 'types/store';
import type {PostDraft} from 'types/store/draft';

/**
 * Hook that manages Burn-on-Read functionality in the message composer.
 * Provides the BoR button, label, and tour tip components, along with handlers
 * to toggle BoR mode on/off for the current draft.
 *
 * @param draft - The current post draft
 * @param handleDraftChange - Callback to update the draft
 * @param focusTextbox - Callback to refocus the text editor
 * @param shouldShowPreview - Whether the preview mode is active
 * @param showIndividualCloseButton - Whether to show individual close button on label
 * @param blockedReason - Why burn-on-read can't be turned on for this message right now; disables the button, is its tooltip, and stops anything else from turning it on
 * @returns Object containing label and control components, plus handlers
 */
const useBurnOnRead = (
    draft: PostDraft,
    handleDraftChange: (draft: PostDraft, options: {instant?: boolean; show?: boolean}) => void,
    focusTextbox: (keepFocus?: boolean) => void,
    shouldShowPreview: boolean,
    showIndividualCloseButton = true,
    blockedReason?: string,
    testIdScope?: string,
) => {
    const rootId = draft.rootId;
    const channelId = draft.channelId;
    const isEnabled = useSelector(isBurnOnReadEnabled);
    const allowedByPolicy = useCreateBurnOnReadAccess(draft.channelId);
    const durationMinutes = useSelector(getBurnOnReadDurationMinutes);
    const channel = useSelector((state: GlobalState) => getChannel(state, channelId));
    const currentUser = useSelector(getCurrentUser);

    // Burn-on-read is not allowed in self-DMs or DMs with bots (AI agents, plugins, etc.)
    const otherUserId = useMemo(() => {
        if (!channel || !currentUser || !isDirectChannel(channel)) {
            return null;
        }
        return getUserIdFromChannelName(currentUser.id, channel.name);
    }, [channel, currentUser]);

    const otherUser = useSelector((state: GlobalState) => (otherUserId ? getUser(state, otherUserId) : null));

    const isAllowedInChannel = useMemo(() => {
        if (!channel || !currentUser) {
            return false; // Fail-closed: if we can't validate, don't show the button
        }

        // Check if it's a self-DM by comparing channel name with expected self-DM name
        if (isDirectChannel(channel)) {
            const selfDMName = getDirectChannelName(currentUser.id, currentUser.id);
            if (channel.name === selfDMName) {
                return false; // Block self-DMs
            }

            // Block DMs with bots (AI agents, plugins, etc.)
            if (otherUser?.is_bot) {
                return false;
            }
        }

        if (channel.shared) {
            return false;
        }

        return true; // Allow all other channel types
    }, [channel, currentUser, otherUser]);

    const hasBurnOnReadSet = isEnabled && draft.type === PostTypes.BURN_ON_READ;

    const handleBurnOnReadApply = useCallback((enabled: boolean) => {
        // Every way of turning it on goes through here, the tour tip's
        // "Try it out" included, so a blocked message can't get it from any of them.
        if (enabled && blockedReason) {
            return;
        }

        const updatedDraft = {
            ...draft,
            type: enabled ? PostTypes.BURN_ON_READ : undefined,
        };

        handleDraftChange(updatedDraft, {instant: true});
        focusTextbox();
    }, [draft, handleDraftChange, focusTextbox, blockedReason]);

    const handleRemoveBurnOnRead = useCallback(() => {
        handleBurnOnReadApply(false);
    }, [handleBurnOnReadApply]);

    // For the edge case where a draft was in Burn-on-Read and the policy was revoked, do not allow sending.
    const isBurnOnReadSendable = useMemo(() => (
        !(hasBurnOnReadSet && !allowedByPolicy)
    ), [hasBurnOnReadSet, allowedByPolicy]);

    // Label component (shows above editor when active)
    const labels = useMemo(() => (
        (hasBurnOnReadSet && !rootId) ? (
            <BurnOnReadLabel
                testId={testIdScope ? `${testIdScope}.burn_on_read_label` : undefined}
                canRemove={showIndividualCloseButton && !shouldShowPreview}
                onRemove={handleRemoveBurnOnRead}
                durationMinutes={durationMinutes}
            />
        ) : undefined
    ), [hasBurnOnReadSet, rootId, showIndividualCloseButton, shouldShowPreview, handleRemoveBurnOnRead, durationMinutes, testIdScope]);

    // Button component with tour tip wrapper (in formatting bar)
    const additionalControl = useMemo(() =>
        (!rootId && isEnabled && allowedByPolicy && isAllowedInChannel ? (
            <div
                key='burn-on-read-control-key'
                className='BurnOnReadControl'
            >
                <BurnOnReadButton
                    key='burn-on-read-button-key'
                    enabled={hasBurnOnReadSet}
                    onToggle={handleBurnOnReadApply}
                    disabled={shouldShowPreview}
                    durationMinutes={durationMinutes}
                    blockedReason={blockedReason}
                    testIdScope={testIdScope}
                />
                <BurnOnReadTourTip
                    key='burn-on-read-tour-tip-key'
                    onTryItOut={() => handleBurnOnReadApply(true)}
                />
            </div>
        ) : undefined), [rootId, isEnabled, allowedByPolicy, isAllowedInChannel, hasBurnOnReadSet, handleBurnOnReadApply, shouldShowPreview, durationMinutes, blockedReason, testIdScope]);

    return {
        labels,
        additionalControl,
        handleBurnOnReadApply,
        handleRemoveBurnOnRead,
        isBurnOnReadSendable,

        // Whether this root post is set to burn-on-read, for the controls that
        // can't be combined with it.
        hasBurnOnReadSet: hasBurnOnReadSet && !rootId,
    };
};

export default useBurnOnRead;
