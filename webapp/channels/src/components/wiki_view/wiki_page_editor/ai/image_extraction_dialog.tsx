// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {GenericModal} from '@mattermost/components';

import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import './image_extraction_dialog.scss';

export type ImageExtractionDialogProps = {
    show: boolean;
    actionType: 'extract_handwriting' | 'describe_image';
    onCancel: () => void;
    progress?: string;
};

/**
 * Dialog shown during image AI extraction/analysis.
 * Shows progress and allows user to cancel the operation.
 */
const ImageExtractionDialog = ({
    show,
    actionType,
    onCancel,
    progress,
}: ImageExtractionDialogProps) => {
    const {formatMessage} = useIntl();

    if (!show) {
        return null;
    }

    const getTitle = () => {
        if (actionType === 'extract_handwriting') {
            return formatMessage({id: 'image_extraction.title_handwriting', defaultMessage: 'Extracting Handwriting'});
        }
        return formatMessage({id: 'image_extraction.title_describe', defaultMessage: 'Analyzing Image'});
    };

    const getDescription = () => {
        if (actionType === 'extract_handwriting') {
            return formatMessage({
                id: 'image_extraction.description_handwriting',
                defaultMessage: 'AI is analyzing the image and extracting handwritten text...',
            });
        }
        return formatMessage({
            id: 'image_extraction.description_describe',
            defaultMessage: 'AI is analyzing the image and generating a description...',
        });
    };

    return (
        <GenericModal
            id='image-extraction-dialog'
            className='image-extraction-dialog'
            modalHeaderText={getTitle()}
            show={show}
            onExited={() => {}}
            handleCancel={onCancel}
            handleConfirm={onCancel}
            confirmButtonText={formatMessage({id: 'image_extraction.cancel', defaultMessage: 'Cancel'})}
            confirmButtonClassName='btn-tertiary'
            autoCloseOnConfirmButton={false}
        >
            <div className='image-extraction-dialog-content'>
                <div className='image-extraction-dialog-spinner'>
                    <LoadingSpinner style={{fontSize: '32px'}}/>
                </div>
                <p className='image-extraction-dialog-description'>
                    {getDescription()}
                </p>
                {progress && (
                    <p className='image-extraction-dialog-progress'>
                        {progress}
                    </p>
                )}
            </div>
        </GenericModal>
    );
};

export default ImageExtractionDialog;
