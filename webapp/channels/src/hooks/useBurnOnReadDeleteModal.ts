// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback} from 'react';
import {useDispatch} from 'react-redux';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {Preferences} from 'mattermost-redux/constants';

import {burnPostNow} from 'actions/burn_on_read_deletion';
import {closeModal} from 'actions/views/modals';

import {ModalIdentifiers} from 'utils/constants';

interface BurnOnReadDeleteModalParams {
    postId: string;
    userId: string;
    isSender: boolean;
}

interface BurnOnReadDeleteModalHandlers {
    onConfirm: (skipConfirmation: boolean) => Promise<void>;
    onCancel: () => void;
    isSenderDelete: boolean;
    showCheckbox: boolean;
}

/**
 * Preference object structure for saving user preferences
 */
interface PreferenceType {
    category: string;
    user_id: string;
    name: string;
    value: string;
}

/**
 * Actions interface for BoR delete modal (matches what's available in dot_menu and post_component)
 */
interface BurnOnReadDeleteActions {
    burnPostNow?: (postId: string) => Promise<{data?: boolean; error?: Error}>;
    closeModal: (modalId: string) => void;
    savePreferences: (userId: string, preferences: PreferenceType[]) => void;
}

/**
 * Creates handlers for the Burn-on-Read delete confirmation modal
 * Works with both class and function components by accepting bound actions
 *
 * @param actions - Bound action creators (from Redux connect or useDispatch)
 * @param params - Configuration params (postId, userId, isSender)
 * @returns Object with onConfirm, onCancel callbacks and modal props
 */
export function createBurnOnReadDeleteModalHandlers(
    actions: BurnOnReadDeleteActions,
    {postId, userId, isSender}: BurnOnReadDeleteModalParams,
): BurnOnReadDeleteModalHandlers {
    return {
        onConfirm: async (skipConfirmation: boolean) => {
            // Delete the post
            await actions.burnPostNow?.(postId);

            // Close the modal
            actions.closeModal(ModalIdentifiers.BURN_ON_READ_CONFIRMATION);

            // Save "Do not ask me again" preference if user checked it
            if (skipConfirmation) {
                const pref = {
                    category: Preferences.CATEGORY_BURN_ON_READ,
                    user_id: userId,
                    name: Preferences.BURN_ON_READ_SKIP_CONFIRMATION,
                    value: 'true',
                };
                actions.savePreferences(userId, [pref]);
            }
        },
        onCancel: () => {
            actions.closeModal(ModalIdentifiers.BURN_ON_READ_CONFIRMATION);
        },
        isSenderDelete: isSender,
        showCheckbox: !isSender,
    };
}

/**
 * Hook version for function components
 * Provides handlers for the Burn-on-Read delete confirmation modal
 */
export function useBurnOnReadDeleteModal(
    params: BurnOnReadDeleteModalParams,
): BurnOnReadDeleteModalHandlers {
    const dispatch = useDispatch();
    const {postId, userId, isSender} = params;

    const onConfirm = useCallback(async (skipConfirmation: boolean) => {
        // Delete the post
        await dispatch(burnPostNow(postId));

        // Close the modal
        dispatch(closeModal(ModalIdentifiers.BURN_ON_READ_CONFIRMATION));

        // Save "Do not ask me again" preference if user checked it
        if (skipConfirmation) {
            const pref: PreferenceType = {
                category: Preferences.CATEGORY_BURN_ON_READ,
                user_id: userId,
                name: Preferences.BURN_ON_READ_SKIP_CONFIRMATION,
                value: 'true',
            };
            dispatch(savePreferences(userId, [pref]));
        }
    }, [dispatch, postId, userId]);

    const onCancel = useCallback(() => {
        dispatch(closeModal(ModalIdentifiers.BURN_ON_READ_CONFIRMATION));
    }, [dispatch]);

    return {
        onConfirm,
        onCancel,
        isSenderDelete: isSender,
        showCheckbox: !isSender,
    };
}
