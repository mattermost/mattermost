// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback, useEffect} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {useHistory, useRouteMatch} from 'react-router-dom';

import {ChevronLeftIcon, ChevronRightIcon} from '@mattermost/compass-icons/components';
import {GenericModal} from '@mattermost/components';
import type {Channel} from '@mattermost/types/channels';

import {getAgents} from 'mattermost-redux/actions/agents';
import {createRecap} from 'mattermost-redux/actions/recaps';
import {getAgents as getAgentsSelector} from 'mattermost-redux/selectors/entities/agents';
import {getMyChannels, getUnreadChannelIds} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {AgentDropdown} from 'components/common/agents';
import PaginationDots from 'components/common/pagination_dots';

import ChannelSelector from './channel_selector';
import ChannelSummary from './channel_summary';
import RecapConfiguration from './recap_configuration';

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
    const agents = useSelector(getAgentsSelector);

    const [currentStep, setCurrentStep] = useState(1);
    const [recapName, setRecapName] = useState('');
    const [recapType, setRecapType] = useState<RecapType | null>(null);
    const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
    const [selectedBotId, setSelectedBotId] = useState<string>('');
    const [isAgentMenuOpen, setIsAgentMenuOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch AI agents on mount
    useEffect(() => {
        dispatch(getAgents());
    }, [dispatch]);

    // Set default bot when agents are loaded
    useEffect(() => {
        if (agents.length > 0 && !selectedBotId) {
            setSelectedBotId(agents[0].id);
        }
    }, [agents, selectedBotId]);

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

        if (!selectedBotId) {
            setError(formatMessage({id: 'recaps.modal.error.noBot', defaultMessage: 'Please select an AI agent.'}));
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await dispatch(createRecap(recapName, selectedChannelIds, selectedBotId));
            onExited();
            history.push(`${url}/recaps`);
        } catch (err) {
            setError(formatMessage({id: 'recaps.modal.error.createFailed', defaultMessage: 'Failed to create recap. Please try again.'}));
            setIsSubmitting(false);
        }
    }, [selectedChannelIds, currentUserId, selectedBotId, dispatch, onExited, history, url, formatMessage, recapName]);

    const canProceed = () => {
        if (currentStep === 1) {
            return recapName.trim().length > 0 && recapType !== null && selectedBotId.length > 0;
        } else if (currentStep === 2) {
            return selectedChannelIds.length > 0;
        } else if (currentStep === 3) {
            return selectedChannelIds.length > 0 && selectedBotId.length > 0;
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
                <RecapConfiguration
                    recapName={recapName}
                    setRecapName={setRecapName}
                    recapType={recapType}
                    setRecapType={setRecapType}
                    unreadChannels={unreadChannels}
                />
            );
        case 2:
            return (
                <ChannelSelector
                    selectedChannelIds={selectedChannelIds}
                    setSelectedChannelIds={setSelectedChannelIds}
                    myChannels={myChannels}
                    unreadChannels={unreadChannels}
                />
            );
        case 3:
            return (
                <ChannelSummary
                    selectedChannelIds={selectedChannelIds}
                    myChannels={myChannels}
                />
            );
        default:
            return null;
        }
    };

    const confirmButtonText = currentStep === 3 ? formatMessage({id: 'recaps.modal.startRecap', defaultMessage: 'Start recap'}) : formatMessage({id: 'generic_modal.next', defaultMessage: 'Next'});

    const handleBotSelect = useCallback((botId: string) => {
        setSelectedBotId(botId);
    }, []);

    const handleAgentMenuToggle = useCallback((isOpen: boolean) => {
        setIsAgentMenuOpen(isOpen);
    }, []);

    const headerText = (
        <div className='create-recap-modal-header'>
            <span>{formatMessage({id: 'recaps.modal.title', defaultMessage: 'Set up your recap'})}</span>
            <div className='create-recap-modal-header-actions'>
                <AgentDropdown
                    showLabel={true}
                    selectedBotId={selectedBotId}
                    onBotSelect={handleBotSelect}
                    bots={agents}
                    defaultBotId={agents.length > 0 ? agents[0].id : undefined}
                    disabled={isSubmitting}
                    onMenuToggle={handleAgentMenuToggle}
                />
            </div>
        </div>
    );

    const handleConfirmClick = useCallback(() => {
        if (currentStep === 3) {
            handleSubmit();
            return;
        }
        handleNext();
    }, [currentStep, handleSubmit, handleNext]);

    const footerContent = (
        <div className='create-recap-modal-footer'>
            <div className='create-recap-modal-footer-left'>
                <PaginationDots
                    totalSteps={getTotalSteps()}
                    currentStep={getActualStep()}
                />
            </div>
            <div className='create-recap-modal-footer-actions'>
                {currentStep > 1 && (
                    <button
                        type='button'
                        className='GenericModal__button btn btn-tertiary'
                        onClick={handlePrevious}
                        disabled={isSubmitting}
                    >
                        <ChevronLeftIcon size={16}/>
                        {formatMessage({id: 'generic_modal.previous', defaultMessage: 'Previous'})}
                    </button>
                )}
                <button
                    type='submit'
                    className='GenericModal__button btn btn-primary'
                    onClick={handleConfirmClick}
                    disabled={!canProceed() || isSubmitting}
                >
                    {confirmButtonText}
                    {currentStep < 3 && <ChevronRightIcon size={16}/>}
                </button>
            </div>
        </div>
    );

    return (
        <GenericModal
            className='create-recap-modal'
            id='createRecapModal'
            onExited={onExited}
            modalHeaderText={headerText}
            enforceFocus={!isAgentMenuOpen}
            compassDesign={true}
            footerDivider={false}
            footerContent={footerContent}
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

