// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {CheckCircleOutlineIcon} from '@mattermost/compass-icons/components';
import {GenericModal} from '@mattermost/components';

import './image_extraction_complete_dialog.scss';

export type ImageExtractionCompleteDialogProps = {
    show: boolean;
    actionType: 'extract_handwriting' | 'describe_image';
    pageTitle: string;
    onGoToDraft: () => void;
    onStayHere: () => void;
    onInsertContent?: () => void;
};

/**
 * Dialog shown when image AI extraction is complete.
 * Allows user to navigate to the new draft page or stay on current page.
 */
const ImageExtractionCompleteDialog = ({
    show,
    actionType,
    pageTitle,
    onGoToDraft,
    onStayHere,
    onInsertContent,
}: ImageExtractionCompleteDialogProps) => {
    const {formatMessage} = useIntl();

    if (!show) {
        return null;
    }

    const isHandwriting = actionType === 'extract_handwriting';

    const getTitle = () => {
        if (isHandwriting) {
            return formatMessage({id: 'image_extraction_complete.title_handwriting', defaultMessage: 'Text Extracted'});
        }
        return formatMessage({id: 'image_extraction_complete.title_describe', defaultMessage: 'Image Described'});
    };

    const getDescription = () => {
        if (isHandwriting) {
            return formatMessage({
                id: 'image_extraction_complete.description_handwriting',
                defaultMessage: 'The text has been extracted. Insert it at the current cursor position or discard.',
            });
        }
        return formatMessage(
            {
                id: 'image_extraction_complete.description_describe',
                defaultMessage: 'The image description has been saved as a new draft page: "{pageTitle}"',
            },
            {pageTitle},
        );
    };

    const handleConfirm = isHandwriting ? (onInsertContent ?? onGoToDraft) : onGoToDraft;
    const confirmText = isHandwriting ?
        formatMessage({id: 'image_extraction_complete.insert_content', defaultMessage: 'Insert into page'}) :
        formatMessage({id: 'image_extraction_complete.go_to_draft', defaultMessage: 'Go to draft'});

    return (
        <GenericModal
            id='image-extraction-complete-dialog'
            className='image-extraction-complete-dialog'
            compassDesign={true}
            modalHeaderText={getTitle()}
            show={show}
            onExited={() => {}}
            handleCancel={onStayHere}
            handleConfirm={handleConfirm}
            confirmButtonText={confirmText}
            cancelButtonText={formatMessage({id: 'image_extraction_complete.stay_here', defaultMessage: 'Stay here'})}
        >
            <div className='image-extraction-complete-dialog-content'>
                <div className='image-extraction-complete-dialog-icon'>
                    <CheckCircleOutlineIcon size={32}/>
                </div>
                <p className='image-extraction-complete-dialog-description'>
                    {getDescription()}
                </p>
            </div>
        </GenericModal>
    );
};

export default ImageExtractionCompleteDialog;
