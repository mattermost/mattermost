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
}: ImageExtractionCompleteDialogProps) => {
    const {formatMessage} = useIntl();

    if (!show) {
        return null;
    }

    const getTitle = () => {
        if (actionType === 'extract_handwriting') {
            return formatMessage({id: 'image_extraction_complete.title_handwriting', defaultMessage: 'Handwriting Extracted'});
        }
        return formatMessage({id: 'image_extraction_complete.title_describe', defaultMessage: 'Image Described'});
    };

    const getDescription = () => {
        if (actionType === 'extract_handwriting') {
            return formatMessage(
                {
                    id: 'image_extraction_complete.description_handwriting',
                    defaultMessage: 'The handwritten text has been extracted and saved as a new draft page: "{pageTitle}"',
                },
                {pageTitle},
            );
        }
        return formatMessage(
            {
                id: 'image_extraction_complete.description_describe',
                defaultMessage: 'The image description has been saved as a new draft page: "{pageTitle}"',
            },
            {pageTitle},
        );
    };

    return (
        <GenericModal
            id='image-extraction-complete-dialog'
            className='image-extraction-complete-dialog'
            modalHeaderText={getTitle()}
            show={show}
            onExited={() => {}}
            handleCancel={onStayHere}
            handleConfirm={onGoToDraft}
            confirmButtonText={formatMessage({id: 'image_extraction_complete.go_to_draft', defaultMessage: 'Go to draft'})}
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
