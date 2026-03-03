// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import type {Post} from '@mattermost/types/posts';

import {getUser} from 'mattermost-redux/selectors/entities/users';

import {closeModal} from 'actions/views/modals';

import {ModalIdentifiers} from 'utils/constants';
import {getPageTitle} from 'utils/post_utils';

import type {GlobalState} from 'types/store';

import './conflict_warning_modal.scss';

type ConflictOption = 'review' | 'continue' | 'overwrite';

export type ConflictWarningModalProps = {
    currentPage: Post;
    onViewChanges: () => void;
    onContinueEditing: () => void;
    onOverwrite: () => void;
    onExited?: () => void;
};

export default function ConflictWarningModal({
    currentPage,
    onViewChanges,
    onContinueEditing,
    onOverwrite,
    onExited,
}: ConflictWarningModalProps) {
    const dispatch = useDispatch();
    const {formatMessage, formatDate, formatTime} = useIntl();
    const [selectedOption, setSelectedOption] = useState<ConflictOption>('review');
    const untitledText = formatMessage({id: 'wiki.untitled_page', defaultMessage: 'Untitled'});

    const lastModifiedUser = useSelector((state: GlobalState) => getUser(state, currentPage.user_id));
    const lastModifiedUsername = lastModifiedUser?.username || '';

    const handleClose = () => {
        dispatch(closeModal(ModalIdentifiers.PAGE_CONFLICT_WARNING));
        onContinueEditing();
    };

    const handleConfirm = () => {
        dispatch(closeModal(ModalIdentifiers.PAGE_CONFLICT_WARNING));
        switch (selectedOption) {
        case 'review':
            onViewChanges();
            break;
        case 'continue':
            onContinueEditing();
            break;
        case 'overwrite':
            onOverwrite();
            break;
        }
    };

    const getConfirmButtonText = (): string => {
        switch (selectedOption) {
        case 'review':
            return formatMessage({id: 'conflict_warning.review_changes', defaultMessage: 'Review changes'});
        case 'continue':
            return formatMessage({id: 'conflict_warning.continue_editing', defaultMessage: 'Continue editing'});
        case 'overwrite':
            return formatMessage({id: 'conflict_warning.overwrite_page', defaultMessage: 'Overwrite page'});
        default:
            return formatMessage({id: 'conflict_warning.review_changes', defaultMessage: 'Review changes'});
        }
    };

    const modalTitle = formatMessage({id: 'conflict_warning.title', defaultMessage: 'Page conflict'});

    const formattedDate = formatDate(currentPage.update_at, {month: 'short', day: 'numeric', year: 'numeric'});
    const formattedTime = formatTime(currentPage.update_at, {hour: 'numeric', minute: '2-digit'});

    return (
        <GenericModal
            className='conflict-warning-modal'
            dataTestId='conflict-warning-modal'
            ariaLabel={modalTitle}
            modalHeaderText={modalTitle}
            compassDesign={true}
            keyboardEscape={true}
            enforceFocus={false}
            handleConfirm={handleConfirm}
            handleCancel={handleClose}
            onExited={onExited}
            confirmButtonText={getConfirmButtonText()}
            cancelButtonText={formatMessage({id: 'conflict_warning.back_to_editing', defaultMessage: 'Back to editing'})}
            isDeleteModal={selectedOption === 'overwrite'}
            autoCloseOnConfirmButton={false}
            autoCloseOnCancelButton={false}
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
                    >
                        <div className='conflict-option-icon'>
                            <i className='icon icon-source-merge'/>
                        </div>
                        <div className='conflict-option-content'>
                            <span className='conflict-option-title'>
                                <FormattedMessage
                                    id='conflict_warning.option_review_title'
                                    defaultMessage='Review and merge changes'
                                />
                            </span>
                            <span className='conflict-option-description'>
                                <FormattedMessage
                                    id='conflict_warning.option_review_description'
                                    defaultMessage='Compare your draft with the published version'
                                />
                            </span>
                        </div>
                        {selectedOption === 'review' && (
                            <div className='conflict-option-check'>
                                <i className='icon icon-check'/>
                            </div>
                        )}
                    </button>
                    <button
                        className={`conflict-option ${selectedOption === 'continue' ? 'selected' : ''}`}
                        onClick={() => setSelectedOption('continue')}
                        type='button'
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
                        {selectedOption === 'continue' && (
                            <div className='conflict-option-check'>
                                <i className='icon icon-check'/>
                            </div>
                        )}
                    </button>
                    <button
                        className={`conflict-option danger ${selectedOption === 'overwrite' ? 'selected' : ''}`}
                        onClick={() => setSelectedOption('overwrite')}
                        type='button'
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
                        {selectedOption === 'overwrite' && (
                            <div className='conflict-option-check'>
                                <i className='icon icon-check'/>
                            </div>
                        )}
                    </button>
                </div>
            </div>
        </GenericModal>
    );
}
