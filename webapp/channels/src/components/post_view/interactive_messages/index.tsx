// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Entry point for the Interactive Messages framework.
//
// Reads a post's props, detects the payload format, runs the Translation Layer,
// and renders the result via the Block Renderer. Native mm_blocks / Block Kit /
// Adaptive Cards dispatch through doBlockAction; legacy attachments keep doPostAction.

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {DoBlockActionResponse} from '@mattermost/types/integration_actions';
import type {MmBlock} from '@mattermost/types/mm_blocks';
import type {Post} from '@mattermost/types/posts';

import {doBlockAction, doPostActionWithCookie} from 'mattermost-redux/actions/posts';

import {BlockRenderer} from 'components/block_renderer';
import {MmBlocksFieldUploadingContext, MmBlocksHasUploadingFieldsContext} from 'components/block_renderer/context';
import type {MmBlocksFormErrors, MmBlocksFormValues} from 'components/block_renderer/form';
import {isMmBlocksSubmitAction, validateMmBlocksFormValues} from 'components/block_renderer/form_validation';
import {getPostInteractiveIntegrationFormat, translatePostProps} from 'components/block_renderer/translation';
import {translateMMBlocks} from 'components/block_renderer/translation/mm_block';
import type {LookupHandler} from 'components/block_renderer/types';

import {openInteractiveDialog} from 'plugins/interactive_dialog';
import {applyIntegrationGotoLocation} from 'utils/integration_navigation';

type Props = {
    post: Post;

    /** Preview/read-only surfaces: render blocks but do not dispatch actions. */
    interactionsDisabled?: boolean;
};

function topLevelErrorMessage(data: DoBlockActionResponse | undefined): string | null {
    if (typeof data?.error === 'string' && data.error) {
        return data.error;
    }
    return null;
}

const InteractiveMessages = ({post, interactionsDisabled = false}: Props) => {
    const dispatch = useDispatch();
    const intl = useIntl();
    const [actionError, setActionError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<MmBlocksFormErrors>({});
    const [blocksOverride, setBlocksOverride] = useState<MmBlock[] | null>(null);
    const [cookieOverride, setCookieOverride] = useState<string | undefined>(undefined);
    const [blocksEpoch, setBlocksEpoch] = useState(0);
    const [uploadingFields, setUploadingFields] = useState<Set<string>>(() => new Set());
    const refreshRequestIdRef = useRef(0);

    const postProps = post.props as Record<string, unknown> | undefined;
    const mmBlocksActionsProp = postProps?.mm_blocks_actions;
    const mmBlocksActionCookie = typeof mmBlocksActionsProp === 'string' ? mmBlocksActionsProp : undefined;
    const integrationFormat = getPostInteractiveIntegrationFormat(postProps ?? {});

    useEffect(() => {
        setBlocksOverride(null);
        setCookieOverride(undefined);
        setActionError(null);
        setFieldErrors({});
        setBlocksEpoch(0);
        setUploadingFields(new Set());
        refreshRequestIdRef.current = 0;
    }, [post.id, post.update_at]);

    const effectiveCookie = cookieOverride ?? mmBlocksActionCookie;

    const blocks = useMemo(() => {
        if (blocksOverride) {
            return blocksOverride;
        }
        return translatePostProps(post.props as Record<string, unknown>, intl);
    }, [blocksOverride, post.props, intl]);

    const setFieldUploading = useCallback((fieldName: string, uploading: boolean) => {
        setUploadingFields((prev) => {
            if (uploading === prev.has(fieldName)) {
                return prev;
            }
            const next = new Set(prev);
            if (uploading) {
                next.add(fieldName);
            } else {
                next.delete(fieldName);
            }
            return next;
        });
    }, []);

    const hasUploadingFields = uploadingFields.size > 0;

    const applyClientFormValidation = useCallback((formValues: MmBlocksFormValues): boolean => {
        if (!blocks) {
            return true;
        }
        const validationErrors = validateMmBlocksFormValues(blocks, formValues);
        const names = Object.keys(validationErrors);
        if (names.length === 0) {
            setFieldErrors({});
            return true;
        }

        const nextErrors: MmBlocksFormErrors = {};
        for (const name of names) {
            const error = validationErrors[name];
            nextErrors[name] = intl.formatMessage({
                id: error.id,
                defaultMessage: error.defaultMessage,
            }, error.values);
        }
        setFieldErrors(nextErrors);
        setActionError(intl.formatMessage({
            id: 'apps.error.form.required_fields_empty',
            defaultMessage: 'Please fix all field errors',
        }));
        return false;
    }, [blocks, intl]);

    const handleAction = useCallback(async (actionId: string, selectedOption?: string, query?: Record<string, string>, attachmentCookie?: string, formValues?: MmBlocksFormValues) => {
        const actionFailedMessage = intl.formatMessage({
            id: 'post.message_attachment.action_failed',
            defaultMessage: 'Action failed to execute',
        });
        setActionError(null);

        const isSubmit = Boolean(formValues && blocks && isMmBlocksSubmitAction(blocks, actionId));
        if (isSubmit && formValues) {
            if (hasUploadingFields) {
                setActionError(intl.formatMessage({
                    id: 'interactive_dialog.files_uploading',
                    defaultMessage: 'Please wait for file uploads to finish',
                }));
                return;
            }
            if (!applyClientFormValidation(formValues)) {
                return;
            }
        } else {
            setFieldErrors({});
        }

        // Sequence field refreshes so a slow older response cannot overwrite a newer form.
        const isFieldRefresh = Boolean(formValues) && !isSubmit && !selectedOption;
        const requestId = isFieldRefresh ? ++refreshRequestIdRef.current : 0;

        try {
            if (integrationFormat === 'attachment') {
                const result = await dispatch(doPostActionWithCookie(
                    post.id,
                    actionId,
                    attachmentCookie ?? '',
                    selectedOption ?? '',
                    query,
                    integrationFormat,
                ));
                if (result.error) {
                    const message = typeof result.error.message === 'string' && result.error.message ? result.error.message : undefined;
                    setActionError(message ?? actionFailedMessage);
                    return;
                }
                setFieldErrors({});
                const goToLocation =
                    typeof result.data === 'object' &&
                    result.data !== null &&
                    'goto_location' in result.data &&
                    typeof result.data.goto_location === 'string' ? result.data.goto_location : undefined;
                if (goToLocation) {
                    applyIntegrationGotoLocation(goToLocation);
                }
                return;
            }

            const result = await dispatch(doBlockAction({
                subtype: 'execute',
                context: 'post',
                post_id: post.id,
                action_id: actionId,
                cookie: effectiveCookie,
                selected_option: selectedOption,
                query,
                form_values: formValues,
                integration_format: integrationFormat || undefined,
            }));

            if (result.error) {
                const message = typeof result.error.message === 'string' && result.error.message ? result.error.message : undefined;
                setActionError(message ?? actionFailedMessage);
                return;
            }

            const data = result.data as DoBlockActionResponse | undefined;
            const bodyError = topLevelErrorMessage(data);
            if (bodyError) {
                setActionError(bodyError);
                return;
            }

            if (data?.errors && Object.keys(data.errors).length > 0) {
                setFieldErrors(data.errors);
                return;
            }

            setFieldErrors({});

            if (data?.goto_location) {
                applyIntegrationGotoLocation(data.goto_location);
            }

            if (data?.type === 'dialog' && data.block_dialog) {
                openInteractiveDialog({
                    trigger_id: data.trigger_id,
                    block_dialog: data.block_dialog,
                });
                return;
            }

            if (data?.type === 'refresh' && Array.isArray(data.mm_blocks)) {
                if (isFieldRefresh && requestId !== refreshRequestIdRef.current) {
                    return;
                }
                setBlocksOverride(translateMMBlocks(data.mm_blocks));
                if (typeof data.mm_blocks_actions === 'string') {
                    setCookieOverride(data.mm_blocks_actions);
                }
                setBlocksEpoch((epoch) => epoch + 1);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : undefined;
            setActionError(message ?? actionFailedMessage);
        }
    }, [applyClientFormValidation, blocks, dispatch, effectiveCookie, hasUploadingFields, integrationFormat, intl, post.id]);

    const handleLookup: LookupHandler = useCallback(async (actionId, query, formValues) => {
        if (integrationFormat === 'attachment' || interactionsDisabled) {
            return [];
        }

        const result = await dispatch(doBlockAction({
            subtype: 'lookup',
            context: 'post',
            post_id: post.id,
            action_id: actionId,
            cookie: effectiveCookie,
            query: {query},
            form_values: formValues,
            integration_format: integrationFormat || undefined,
        }));

        const data = result.data as DoBlockActionResponse | undefined;
        if (data?.items) {
            return data.items;
        }
        return [];
    }, [dispatch, effectiveCookie, integrationFormat, interactionsDisabled, post.id]);

    if (!blocks || blocks.length === 0) {
        return null;
    }

    return (
        <>
            <MmBlocksFieldUploadingContext.Provider value={setFieldUploading}>
                <MmBlocksHasUploadingFieldsContext.Provider value={hasUploadingFields}>
                    <BlockRenderer
                        key={`${post.id}-${blocksEpoch}`}
                        blocks={blocks}
                        postId={post.id}
                        onAction={handleAction}
                        onLookup={handleLookup}
                        imagesMetadata={post.metadata?.images}
                        inlineMarkdownActions={{
                            mmBlocksActionCookie: effectiveCookie,
                            integrationFormat,
                        }}
                        interactionsDisabled={interactionsDisabled}
                        formErrors={fieldErrors}
                        onFormErrorsChange={setFieldErrors}
                    />
                </MmBlocksHasUploadingFieldsContext.Provider>
            </MmBlocksFieldUploadingContext.Provider>
            {actionError && (
                <div className='has-error'>
                    <label className='control-label'>{actionError}</label>
                </div>
            )}
        </>
    );
};

export default InteractiveMessages;
