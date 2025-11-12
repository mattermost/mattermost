// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {useSelector} from 'react-redux';

import {
    isBurnOnReadEnabled,
    getBurnOnReadDurationMinutes,
    canUserSendBurnOnRead,
} from 'selectors/burn_on_read';

import BurnOnReadButton from 'components/burn_on_read/burn_on_read_button';
import BurnOnReadLabel from 'components/burn_on_read/burn_on_read_label';
import BurnOnReadTourTip from 'components/burn_on_read/burn_on_read_tour_tip';

import 'components/burn_on_read/burn_on_read_control.scss';

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
    const isEnabled = useSelector(isBurnOnReadEnabled);
    const durationMinutes = useSelector(getBurnOnReadDurationMinutes);
    const canSend = useSelector(canUserSendBurnOnRead);

    // Check if BoR is active in draft
    const hasBurnOnReadSet = isEnabled &&
        draft.metadata?.burn_on_read?.enabled === true;

    // Handler to toggle BoR mode
    const handleBurnOnReadApply = useCallback((enabled: boolean) => {
        const updatedDraft = {
            ...draft,
        };

        if (enabled) {
            updatedDraft.metadata = {
                ...updatedDraft.metadata,
                burn_on_read: {
                    enabled: true,
                },
            };
        } else {
            // Remove burn_on_read from metadata
            // eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-unused-vars
            const {burn_on_read: _, ...restMetadata} = updatedDraft.metadata || {};
            updatedDraft.metadata = restMetadata;
        }

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
        (!rootId && isEnabled && canSend ? (
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
        ) : undefined), [rootId, isEnabled, canSend, hasBurnOnReadSet, handleBurnOnReadApply, shouldShowPreview, durationMinutes]);

    return {
        labels,
        additionalControl,
        handleBurnOnReadApply,
        handleRemoveBurnOnRead,
    };
};

export default useBurnOnRead;
