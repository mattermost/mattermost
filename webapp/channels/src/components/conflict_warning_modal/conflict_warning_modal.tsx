// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import type {Page} from '@mattermost/types/wikis';

import {getUser} from 'mattermost-redux/selectors/entities/users';

import {closeModal} from 'actions/views/modals';

import {ModalIdentifiers} from 'utils/constants';
import {getPageTitle} from 'utils/page_utils';

import type {GlobalState} from 'types/store';

import './conflict_warning_modal.scss';

type ConflictOption = 'review' | 'continue' | 'overwrite';
type ModalState = 'option-select' | 'diff-view';

export type ConflictWarningModalProps = {
    currentPage: Page;
    draftContent: string | null;
    onContinueEditing: () => void;
    onOverwrite: () => void;
    onDiscard: () => Promise<void>;
    onExited?: () => void;
};

// Extracts paragraph-by-paragraph plain text from a TipTap JSON doc, falling back to the
// raw string if parsing fails. Empty input (string or doc with only empty paragraphs)
// returns []; callers rely on length === 0 to render the empty-state notice.
function extractParagraphs(input: string | null | undefined): string[] {
    if (input == null) {
        return [];
    }
    const trimmed = input.trim();
    if (trimmed === '') {
        return [];
    }
    try {
        const doc = JSON.parse(trimmed);
        if (doc && Array.isArray(doc.content)) {
            const out: string[] = [];
            const walk = (node: {type?: string; text?: string; content?: unknown[]}) => {
                if (!node) {
                    return;
                }
                if (node.type === 'paragraph' || node.type === 'heading') {
                    let text = '';
                    if (Array.isArray(node.content)) {
                        for (const child of node.content) {
                            const c = child as {text?: string};
                            if (typeof c.text === 'string') {
                                text += c.text;
                            }
                        }
                    }
                    out.push(text);
                    return;
                }
                if (Array.isArray(node.content)) {
                    for (const child of node.content) {
                        walk(child as {type?: string; text?: string; content?: unknown[]});
                    }
                }
            };
            for (const top of doc.content) {
                walk(top);
            }

            // Drop empty paragraphs — a TipTap doc with one empty paragraph
            // should be treated the same as an empty doc.
            const nonEmpty = out.filter((p) => p.length > 0);
            return nonEmpty;
        }
    } catch {
        // Not JSON; treat as a single paragraph.
    }
    return trimmed.split(/\n{2,}/).filter((p) => p.length > 0);
}

export default function ConflictWarningModal({
    currentPage,
    draftContent,
    onContinueEditing,
    onOverwrite,
    onDiscard,
    onExited,
}: ConflictWarningModalProps) {
    const dispatch = useDispatch();
    const {formatMessage, formatDate, formatTime} = useIntl();
    const [selectedOption, setSelectedOption] = useState<ConflictOption>('review');
    const [modalState, setModalState] = useState<ModalState>('option-select');
    const [isDiscarding, setIsDiscarding] = useState(false);
    const [discardError, setDiscardError] = useState<string | null>(null);
    const [identicalNoticeVisible, setIdenticalNoticeVisible] = useState(false);
    const untitledText = formatMessage({id: 'wiki.untitled_page', defaultMessage: 'Untitled'});

    const lastModifiedUser = useSelector((state: GlobalState) => getUser(state, currentPage.user_id));
    const lastModifiedUsername = lastModifiedUser?.username || '';

    const getConfirmButtonText = (): string => {
        switch (selectedOption) {
        case 'continue':
            return formatMessage({id: 'conflict_warning.continue_editing', defaultMessage: 'Continue editing'});
        case 'overwrite':
            return formatMessage({id: 'conflict_warning.overwrite_now', defaultMessage: 'Overwrite now'});
        case 'review':
            return formatMessage({id: 'conflict_warning.compare_versions', defaultMessage: 'Compare versions'});
        default:
            return '';
        }
    };

    const draftParagraphs = useMemo(() => extractParagraphs(draftContent), [draftContent]);
    const publishedParagraphs = useMemo(() => extractParagraphs(currentPage.body), [currentPage.body]);

    const isIdenticalContent = useMemo(() => {
        if (draftParagraphs.length !== publishedParagraphs.length) {
            return false;
        }
        for (let i = 0; i < draftParagraphs.length; i++) {
            if (draftParagraphs[i] !== publishedParagraphs[i]) {
                return false;
            }
        }
        return draftParagraphs.length > 0; // both empty → not "identical" content state
    }, [draftParagraphs, publishedParagraphs]);

    // Sets used to highlight paragraphs unique to each side of the diff.
    const publishedParagraphSet = useMemo(() => new Set(publishedParagraphs), [publishedParagraphs]);
    const draftParagraphSet = useMemo(() => new Set(draftParagraphs), [draftParagraphs]);

    useEffect(() => {
        if (identicalNoticeVisible) {
            const t = setTimeout(() => {
                dispatch(closeModal(ModalIdentifiers.PAGE_CONFLICT_WARNING));
            }, 2000);
            return () => clearTimeout(t);
        }
        return undefined;
    }, [identicalNoticeVisible, dispatch]);

    const handleConfirmOptionSelect = () => {
        switch (selectedOption) {
        case 'review':
            if (isIdenticalContent) {
                setIdenticalNoticeVisible(true);
                return;
            }
            setModalState('diff-view');
            return;
        case 'continue':
            dispatch(closeModal(ModalIdentifiers.PAGE_CONFLICT_WARNING));
            onContinueEditing();
            return;
        case 'overwrite':
            dispatch(closeModal(ModalIdentifiers.PAGE_CONFLICT_WARNING));
            onOverwrite();
        }
    };

    const handleDiscard = async () => {
        if (isDiscarding) {
            return;
        }
        setDiscardError(null);
        setIsDiscarding(true);
        try {
            await onDiscard();
            dispatch(closeModal(ModalIdentifiers.PAGE_CONFLICT_WARNING));
        } catch {
            setDiscardError(formatMessage({
                id: 'conflict_warning.discard_failed',
                defaultMessage: 'Failed to discard draft. Try again.',
            }));
            setIsDiscarding(false);
        }
    };

    const handleOverwriteInDiff = () => {
        if (isDiscarding) {
            return;
        }
        dispatch(closeModal(ModalIdentifiers.PAGE_CONFLICT_WARNING));
        onOverwrite();
    };

    const handleBackToDraft = () => {
        if (isDiscarding) {
            return;
        }
        dispatch(closeModal(ModalIdentifiers.PAGE_CONFLICT_WARNING));
        onContinueEditing();
    };

    const modalTitle = formatMessage({id: 'conflict_warning.title', defaultMessage: 'Page conflict'});

    const formattedDate = formatDate(currentPage.update_at, {month: 'short', day: 'numeric', year: 'numeric'});
    const formattedTime = formatTime(currentPage.update_at, {hour: 'numeric', minute: '2-digit'});

    if (modalState === 'diff-view') {
        return (
            <GenericModal
                className='conflict-warning-modal conflict-warning-modal--diff'
                dataTestId='conflict-warning-modal'
                ariaLabel={modalTitle}
                modalHeaderText={modalTitle}
                compassDesign={true}
                keyboardEscape={false}
                showCloseButton={false}
                enforceFocus={false}
                backdrop='static'
                onExited={onExited}
            >
                <div
                    className='conflict-warning-content conflict-warning-content--diff'
                    data-testid='conflict-diff-panel'
                >
                    {/* Back button rendered first so keyboard tab order is:
                        Back → left region → right region → keep/overwrite buttons.
                        CSS reorders it back to the bottom action row visually. */}
                    <button
                        type='button'
                        className='btn btn-tertiary conflict-warning-back-btn'
                        disabled={isDiscarding}
                        onClick={handleBackToDraft}
                    >
                        <FormattedMessage
                            id='conflict_warning.back_to_my_draft'
                            defaultMessage='Back to my draft'
                        />
                    </button>
                    <div className='conflict-warning-diff-panes'>
                        <section
                            role='region'
                            aria-label={formatMessage({id: 'conflict_warning.region_draft', defaultMessage: 'Your draft'})}
                            className='conflict-warning-diff-pane'
                            tabIndex={0}
                        >
                            <h4>
                                <FormattedMessage
                                    id='conflict_warning.region_draft'
                                    defaultMessage='Your draft'
                                />
                            </h4>
                            {draftContent === null && (
                                <p className='conflict-warning-pane-empty'>
                                    <FormattedMessage
                                        id='conflict_warning.draft_unavailable'
                                        defaultMessage='Unable to preview draft content.'
                                    />
                                </p>
                            )}
                            {draftContent !== null && draftParagraphs.length === 0 && (
                                <p className='conflict-warning-pane-empty'>
                                    <FormattedMessage
                                        id='conflict_warning.draft_empty'
                                        defaultMessage='Your draft has no content.'
                                    />
                                </p>
                            )}
                            {draftParagraphs.map((p, i) => {
                                const changed = !publishedParagraphSet.has(p);
                                return (
                                    <p
                                        key={`d-${i}`}
                                        className={changed ? 'paragraph-diff' : undefined}
                                        data-paragraph-changed={changed ? 'true' : 'false'}
                                    >
                                        {p}
                                    </p>
                                );
                            })}
                        </section>
                        <section
                            role='region'
                            aria-label={formatMessage({id: 'conflict_warning.region_published', defaultMessage: 'Published version'})}
                            className='conflict-warning-diff-pane'
                            tabIndex={0}
                        >
                            <h4>
                                <FormattedMessage
                                    id='conflict_warning.region_published'
                                    defaultMessage='Published version'
                                />
                            </h4>
                            {publishedParagraphs.length === 0 && (
                                <p className='conflict-warning-pane-empty'>
                                    <FormattedMessage
                                        id='conflict_warning.published_empty'
                                        defaultMessage='The published version has no content.'
                                    />
                                </p>
                            )}
                            {publishedParagraphs.map((p, i) => {
                                const changed = !draftParagraphSet.has(p);
                                return (
                                    <p
                                        key={`p-${i}`}
                                        className={changed ? 'paragraph-diff' : undefined}
                                        data-paragraph-changed={changed ? 'true' : 'false'}
                                    >
                                        {p}
                                    </p>
                                );
                            })}
                        </section>
                    </div>

                    {discardError && (
                        <p className='conflict-warning-error'>{discardError}</p>
                    )}

                    <div className='conflict-warning-actions'>
                        <button
                            type='button'
                            className='btn btn-secondary'
                            disabled={isDiscarding}
                            onClick={handleDiscard}
                        >
                            {isDiscarding ? (
                                <>
                                    <span
                                        role='progressbar'
                                        className='fa-spinner'
                                        aria-hidden='true'
                                    />
                                    <FormattedMessage
                                        id='conflict_warning.discarding'
                                        defaultMessage='Discarding…'
                                    />
                                </>
                            ) : (
                                <FormattedMessage
                                    id='conflict_warning.keep_published'
                                    defaultMessage='Keep published version'
                                />
                            )}
                        </button>
                        <button
                            type='button'
                            className='btn btn-danger'
                            disabled={isDiscarding}
                            onClick={handleOverwriteInDiff}
                        >
                            <FormattedMessage
                                id='conflict_warning.overwrite_published'
                                defaultMessage='Overwrite published version'
                            />
                        </button>
                    </div>
                    <div className='conflict-warning-action-subtitles'>
                        <FormattedMessage
                            id='conflict_warning.subtitle_overwrite'
                            defaultMessage='Your version replaces the published page'
                        />
                        <FormattedMessage
                            id='conflict_warning.subtitle_keep'
                            defaultMessage='The published version is kept; your draft is deleted'
                        />
                    </div>
                </div>
            </GenericModal>
        );
    }

    return (
        <GenericModal
            className='conflict-warning-modal'
            dataTestId='conflict-warning-modal'
            ariaLabel={modalTitle}
            modalHeaderText={modalTitle}
            compassDesign={true}
            keyboardEscape={false}
            showCloseButton={false}
            backdrop='static'
            enforceFocus={false}
            handleConfirm={handleConfirmOptionSelect}
            onExited={onExited}
            confirmButtonText={getConfirmButtonText()}
            confirmButtonVariant={selectedOption === 'overwrite' ? 'destructive' : undefined}
            autoCloseOnConfirmButton={false}
        >
            <div className='conflict-warning-content'>
                <p className='conflict-warning-description'>
                    <FormattedMessage
                        id='conflict_warning.description'
                        defaultMessage='Your changes are saved, but another team member updated this page while you were editing.'
                    />
                </p>
                <div className='conflict-warning-info'>
                    <div className='conflict-warning-info-row'>
                        <FormattedMessage
                            id='conflict_warning.page_label'
                            defaultMessage='Page:'
                        />
                        <span className='conflict-warning-info-value'>{getPageTitle(currentPage, untitledText)}</span>
                    </div>
                    <div className='conflict-warning-info-row'>
                        <FormattedMessage
                            id='conflict_warning.modified_label'
                            defaultMessage='Modified:'
                        />
                        <span className='conflict-warning-info-value'>
                            <FormattedMessage
                                id='conflict_warning.modified_by'
                                defaultMessage='by @{username} at {date} {time}'
                                values={{
                                    username: lastModifiedUsername,
                                    date: formattedDate,
                                    time: formattedTime,
                                }}
                            />
                        </span>
                    </div>
                </div>
                {identicalNoticeVisible && (
                    <p
                        className='conflict-warning-identical-notice'
                        role='status'
                    >
                        <FormattedMessage
                            id='conflict_warning.identical_content'
                            defaultMessage='Your draft matches the published version.'
                        />
                    </p>
                )}
                <p className='conflict-warning-question'>
                    <FormattedMessage
                        id='conflict_warning.how_to_handle'
                        defaultMessage='How would you like to handle the conflict?'
                    />
                </p>
                <div className='conflict-warning-options'>
                    <button
                        className={`conflict-option ${selectedOption === 'review' ? 'selected' : ''}`}
                        onClick={() => setSelectedOption('review')}
                        type='button'
                        aria-pressed={selectedOption === 'review'}
                    >
                        <div className='conflict-option-icon'>
                            <i className='icon icon-source-merge'/>
                        </div>
                        <div className='conflict-option-content'>
                            <span className='conflict-option-title'>
                                <FormattedMessage
                                    id='conflict_warning.option_review_title'
                                    defaultMessage='Compare versions'
                                />
                            </span>
                            <span className='conflict-option-description'>
                                <FormattedMessage
                                    id='conflict_warning.option_review_description'
                                    defaultMessage='Compare your draft with the published version'
                                />
                            </span>
                        </div>
                    </button>
                    <button
                        className={`conflict-option ${selectedOption === 'continue' ? 'selected' : ''}`}
                        onClick={() => setSelectedOption('continue')}
                        type='button'
                        aria-pressed={selectedOption === 'continue'}
                    >
                        <div className='conflict-option-icon'>
                            <i className='icon icon-pencil-outline'/>
                        </div>
                        <div className='conflict-option-content'>
                            <span className='conflict-option-title'>
                                <FormattedMessage
                                    id='conflict_warning.option_continue_title'
                                    defaultMessage='Continue editing my draft'
                                />
                            </span>
                            <span className='conflict-option-description'>
                                <FormattedMessage
                                    id='conflict_warning.option_continue_description'
                                    defaultMessage='Keep editing, and manually combine changes in the editor'
                                />
                            </span>
                        </div>
                    </button>
                    <button
                        className={`conflict-option danger ${selectedOption === 'overwrite' ? 'selected' : ''}`}
                        onClick={() => setSelectedOption('overwrite')}
                        type='button'
                        aria-pressed={selectedOption === 'overwrite'}
                    >
                        <div className='conflict-option-icon'>
                            <i className='icon icon-file-replace-outline'/>
                        </div>
                        <div className='conflict-option-content'>
                            <span className='conflict-option-title'>
                                <FormattedMessage
                                    id='conflict_warning.option_overwrite_title'
                                    defaultMessage='Overwrite published version'
                                />
                            </span>
                            <span className='conflict-option-description'>
                                <FormattedMessage
                                    id='conflict_warning.option_overwrite_description'
                                    defaultMessage='Replace the page with your version. Their changes will be lost.'
                                />
                            </span>
                        </div>
                    </button>
                </div>
            </div>
        </GenericModal>
    );
}
