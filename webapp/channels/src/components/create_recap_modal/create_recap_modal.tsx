// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {useHistory, useRouteMatch} from 'react-router-dom';

import {createRecap} from 'mattermost-redux/actions/recaps';
import {getMyChannels, getUnreadChannelIds} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import type {Channel} from '@mattermost/types/channels';

import {GenericModal} from '@mattermost/components';

import StepOne from './step_one';
import StepTwoChannelSelector from './step_two_channel_selector';
import StepTwoSummary from './step_two_summary';
import PaginationDots from './pagination_dots';

import './create_recap_modal.scss';

type Props = {
    onExited: () => void;
};

type RecapType = 'selected' | 'all_unreads';

const CreateRecapModal = ({onExited}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const history = useHistory();
    const {url} = useRouteMatch();
    const currentUserId = useSelector(getCurrentUserId);
    const myChannels = useSelector(getMyChannels);
    const unreadChannelIds = useSelector(getUnreadChannelIds);

    const [currentStep, setCurrentStep] = useState(1);
    const [recapName, setRecapName] = useState('');
    const [recapType, setRecapType] = useState<RecapType | null>(null);
    const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Get unread channels
    const unreadChannels = myChannels.filter((channel: Channel) =>
        unreadChannelIds.includes(channel.id),
    );

    const handleNext = useCallback(() => {
        if (currentStep === 1) {
            if (recapType === 'all_unreads') {
                // For all unreads, skip channel selector and go to summary
                setSelectedChannelIds(unreadChannels.map((c: Channel) => c.id));
                setCurrentStep(3); // Go to summary
            } else {
                // For selected channels, go to channel selector
                setCurrentStep(2);
            }
        } else if (currentStep === 2) {
            // From channel selector to summary
            setCurrentStep(3);
        }
    }, [currentStep, recapType, unreadChannels]);

    const handlePrevious = useCallback(() => {
        if (currentStep === 3 && recapType === 'all_unreads') {
            // From summary back to step 1 if all unreads
            setCurrentStep(1);
        } else if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    }, [currentStep, recapType]);

    const handleSubmit = useCallback(async () => {
        if (selectedChannelIds.length === 0) {
            setError(formatMessage({id: 'recaps.modal.error.noChannels', defaultMessage: 'Please select at least one channel.'}));
            return;
        }

        if (!currentUserId) {
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await dispatch(createRecap(recapName, selectedChannelIds));
            onExited();
            history.push(`${url}/recaps`);
        } catch (err) {
            console.error('Failed to create recap:', err);
            setError(formatMessage({id: 'recaps.modal.error.createFailed', defaultMessage: 'Failed to create recap. Please try again.'}));
            setIsSubmitting(false);
        }
    }, [selectedChannelIds, currentUserId, dispatch, onExited, history, url, formatMessage]);

    const canProceed = () => {
        if (currentStep === 1) {
            return recapName.trim().length > 0 && recapType !== null;
        } else if (currentStep === 2) {
            return selectedChannelIds.length > 0;
        } else if (currentStep === 3) {
            return selectedChannelIds.length > 0;
        }
        return false;
    };

    const getTotalSteps = () => {
        return recapType === 'all_unreads' ? 2 : 3;
    };

    const getActualStep = () => {
        if (recapType === 'all_unreads') {
            return currentStep === 1 ? 1 : 2;
        }
        return currentStep;
    };

    const renderStep = () => {
        switch (currentStep) {
        case 1:
            return (
                <StepOne
                    recapName={recapName}
                    setRecapName={setRecapName}
                    recapType={recapType}
                    setRecapType={setRecapType}
                />
            );
        case 2:
            return (
                <StepTwoChannelSelector
                    selectedChannelIds={selectedChannelIds}
                    setSelectedChannelIds={setSelectedChannelIds}
                    myChannels={myChannels}
                    unreadChannels={unreadChannels}
                />
            );
        case 3:
            return (
                <StepTwoSummary
                    selectedChannelIds={selectedChannelIds}
                    myChannels={myChannels}
                />
            );
        default:
            return null;
        }
    };

    const confirmButtonText = currentStep === 3 ?
        formatMessage({id: 'recaps.modal.startRecap', defaultMessage: 'Start recap'}) :
        formatMessage({id: 'generic_modal.next', defaultMessage: 'Next'});

    const headerText = (
        <div className='create-recap-modal-header'>
            <span>{formatMessage({id: 'recaps.modal.title', defaultMessage: 'Set up your recap'})}</span>
            <div className='create-recap-modal-header-actions'>
                <span className='bot-label'>
                    {formatMessage({id: 'recaps.modal.generateWith', defaultMessage: 'GENERATE WITH:'})}
                </span>
                <div className='bot-dropdown'>
                    <span>{formatMessage({id: 'recaps.copilot', defaultMessage: 'Copilot'})}</span>
                    <i className='icon icon-chevron-down'/>
                </div>
            </div>
        </div>
    );

    const handleConfirmClick = useCallback(() => {
        if (currentStep === 3) {
            return handleSubmit();
        }
        return handleNext();
    }, [currentStep, handleSubmit, handleNext]);

    return (
        <GenericModal
            className='create-recap-modal'
            id='createRecapModal'
            onExited={onExited}
            modalHeaderText={headerText}
            compassDesign={true}
            handleCancel={onExited}
            handleConfirm={handleConfirmClick}
            confirmButtonText={confirmButtonText}
            isConfirmDisabled={!canProceed() || isSubmitting}
            autoCloseOnConfirmButton={currentStep === 3}
            footerContent={(
                <div className='create-recap-modal-footer-content'>
                    <PaginationDots
                        totalSteps={getTotalSteps()}
                        currentStep={getActualStep()}
                    />
                    {currentStep > 1 && (
                        <button
                            className='btn btn-link'
                            onClick={handlePrevious}
                            disabled={isSubmitting}
                        >
                            <i className='icon icon-chevron-left'/>
                            {formatMessage({id: 'generic_modal.previous', defaultMessage: 'Previous'})}
                        </button>
                    )}
                </div>
            )}
        >
            <div className='create-recap-modal-body'>
                {error && (
                    <div className='create-recap-modal-error'>
                        <i className='icon icon-alert-circle-outline'/>
                        <span>{error}</span>
                    </div>
                )}
                {renderStep()}
            </div>
        </GenericModal>
    );
};

export default CreateRecapModal;

