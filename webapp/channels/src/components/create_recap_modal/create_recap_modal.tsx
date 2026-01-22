// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback, useEffect} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {useHistory, useRouteMatch} from 'react-router-dom';

import {ChevronLeftIcon, ChevronRightIcon} from '@mattermost/compass-icons/components';
import {GenericModal} from '@mattermost/components';
import type {Channel} from '@mattermost/types/channels';
import type {ScheduledRecap, ScheduledRecapInput} from '@mattermost/types/recaps';

import {getAgents} from 'mattermost-redux/actions/agents';
import {createRecap, createScheduledRecap, updateScheduledRecap} from 'mattermost-redux/actions/recaps';
import {getAgents as getAgentsSelector} from 'mattermost-redux/selectors/entities/agents';
import {getMyChannels, getUnreadChannelIds} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTimezone} from 'mattermost-redux/selectors/entities/timezone';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {AgentDropdown} from 'components/common/agents';
import PaginationDots from 'components/common/pagination_dots';

import ChannelSelector from './channel_selector';
import ChannelSummary from './channel_summary';
import RecapConfiguration from './recap_configuration';
import ScheduleConfiguration from './schedule_configuration';

import './create_recap_modal.scss';

type Props = {
    onExited: () => void;
    editScheduledRecap?: ScheduledRecap; // When present, modal is in edit mode
};

type RecapType = 'selected' | 'all_unreads';

const CreateRecapModal = ({onExited, editScheduledRecap}: Props) => {
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

    // Schedule state
    const [runOnce, setRunOnce] = useState(false);
    const [daysOfWeek, setDaysOfWeek] = useState<number>(0);
    const [timeOfDay, setTimeOfDay] = useState<string>('09:00');
    const [timePeriod, setTimePeriod] = useState<string>('last_24h');
    const [customInstructions, setCustomInstructions] = useState<string>('');

    // Validation state
    const [daysError, setDaysError] = useState(false);
    const [timeError, setTimeError] = useState(false);

    // Get user timezone
    const userTimezone = useSelector(getCurrentTimezone);

    // Edit mode detection
    const isEditMode = Boolean(editScheduledRecap);

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

    // Pre-fill form for edit mode
    useEffect(() => {
        if (editScheduledRecap) {
            setRecapName(editScheduledRecap.title);
            setRecapType(editScheduledRecap.channel_mode === 'all_unreads' ? 'all_unreads' : 'selected');
            setSelectedChannelIds(editScheduledRecap.channel_ids || []);
            setDaysOfWeek(editScheduledRecap.days_of_week);
            setTimeOfDay(editScheduledRecap.time_of_day);
            setTimePeriod(editScheduledRecap.time_period);
            setCustomInstructions(editScheduledRecap.custom_instructions || '');
            setSelectedBotId(editScheduledRecap.agent_id);
            // Don't set runOnce in edit mode - it's always a scheduled recap
        }
    }, [editScheduledRecap]);

    // Get unread channels
    const unreadChannels = myChannels.filter((channel: Channel) =>
        unreadChannelIds.includes(channel.id),
    );

    const handleNext = useCallback(() => {
        // Clear validation errors
        setDaysError(false);
        setTimeError(false);

        if (currentStep === 1) {
            if (recapType === 'all_unreads') {
                // For all unreads, set channels and go to step 3
                // Run once: summary; Scheduled: schedule configuration
                setSelectedChannelIds(unreadChannels.map((c: Channel) => c.id));
                setCurrentStep(3);
            } else {
                // For selected channels, go to channel selector
                setCurrentStep(2);
            }
        } else if (currentStep === 2) {
            // From channel selector to step 3 (summary for run once, schedule for scheduled)
            setCurrentStep(3);
        }
    }, [currentStep, recapType, unreadChannels]);

    const handlePrevious = useCallback(() => {
        // Clear validation errors
        setDaysError(false);
        setTimeError(false);

        if (currentStep === 3 && recapType === 'all_unreads') {
            // From step 3 back to step 1 if all unreads (skipped channel selector)
            setCurrentStep(1);
        } else if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    }, [currentStep, recapType]);

    const handleSubmit = useCallback(async () => {
        // Validate channel selection for selected type
        if (selectedChannelIds.length === 0 && recapType === 'selected') {
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

        // For scheduled recaps (not run once), validate schedule fields
        if (!runOnce) {
            if (daysOfWeek === 0) {
                setDaysError(true);
                setError(formatMessage({id: 'recaps.modal.error.noDays', defaultMessage: 'Please select at least one day.'}));
                return;
            }
            if (!timeOfDay) {
                setTimeError(true);
                setError(formatMessage({id: 'recaps.modal.error.noTime', defaultMessage: 'Please select a time.'}));
                return;
            }
        }

        setIsSubmitting(true);
        setError(null);

        try {
            if (runOnce) {
                // Run once: create immediate recap (existing behavior)
                await dispatch(createRecap(recapName, selectedChannelIds, selectedBotId));
                onExited();
                history.push(`${url}/recaps`);
            } else if (isEditMode && editScheduledRecap) {
                // Edit mode: update existing scheduled recap
                const input: ScheduledRecapInput = {
                    title: recapName,
                    days_of_week: daysOfWeek,
                    time_of_day: timeOfDay,
                    timezone: userTimezone || 'UTC',
                    time_period: timePeriod,
                    channel_mode: recapType === 'all_unreads' ? 'all_unreads' : 'specific',
                    channel_ids: recapType === 'selected' ? selectedChannelIds : undefined,
                    custom_instructions: customInstructions || undefined,
                    agent_id: selectedBotId,
                    is_recurring: true,
                };
                await dispatch(updateScheduledRecap(editScheduledRecap.id, input));
                onExited();
                history.push(`${url}/recaps?tab=scheduled`);
            } else {
                // Create new scheduled recap
                const input: ScheduledRecapInput = {
                    title: recapName,
                    days_of_week: daysOfWeek,
                    time_of_day: timeOfDay,
                    timezone: userTimezone || 'UTC',
                    time_period: timePeriod,
                    channel_mode: recapType === 'all_unreads' ? 'all_unreads' : 'specific',
                    channel_ids: recapType === 'selected' ? selectedChannelIds : undefined,
                    custom_instructions: customInstructions || undefined,
                    agent_id: selectedBotId,
                    is_recurring: true,
                };
                await dispatch(createScheduledRecap(input));
                onExited();
                history.push(`${url}/recaps?tab=scheduled`);
            }
        } catch (err) {
            const errorMsg = runOnce
                ? formatMessage({id: 'recaps.modal.error.createFailed', defaultMessage: 'Failed to create recap. Please try again.'})
                : formatMessage({id: 'recaps.modal.error.scheduleFailed', defaultMessage: 'Failed to save scheduled recap. Please try again.'});
            setError(errorMsg);
            setIsSubmitting(false);
        }
    }, [
        selectedChannelIds,
        currentUserId,
        selectedBotId,
        runOnce,
        isEditMode,
        editScheduledRecap,
        daysOfWeek,
        timeOfDay,
        timePeriod,
        customInstructions,
        userTimezone,
        recapName,
        recapType,
        dispatch,
        onExited,
        history,
        url,
        formatMessage,
    ]);

    const canProceed = () => {
        if (currentStep === 1) {
            return recapName.trim().length > 0 && recapType !== null && selectedBotId.length > 0;
        } else if (currentStep === 2) {
            return selectedChannelIds.length > 0;
        } else if (currentStep === 3) {
            if (runOnce) {
                // Run once summary step
                return selectedChannelIds.length > 0 && selectedBotId.length > 0;
            }
            // Schedule configuration step
            return daysOfWeek > 0 && timeOfDay.length > 0 && timePeriod.length > 0;
        }
        return false;
    };

    const getTotalSteps = () => {
        if (runOnce) {
            // Run once: same as current behavior
            return recapType === 'all_unreads' ? 2 : 3;
        }
        // Scheduled: always 3 steps (config -> channels/confirmation -> schedule)
        return 3;
    };

    const getActualStep = () => {
        if (runOnce) {
            // Run once uses existing step mapping
            if (recapType === 'all_unreads') {
                return currentStep === 1 ? 1 : 2;
            }
            return currentStep;
        }
        // Scheduled: always shows 3 steps
        // For all_unreads, step 3 shows schedule (not channel selector)
        if (recapType === 'all_unreads') {
            return currentStep === 1 ? 1 : currentStep === 3 ? 2 : currentStep;
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
                    runOnce={runOnce}
                    setRunOnce={setRunOnce}
                    isEditMode={isEditMode}
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
            if (runOnce) {
                // Run once: show summary
                return (
                    <ChannelSummary
                        selectedChannelIds={selectedChannelIds}
                        myChannels={myChannels}
                    />
                );
            }
            // Scheduled: show schedule configuration
            // Get the selected agent's display name
            const selectedAgent = agents.find((agent) => agent.id === selectedBotId);
            const agentName = selectedAgent?.display_name || selectedAgent?.username || 'Copilot';
            return (
                <ScheduleConfiguration
                    daysOfWeek={daysOfWeek}
                    setDaysOfWeek={setDaysOfWeek}
                    timeOfDay={timeOfDay}
                    setTimeOfDay={setTimeOfDay}
                    timePeriod={timePeriod}
                    setTimePeriod={setTimePeriod}
                    customInstructions={customInstructions}
                    setCustomInstructions={setCustomInstructions}
                    daysError={daysError}
                    timeError={timeError}
                    agentName={agentName}
                />
            );
        default:
            return null;
        }
    };

    const getConfirmButtonText = () => {
        const isFinalStep = currentStep === 3;

        if (!isFinalStep) {
            return formatMessage({id: 'generic_modal.next', defaultMessage: 'Next'});
        }

        if (runOnce) {
            return formatMessage({id: 'recaps.modal.startRecap', defaultMessage: 'Start recap'});
        }

        if (isEditMode) {
            return formatMessage({id: 'recaps.modal.saveChanges', defaultMessage: 'Save changes'});
        }

        return formatMessage({id: 'recaps.modal.createSchedule', defaultMessage: 'Create schedule'});
    };

    const confirmButtonText = getConfirmButtonText();

    const handleBotSelect = useCallback((botId: string) => {
        setSelectedBotId(botId);
    }, []);

    const handleAgentMenuToggle = useCallback((isOpen: boolean) => {
        setIsAgentMenuOpen(isOpen);
    }, []);

    const headerText = (
        <div className='create-recap-modal-header'>
            <span>
                {isEditMode
                    ? formatMessage({id: 'recaps.modal.titleEdit', defaultMessage: 'Edit your recap'})
                    : formatMessage({id: 'recaps.modal.title', defaultMessage: 'Set up your recap'})
                }
            </span>
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

