// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback} from 'react';
import {FormattedMessage} from 'react-intl';

import {ChevronLeftIcon, ChevronRightIcon, CloseIcon} from '@mattermost/compass-icons/components';
import {GenericModal} from '@mattermost/components';

import PreviewModalContent from './preview_modal_content';
import type {PreviewModalContentData} from './preview_modal_content_data';

import './preview_modal_controller.scss';

interface Props {
    show: boolean;
    onClose: () => void;
    contentData: PreviewModalContentData[];
}

const PreviewModalController: React.FC<Props> = ({show, onClose, contentData}) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    const handlePrevious = useCallback(() => {
        setCurrentIndex((prev) => Math.max(0, prev - 1));
    }, []);

    const handleNext = useCallback(() => {
        setCurrentIndex((prev) => Math.min(contentData.length - 1, prev + 1));
    }, [contentData.length]);

    const handleSkip = useCallback(() => {
        onClose();
    }, [onClose]);

    const isFirstSlide = currentIndex === 0;
    const isLastSlide = currentIndex === contentData.length - 1;

    if (contentData.length === 0) {
        return null;
    }

    // Custom footer content with pagination and navigation buttons
    const footerContent = (
        <div className='preview-modal-controller__footer'>
            <div className='preview-modal-controller__pagination'>
                <div
                    className='preview-modal-controller__pagination-dots'
                    data-testid='pagination-dots'
                >
                    {contentData.map((_, index) => (
                        <div
                            key={`dot-${index}`}
                            className={`preview-modal-controller__dot ${index === currentIndex ? 'preview-modal-controller__dot--active' : ''}`}
                        />
                    ))}
                </div>
                <span className='preview-modal-controller__page-counter'>
                    {currentIndex + 1}{'/'}{contentData.length}
                </span>
            </div>

            <div className='preview-modal-controller__navigation-buttons'>
                {isFirstSlide && (
                    <button
                        className='preview-modal-controller__skip-button'
                        onClick={handleSkip}
                    >
                        <FormattedMessage
                            id='cloud_preview_modal.skip'
                            defaultMessage='Skip for now'
                        />
                    </button>
                )}

                {!isFirstSlide && (
                    <button
                        className='preview-modal-controller__nav-button preview-modal-controller__nav-button--tertiary'
                        onClick={handlePrevious}
                    >
                        <ChevronLeftIcon size={18}/>
                        <FormattedMessage
                            id='cloud_preview_modal.previous'
                            defaultMessage='Previous'
                        />
                    </button>
                )}

                <button
                    className='preview-modal-controller__nav-button preview-modal-controller__nav-button--primary'
                    onClick={isLastSlide ? onClose : handleNext}
                >
                    {isLastSlide ? (
                        <FormattedMessage
                            id='cloud_preview_modal.done'
                            defaultMessage='Finish'
                        />
                    ) : (
                        <>
                            <FormattedMessage
                                id='cloud_preview_modal.next'
                                defaultMessage='Next'
                            />
                            <ChevronRightIcon size={18}/>
                        </>
                    )}
                </button>
            </div>
        </div>
    );

    return (
        <GenericModal
            show={show}
            onHide={onClose}
            compassDesign={true}
            enforceFocus={true}
            ariaLabel='Cloud Preview Introduction'
            showHeader={false}
            showCloseButton={false}
            bodyPadding={true}
            footerContent={footerContent}
            className='preview-modal-controller'
        >
            <button
                className='preview-modal-controller__close-button'
                onClick={onClose}
                aria-label='Close modal'
            >
                <CloseIcon size={24}/>
            </button>
            <PreviewModalContent content={contentData[currentIndex]}/>
        </GenericModal>
    );
};

export default PreviewModalController;
