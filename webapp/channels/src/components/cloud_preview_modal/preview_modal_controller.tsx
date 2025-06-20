// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback} from 'react';
import {useIntl} from 'react-intl';

import {ArrowLeftIcon, ArrowRightIcon} from '@mattermost/compass-icons/components';
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
    const intl = useIntl();
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
                        className='btn btn-quaternary'
                        onClick={handleSkip}
                    >
                        {intl.formatMessage({
                            id: 'cloud_preview_modal.skip',
                            defaultMessage: 'Skip for now',
                        })}
                    </button>
                )}

                {!isFirstSlide && (
                    <button
                        className='btn btn-tertiary'
                        onClick={handlePrevious}
                    >
                        <ArrowLeftIcon size={18}/>
                        {intl.formatMessage({
                            id: 'cloud_preview_modal.previous',
                            defaultMessage: 'Previous',
                        })}
                    </button>
                )}

                <button
                    className='btn btn-primary'
                    onClick={isLastSlide ? onClose : handleNext}
                >
                    {isLastSlide ? (
                        intl.formatMessage({
                            id: 'cloud_preview_modal.done',
                            defaultMessage: 'Finish',
                        })
                    ) : (
                        <>
                            {intl.formatMessage({
                                id: 'cloud_preview_modal.next',
                                defaultMessage: 'Next',
                            })}
                            <ArrowRightIcon size={18}/>
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
            ariaLabel={intl.formatMessage({
                id: 'cloud_preview_modal.aria_label',
                defaultMessage: 'Cloud Preview Introduction',
            })}
            showHeader={true}
            showCloseButton={true}
            bodyPadding={true}
            footerContent={footerContent}
            className='preview-modal-controller'
        >
            <PreviewModalContent content={contentData[currentIndex]}/>
        </GenericModal>
    );
};

export default PreviewModalController;
