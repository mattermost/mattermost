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
    canUserSendBurnOnRead,
} from 'selectors/burn_on_read';

import BurnOnReadButton from 'components/burn_on_read/burn_on_read_button';
import BurnOnReadLabel from 'components/burn_on_read/burn_on_read_label';
import BurnOnReadTourTip from 'components/burn_on_read/burn_on_read_tour_tip';

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
 * @returns Object containing label and control components, plus handlers
 */
const useBurnOnRead = (
    draft: PostDraft,
    handleDraftChange: (draft: PostDraft, options: {instant?: boolean; show?: boolean}) => void,
    focusTextbox: (keepFocus?: boolean) => void,
    shouldShowPreview: boolean,
    showIndividualCloseButton = true,
) => {
    const rootId = draft.rootId;
    const channelId = draft.channelId;
    const isEnabled = useSelector(isBurnOnReadEnabled);
    const durationMinutes = useSelector(getBurnOnReadDurationMinutes);
    const canSend = useSelector(canUserSendBurnOnRead);
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
            return true;
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

        return true; // Allow all other channel types
    }, [channel, currentUser, otherUser]);

    const hasBurnOnReadSet = isEnabled && draft.type === PostTypes.BURN_ON_READ;

    const handleBurnOnReadApply = useCallback((enabled: boolean) => {
        const updatedDraft = {
            ...draft,
            type: enabled ? PostTypes.BURN_ON_READ : undefined,
        };

        handleDraftChange(updatedDraft, {instant: true});
        focusTextbox();
    }, [draft, handleDraftChange, focusTextbox]);

    const handleRemoveBurnOnRead = useCallback(() => {
        handleBurnOnReadApply(false);
    }, [handleBurnOnReadApply]);

    // Label component (shows above editor when active)
    const labels = useMemo(() => (
        (hasBurnOnReadSet && !rootId) ? (
            <BurnOnReadLabel
                canRemove={showIndividualCloseButton && !shouldShowPreview}
                onRemove={handleRemoveBurnOnRead}
                durationMinutes={durationMinutes}
            />
        ) : undefined
    ), [hasBurnOnReadSet, rootId, showIndividualCloseButton, shouldShowPreview, handleRemoveBurnOnRead, durationMinutes]);

    // Button component with tour tip wrapper (in formatting bar)
    const additionalControl = useMemo(() =>
        (!rootId && isEnabled && canSend && isAllowedInChannel ? (
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
                />
                <BurnOnReadTourTip
                    key='burn-on-read-tour-tip-key'
                    onTryItOut={() => handleBurnOnReadApply(true)}
                />
            </div>
        ) : undefined), [rootId, isEnabled, canSend, isAllowedInChannel, hasBurnOnReadSet, handleBurnOnReadApply, shouldShowPreview, durationMinutes]);

    return {
        labels,
        additionalControl,
        handleBurnOnReadApply,
        handleRemoveBurnOnRead,
    };
};

export default useBurnOnRead;
