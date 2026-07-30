// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {useIsStackedModal, useStackedModal} from '@mattermost/components';
import {Button} from '@mattermost/shared/components/button';
import type {AppFormValues} from '@mattermost/types/apps';
import type {DoBlockActionResponse} from '@mattermost/types/integration_actions';
import type {BlockDialog, BlockDialogButton, DialogElement, DialogSubmission, SubmitDialogResponse} from '@mattermost/types/integrations';
import type {MmBlock} from '@mattermost/types/mm_blocks';

import {doBlockAction} from 'mattermost-redux/actions/posts';
import type {ActionResult} from 'mattermost-redux/types/actions';

import {executeDialogAction} from 'actions/integration_actions';

import {BlockRenderer} from 'components/block_renderer';
import {MmBlocksFieldUploadingContext, MmBlocksHasUploadingFieldsContext, MmBlocksInModalContext} from 'components/block_renderer/context';
import {MmBlocksForm, useMmBlocksForm} from 'components/block_renderer/form';
import type {MmBlocksFormErrors, MmBlocksFormValues} from 'components/block_renderer/form';
import {isMmBlocksSubmitAction, validateMmBlocksFormValues} from 'components/block_renderer/form_validation';
import {translateMMBlocks} from 'components/block_renderer/translation/mm_block';
import type {ActionHandler, LookupHandler} from 'components/block_renderer/types';
import Markdown from 'components/markdown';

import {openInteractiveDialog} from 'plugins/interactive_dialog';
import {convertAppFormValuesToDialogSubmission, transformServerDialogToProps} from 'utils/dialog_conversion';
import {convertDialogToMmBlocks, dialogShouldShowSubmitChrome, DIALOG_SUBMIT_ACTION_ID} from 'utils/dialog_to_mm_blocks';
import {applyIntegrationGotoLocation} from 'utils/integration_navigation';

export type BlocksDialogShellMode = 'legacy' | 'native';

export type BlocksDialogShellProps = {
    mode: BlocksDialogShellMode;

    // Shared chrome (from Dialog or BlockDialog)
    title?: string;
    iconUrl?: string;
    notifyOnCancel?: boolean;
    state?: string;
    onExited?: () => void;

    // Legacy Interactive Dialog
    url?: string;
    callbackId?: string;
    elements?: DialogElement[];
    introductionText?: string;
    submitLabel?: string;
    sourceUrl?: string;
    actions?: {
        submitInteractiveDialog: (submission: DialogSubmission) => Promise<ActionResult<SubmitDialogResponse>>;
        lookupInteractiveDialog: (submission: DialogSubmission) => Promise<ActionResult<{items: Array<{text: string; value: string}>}>>;
    };

    // Native block_dialog
    mmBlocks?: unknown[];
    mmBlocksActions?: string;
    blockSubmit?: BlockDialogButton;
    blockCancel?: BlockDialogButton;
};

function integrationErrorMessage(data: {error?: string} | undefined): string | null {
    if (!data) {
        return null;
    }
    if (typeof data.error === 'string' && data.error) {
        return data.error;
    }
    return null;
}

function isValidLookupURL(url: string): boolean {
    if (!url) {
        return false;
    }
    if (url.startsWith('https://')) {
        return true;
    }
    if (url.startsWith('http://')) {
        try {
            const parsedURL = new URL(url);
            return parsedURL.hostname === 'localhost' || parsedURL.hostname === '127.0.0.1';
        } catch {
            return false;
        }
    }
    if (url.startsWith('/plugins/')) {
        return !url.includes('..') && !url.includes('//');
    }
    return false;
}

type NativeFooterProps = {
    blockSubmit?: BlockDialogButton;
    blockCancel?: BlockDialogButton;
    onSubmit: (formValues: MmBlocksFormValues) => void;
    onCancel: () => void;
    submitDisabled?: boolean;
};

/** Stable empty cancel chrome for legacy footers (avoids a new {} each render). */
const LEGACY_BLOCK_CANCEL: BlockDialogButton = {};

function NativeDialogFooter({blockSubmit, blockCancel, onSubmit, onCancel, submitDisabled}: NativeFooterProps) {
    const {values} = useMmBlocksForm();

    const handleSubmitClick = useCallback(() => {
        if (submitDisabled) {
            return;
        }
        onSubmit(values);
    }, [onSubmit, submitDisabled, values]);

    if (!blockSubmit && !blockCancel) {
        return null;
    }

    return (
        <Modal.Footer>
            {blockCancel && (
                <Button
                    id='appsModalCancel'
                    type='button'
                    emphasis='tertiary'
                    onClick={onCancel}
                >
                    {blockCancel.label || (
                        <FormattedMessage
                            id='interactive_dialog.cancel'
                            defaultMessage='Cancel'
                        />
                    )}
                </Button>
            )}
            {blockSubmit && (
                <Button
                    id='appsModalSubmit'
                    type='button'
                    emphasis='primary'
                    disabled={submitDisabled}
                    onClick={handleSubmitClick}
                >
                    {blockSubmit.label || (
                        <FormattedMessage
                            id='interactive_dialog.submit'
                            defaultMessage='Submit'
                        />
                    )}
                </Button>
            )}
        </Modal.Footer>
    );
}

function collectDialogFileIds(
    submission: Record<string, unknown>,
    dialogElements: DialogElement[] | undefined,
): string[] {
    const fileIds: string[] = [];
    dialogElements?.forEach((elem) => {
        if (elem.type !== 'file' || !submission[elem.name]) {
            return;
        }
        fileIds.push(...String(submission[elem.name]).split(',').filter(Boolean));
    });
    return fileIds;
}

const BlocksDialogShell = ({
    mode,
    title: initialTitle,
    iconUrl: initialIconUrl,
    onExited,
    url,
    callbackId,
    elements: initialElements,
    introductionText: initialIntroductionText,
    submitLabel: initialSubmitLabel,
    notifyOnCancel: initialNotifyOnCancel,
    state: dialogState,
    sourceUrl,
    actions,
    mmBlocks: initialMmBlocks,
    mmBlocksActions: initialCookie,
    blockSubmit: initialBlockSubmit,
    blockCancel: initialBlockCancel,
}: BlocksDialogShellProps) => {
    const intl = useIntl();
    const dispatch = useDispatch();
    const [show, setShow] = useState(true);

    // Capture at mount: if a backdrop already exists, this dialog is opening
    // above another modal and must raise its own backdrop above that parent.
    const isStacked = useIsStackedModal();
    const {shouldRenderBackdrop, modalStyle, backdropStyle} = useStackedModal(isStacked, show);

    const [actionError, setActionError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<MmBlocksFormErrors>({});
    const [uploadingFields, setUploadingFields] = useState<Set<string>>(() => new Set());
    const [isSubmitting, setIsSubmitting] = useState(false);
    const refreshRequestIdRef = useRef(0);
    const [elements, setElements] = useState(initialElements);
    const [introductionText, setIntroductionText] = useState(initialIntroductionText);
    const [submitLabel, setSubmitLabel] = useState(initialSubmitLabel);
    const [title, setTitle] = useState(initialTitle);
    const [iconUrl, setIconUrl] = useState(initialIconUrl);
    const [notifyOnCancel, setNotifyOnCancel] = useState(initialNotifyOnCancel);
    const [blockSubmit, setBlockSubmit] = useState(initialBlockSubmit);
    const [blockCancel, setBlockCancel] = useState(initialBlockCancel);
    const [dialogStateValue, setDialogStateValue] = useState(dialogState);
    const [sourceUrlValue, setSourceUrlValue] = useState(sourceUrl);
    const [blocksOverride, setBlocksOverride] = useState<MmBlock[] | null>(null);
    const [cookieOverride, setCookieOverride] = useState<string | undefined>(undefined);
    const [blocksEpoch, setBlocksEpoch] = useState(0);

    useEffect(() => {
        setElements(initialElements);
        setIntroductionText(initialIntroductionText);
        setSubmitLabel(initialSubmitLabel);
        setDialogStateValue(dialogState);
        setSourceUrlValue(sourceUrl);
    }, [initialElements, initialIntroductionText, initialSubmitLabel, dialogState, sourceUrl]);

    useEffect(() => {
        setTitle(initialTitle);
        setIconUrl(initialIconUrl);
        setNotifyOnCancel(initialNotifyOnCancel);
        setBlockSubmit(initialBlockSubmit);
        setBlockCancel(initialBlockCancel);
        setBlocksOverride(null);
        setCookieOverride(undefined);
        setBlocksEpoch(0);
        setActionError(null);
        setFieldErrors({});
        setIsSubmitting(false);
        refreshRequestIdRef.current = 0;
    }, [initialMmBlocks, initialCookie, initialTitle, initialIconUrl, initialNotifyOnCancel, initialBlockSubmit, initialBlockCancel]);

    const effectiveCookie = cookieOverride ?? (typeof initialCookie === 'string' ? initialCookie : undefined);

    const blocks = useMemo((): MmBlock[] => {
        if (blocksOverride) {
            return blocksOverride;
        }
        if (mode === 'native' && initialMmBlocks) {
            return translateMMBlocks(initialMmBlocks);
        }
        const {blocks: converted} = convertDialogToMmBlocks(elements, introductionText);
        return converted;
    }, [blocksOverride, mode, initialMmBlocks, elements, introductionText]);

    const closeModal = useCallback(() => {
        setShow(false);
    }, []);

    const handleExited = useCallback(() => {
        onExited?.();
    }, [onExited]);

    const applyLegacyFormResponse = useCallback((form: NonNullable<SubmitDialogResponse['form']>) => {
        const props = transformServerDialogToProps(form);
        setElements(props.elements);
        setIntroductionText(props.introductionText);
        setSubmitLabel(props.submitLabel);

        // Refresh/multistep responses often omit source_url and state; keep prior values
        // so subsequent field refreshes still hit the original source endpoint.
        if (props.state !== undefined) {
            setDialogStateValue(props.state);
        }
        if (props.sourceUrl) {
            setSourceUrlValue(props.sourceUrl);
        }
        if (props.title) {
            setTitle(props.title);
        }
        if (props.iconUrl) {
            setIconUrl(props.iconUrl);
        }
        if (props.notifyOnCancel !== undefined) {
            setNotifyOnCancel(props.notifyOnCancel);
        }
        setBlocksOverride(null);
        setBlocksEpoch((epoch) => epoch + 1);
        setActionError(null);
        setFieldErrors({});
    }, []);

    const applyBlockDialogResponse = useCallback((dialog: BlockDialog) => {
        setTitle(dialog.title);
        setIconUrl(dialog.icon_url);
        setDialogStateValue(dialog.state);

        // Full replace: missing submit/cancel clears footer chrome.
        setBlockSubmit(dialog.submit);
        setBlockCancel(dialog.cancel);
        setBlocksOverride(translateMMBlocks(dialog.blocks || []));
        if (typeof dialog.actions === 'string') {
            setCookieOverride(dialog.actions);
        }
        setBlocksEpoch((epoch) => epoch + 1);
        setActionError(null);
        setFieldErrors({});
    }, []);

    const applyClientFormValidation = useCallback((formValues: MmBlocksFormValues): boolean => {
        const validationErrors = validateMmBlocksFormValues(blocks, formValues);
        const names = Object.keys(validationErrors);
        if (names.length === 0) {
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

    const handleLegacySubmit = useCallback(async (formValues: MmBlocksFormValues, cancelled = false) => {
        if (!actions?.submitInteractiveDialog || isSubmitting) {
            return;
        }

        // Block submit while uploads are still in progress so file IDs are in form values.
        if (!cancelled && hasUploadingFields) {
            setActionError(intl.formatMessage({
                id: 'interactive_dialog.files_uploading',
                defaultMessage: 'Please wait for file uploads to finish',
            }));
            return;
        }

        if (!cancelled && !applyClientFormValidation(formValues)) {
            return;
        }

        setIsSubmitting(true);
        try {
            // Match Apps Form behavior: bools stay booleans, numbers stay numbers, etc.
            const {submission: convertedSubmission} = convertAppFormValuesToDialogSubmission(
                formValues as AppFormValues,
                elements,
                {enhanced: false},
            );

            const fileIds = collectDialogFileIds(convertedSubmission, elements);

            const submission: DialogSubmission = {
                url: url || '',
                callback_id: callbackId || '',
                state: dialogStateValue || '',
                submission: convertedSubmission as DialogSubmission['submission'],
                user_id: '',
                channel_id: '', // Populated by submitInteractiveDialog action
                team_id: '',
                cancelled,
                ...(fileIds.length > 0 && {file_ids: fileIds}),
            };
            const result = await actions.submitInteractiveDialog(submission);
            if (result.error) {
                setActionError(result.error.message || intl.formatMessage({
                    id: 'interactive_dialog.submit_failed',
                    defaultMessage: 'Submission failed',
                }));
                return;
            }
            const bodyError = integrationErrorMessage(result.data);
            const responseErrors = result.data?.errors;
            if (responseErrors && Object.keys(responseErrors).length > 0) {
                setFieldErrors(responseErrors);
                setActionError(bodyError);
                return;
            }
            if (bodyError) {
                setActionError(bodyError);
                return;
            }
            if (result.data?.type === 'form' && result.data.form) {
                applyLegacyFormResponse(result.data.form);
                setActionError(null);
                return;
            }
            setActionError(null);
            setFieldErrors({});
            closeModal();
        } finally {
            setIsSubmitting(false);
        }
    }, [actions, applyClientFormValidation, applyLegacyFormResponse, callbackId, closeModal, dialogStateValue, elements, hasUploadingFields, intl, isSubmitting, url]);

    const handleLegacyRefresh = useCallback(async (fieldName: string, formValues: MmBlocksFormValues) => {
        if (!actions?.submitInteractiveDialog || !sourceUrlValue) {
            return;
        }
        const requestId = ++refreshRequestIdRef.current;
        const {submission: convertedSubmission} = convertAppFormValuesToDialogSubmission(
            formValues as AppFormValues,
            elements,
            {enhanced: false},
        );
        const submission: DialogSubmission = {
            url: sourceUrlValue,
            callback_id: callbackId || '',
            state: dialogStateValue || '',
            submission: {...convertedSubmission, selected_field: fieldName},
            user_id: '',
            channel_id: '', // Populated by submitInteractiveDialog action
            team_id: '',
            cancelled: false,
            type: 'refresh',
        };
        const result = await actions.submitInteractiveDialog(submission);
        if (requestId !== refreshRequestIdRef.current) {
            return;
        }
        if (result.error) {
            setActionError(result.error.message || intl.formatMessage({
                id: 'interactive_dialog.refresh_failed',
                defaultMessage: 'Field refresh failed',
            }));
            return;
        }
        const bodyError = integrationErrorMessage(result.data);
        if (bodyError) {
            setActionError(bodyError);
            return;
        }
        if (result.data?.type === 'form' && result.data.form) {
            applyLegacyFormResponse(result.data.form);
        }
        setActionError(null);
    }, [actions, applyLegacyFormResponse, callbackId, dialogStateValue, elements, intl, sourceUrlValue]);

    const handleNativeAction = useCallback(async (
        actionId: string,
        selectedOption?: string,
        query?: Record<string, string>,
        _attachmentCookie?: string,
        formValues?: MmBlocksFormValues,
    ) => {
        const actionFailedMessage = intl.formatMessage({
            id: 'post.message_attachment.action_failed',
            defaultMessage: 'Action failed to execute',
        });

        const isSubmit = Boolean(
            formValues && (
                (blockSubmit?.action && actionId === blockSubmit.action) ||
                isMmBlocksSubmitAction(blocks, actionId)
            ),
        );
        if (isSubmit) {
            if (isSubmitting) {
                return;
            }
            if (hasUploadingFields) {
                setActionError(intl.formatMessage({
                    id: 'interactive_dialog.files_uploading',
                    defaultMessage: 'Please wait for file uploads to finish',
                }));
                return;
            }
            if (formValues && !applyClientFormValidation(formValues)) {
                return;
            }
            setIsSubmitting(true);
        }

        const isFieldRefresh = Boolean(formValues) && !isSubmit && !selectedOption;
        const requestId = isFieldRefresh ? ++refreshRequestIdRef.current : 0;

        setActionError(null);
        if (!isSubmit) {
            setFieldErrors({});
        }

        try {
            const result = await dispatch(doBlockAction({
                subtype: 'execute',
                context: 'dialog',
                post_id: '',
                action_id: actionId,
                cookie: effectiveCookie,
                selected_option: selectedOption,
                query,
                form_values: formValues,
                integration_format: 'mm_block',
            }));

            if (isFieldRefresh && requestId !== refreshRequestIdRef.current) {
                return;
            }

            if (result.error) {
                setActionError(typeof result.error.message === 'string' && result.error.message ? result.error.message : actionFailedMessage);
                return;
            }

            const data = result.data as DoBlockActionResponse | undefined;
            const bodyError = integrationErrorMessage(data);
            if (data?.errors && Object.keys(data.errors).length > 0) {
                setFieldErrors(data.errors);
                setActionError(bodyError);
                return;
            }
            if (bodyError) {
                setActionError(bodyError);
                return;
            }

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

            if (data?.type === 'refresh' && data.block_dialog) {
                applyBlockDialogResponse(data.block_dialog);
                return;
            }

            // Successful execute without dialog refresh closes the dialog,
            // unless the integration asked to keep it open (e.g. child stacked via dialogs/open).
            if (data?.keep_dialog_open) {
                return;
            }
            if (!data?.type || data.type === 'ok' || data.goto_location) {
                closeModal();
            }
        } finally {
            if (isSubmit) {
                setIsSubmitting(false);
            }
        }
    }, [applyBlockDialogResponse, applyClientFormValidation, blockSubmit?.action, blocks, closeModal, dispatch, effectiveCookie, hasUploadingFields, intl, isSubmitting]);

    const handleAction: ActionHandler = useCallback(async (
        actionId: string,
        selectedOption?: string,
        query?: Record<string, string>,
        attachmentCookie?: string,
        formValues?: MmBlocksFormValues,
    ) => {
        if (mode === 'native') {
            await handleNativeAction(actionId, selectedOption, query, attachmentCookie, formValues);
            return;
        }

        // Legacy action_button elements are converted to mm_block buttons whose query
        // carries __dialog_action_button / __dialog_action_url (plus any integration
        // context). BlockRenderer only knows onAction(actionId, …, query), so these
        // private keys mark "call executeDialogAction(url, context)" instead of submit
        // or field refresh. The __ prefix avoids colliding with real context keys.
        if (query?.__dialog_action_button === '1') { // eslint-disable-line no-underscore-dangle
            const actionUrl = query.__dialog_action_url || ''; // eslint-disable-line no-underscore-dangle
            const context = {...query};
            delete context.__dialog_action_button; // eslint-disable-line no-underscore-dangle
            delete context.__dialog_action_url; // eslint-disable-line no-underscore-dangle
            const result = await dispatch(executeDialogAction(actionUrl, context));
            if (result.error) {
                setActionError(intl.formatMessage({
                    id: 'interactive_dialog.action_button.error',
                    defaultMessage: 'Action failed',
                }));
            }
            return;
        }

        // Field refresh (onChange action id = element name)
        if (formValues && actionId !== DIALOG_SUBMIT_ACTION_ID && !selectedOption) {
            const isRefreshField = elements?.some((el) => el.name === actionId && el.refresh);
            if (isRefreshField) {
                await handleLegacyRefresh(actionId, formValues);
                return;
            }
        }

        if (actionId === DIALOG_SUBMIT_ACTION_ID) {
            await handleLegacySubmit(formValues || {});
            return;
        }

        // Non-submit execute with form values still submits (defensive)
        if (formValues) {
            await handleLegacySubmit(formValues);
        }
    }, [dispatch, elements, handleLegacyRefresh, handleLegacySubmit, handleNativeAction, intl, mode]);

    const handleLookup: LookupHandler = useCallback(async (actionId, query, formValues) => {
        if (mode === 'native') {
            const result = await dispatch(doBlockAction({
                subtype: 'lookup',
                context: 'dialog',
                post_id: '',
                action_id: actionId,
                cookie: effectiveCookie,
                query: {query},
                form_values: formValues,
                integration_format: 'mm_block',
            }));
            const data = result.data as DoBlockActionResponse | undefined;
            if (data?.items) {
                return data.items;
            }
            return [];
        }

        if (!actions?.lookupInteractiveDialog) {
            return [];
        }

        const element = elements?.find((el) => el.name === actionId);
        const lookupPath = element?.data_source_url || url || '';
        if (!isValidLookupURL(lookupPath)) {
            return [];
        }

        const {submission: convertedSubmission} = convertAppFormValuesToDialogSubmission(
            (formValues || {}) as AppFormValues,
            elements,
            {enhanced: false},
        );

        const submission: DialogSubmission = {
            url: lookupPath,
            callback_id: callbackId || '',
            state: dialogStateValue || '',
            submission: {
                ...convertedSubmission,
                query,
                selected_field: actionId,
            },
            user_id: '',
            channel_id: '', // Populated by lookupInteractiveDialog action
            team_id: '',
            cancelled: false,
        };

        const result = await actions.lookupInteractiveDialog(submission);
        return result.data?.items || [];
    }, [actions, callbackId, dialogStateValue, dispatch, effectiveCookie, elements, mode, url]);

    const handleNativeCancel = useCallback(async () => {
        if (isSubmitting) {
            return;
        }
        if (blockCancel?.action) {
            await handleNativeAction(blockCancel.action);
            return;
        }
        closeModal();
    }, [blockCancel, closeModal, handleNativeAction, isSubmitting]);

    const handleNativeSubmit = useCallback(async (formValues: MmBlocksFormValues) => {
        if (blockSubmit?.action) {
            await handleNativeAction(blockSubmit.action, undefined, undefined, undefined, formValues);
            return;
        }
        if (isSubmitting) {
            return;
        }
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
        closeModal();
    }, [applyClientFormValidation, blockSubmit, closeModal, handleNativeAction, hasUploadingFields, intl, isSubmitting]);

    const onHide = useCallback(async () => {
        if (mode === 'legacy' && notifyOnCancel && actions?.submitInteractiveDialog) {
            await handleLegacySubmit({}, true);
            return;
        }
        if (mode === 'native') {
            await handleNativeCancel();
            return;
        }
        closeModal();
    }, [actions, closeModal, handleLegacySubmit, handleNativeCancel, mode, notifyOnCancel]);

    const onSubmit = useCallback(async (formValues: MmBlocksFormValues) => {
        if (mode === 'native') {
            await handleNativeSubmit(formValues);
            return;
        }
        await handleLegacySubmit(formValues);
    }, [handleLegacySubmit, handleNativeSubmit, mode]);

    const headerIcon = iconUrl ? (
        <img
            id='appsModalIconUrl'
            alt=''
            src={iconUrl}
            style={{height: '28px', width: '28px', marginRight: '8px'}}
        />
    ) : null;

    const body = (
        <Modal.Body>
            <BlockRenderer
                key={`dialog-blocks-${blocksEpoch}`}
                blocks={blocks}
                postId=''
                onAction={handleAction}
                onLookup={handleLookup}
                provideForm={false}
                formErrors={fieldErrors}
                onFormErrorsChange={setFieldErrors}
                inlineMarkdownActions={mode === 'native' ? {
                    mmBlocksActionCookie: effectiveCookie,
                    integrationFormat: 'mm_block',
                } : undefined}
            />
            {actionError && (
                <div className='has-error'>
                    <label className='control-label'>{actionError}</label>
                </div>
            )}
        </Modal.Body>
    );

    const showLegacySubmit = dialogShouldShowSubmitChrome(elements, submitLabel);
    const legacyBlockSubmit = showLegacySubmit ? {
        action: DIALOG_SUBMIT_ACTION_ID,
        label: submitLabel,
    } : undefined;

    return (
        <Modal
            id='appsModal'
            dialogClassName='a11y__modal about-modal'
            show={show}
            onHide={onHide}
            onExited={handleExited}
            backdrop={shouldRenderBackdrop ? 'static' : false}
            backdropStyle={backdropStyle}
            style={modalStyle}
            role='none'
            aria-labelledby='appsModalLabel'
        >
            <Modal.Header closeButton={true}>
                <Modal.Title
                    componentClass='h1'
                    id='appsModalLabel'
                >
                    {headerIcon}
                    <Markdown message={title || ''}/>
                </Modal.Title>
            </Modal.Header>
            <MmBlocksForm
                key={`dialog-form-${blocksEpoch}`}
                errors={fieldErrors}
                onErrorsChange={setFieldErrors}
            >
                <MmBlocksInModalContext.Provider value={true}>
                    <MmBlocksFieldUploadingContext.Provider value={setFieldUploading}>
                        <MmBlocksHasUploadingFieldsContext.Provider value={hasUploadingFields}>
                            {body}
                            {mode === 'native' ? (
                                <NativeDialogFooter
                                    blockSubmit={blockSubmit}
                                    blockCancel={blockCancel}
                                    onSubmit={onSubmit}
                                    onCancel={onHide}
                                    submitDisabled={hasUploadingFields || isSubmitting}
                                />
                            ) : (
                                <NativeDialogFooter
                                    blockSubmit={legacyBlockSubmit}
                                    blockCancel={LEGACY_BLOCK_CANCEL}
                                    onSubmit={onSubmit}
                                    onCancel={onHide}
                                    submitDisabled={hasUploadingFields || isSubmitting}
                                />
                            )}
                        </MmBlocksHasUploadingFieldsContext.Provider>
                    </MmBlocksFieldUploadingContext.Provider>
                </MmBlocksInModalContext.Provider>
            </MmBlocksForm>
        </Modal>
    );
};

export default BlocksDialogShell;
