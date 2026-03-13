// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {Redirect, useHistory, useLocation} from 'react-router-dom';

import {PlusIcon} from '@mattermost/compass-icons/components';

import {getAgents} from 'mattermost-redux/actions/agents';
import {getRecaps, getScheduledRecaps, getRecapLimitStatus as fetchRecapLimitStatus} from 'mattermost-redux/actions/recaps';
import {getAllRecaps, getUnreadRecaps, getReadRecaps, getAllScheduledRecaps, getRecapLimitStatus} from 'mattermost-redux/selectors/entities/recaps';

import {selectLhsItem} from 'actions/views/lhs';
import {openModal} from 'actions/views/modals';

import useGetAgentsBridgeEnabled from 'components/common/hooks/useGetAgentsBridgeEnabled';
import useGetFeatureFlagValue from 'components/common/hooks/useGetFeatureFlagValue';
import CreateRecapModal from 'components/create_recap_modal';
import WithTooltip from 'components/with_tooltip';

import {ModalIdentifiers} from 'utils/constants';
import {useQuery} from 'utils/http_utils';

import {LhsItemType, LhsPage} from 'types/store/lhs';

import AICopilotIntroSvg from './ai_copilot_intro_svg';
import RecapUsageBadge from './recap_usage_badge';
import RecapsList from './recaps_list';
import ScheduledRecapsList from './scheduled_recaps_list';

import './recaps.scss';
import './scheduled_recap_item.scss';

type TabName = 'unread' | 'read' | 'scheduled';

const isValidTab = (tab: string | null): tab is TabName => {
    return tab === 'unread' || tab === 'read' || tab === 'scheduled';
};

const Recaps = () => {
    const {formatMessage, formatTime} = useIntl();
    const dispatch = useDispatch();
    const history = useHistory();
    const location = useLocation();
    const query = useQuery();
    const tabParam = query.get('tab');
    const [activeTab, setActiveTab] = useState<TabName>(() => {
        return isValidTab(tabParam) ? tabParam : 'unread';
    });
    const [isLoading, setIsLoading] = useState(true);
    const enableAIRecaps = useGetFeatureFlagValue('EnableAIRecaps');
    const agentsBridgeEnabled = useGetAgentsBridgeEnabled();

    const allRecaps = useSelector(getAllRecaps);
    const unreadRecaps = useSelector(getUnreadRecaps);
    const readRecaps = useSelector(getReadRecaps);
    const scheduledRecaps = useSelector(getAllScheduledRecaps);
    const limitStatus = useSelector(getRecapLimitStatus);

    const handleTabChange = useCallback((tab: TabName) => {
        setActiveTab(tab);

        const newSearchParams = new URLSearchParams(location.search);
        if (tab === 'unread') {
            newSearchParams.delete('tab');
        } else {
            newSearchParams.set('tab', tab);
        }
        const newSearch = newSearchParams.toString();
        const newUrl = newSearch ? `${location.pathname}?${newSearch}` : location.pathname;
        history.replace(newUrl);
    }, [history, location.pathname, location.search]);

    useEffect(() => {
        const urlTab = isValidTab(tabParam) ? tabParam : 'unread';
        setActiveTab(urlTab);
    }, [tabParam]);

    const hasNoRecaps = !isLoading && allRecaps.length === 0 && scheduledRecaps.length === 0;

    useEffect(() => {
        dispatch(selectLhsItem(LhsItemType.Page, LhsPage.Recaps));

        const fetchData = async () => {
            await Promise.all([
                dispatch(getRecaps(0, 60)),
                dispatch(getScheduledRecaps(0, 200)),
            ]);
            setIsLoading(false);
        };

        fetchData();
        dispatch(getAgents());
        dispatch(fetchRecapLimitStatus());
    }, [dispatch]);

    const isCreationBlocked = useMemo(() => {
        if (!limitStatus) {
            return false;
        }

        if (limitStatus.cooldown.is_active) {
            return true;
        }

        const {daily} = limitStatus;
        return daily.limit !== -1 && daily.used >= daily.limit;
    }, [limitStatus]);

    const blockedTooltip = useMemo(() => {
        if (!limitStatus || !isCreationBlocked) {
            return '';
        }

        if (limitStatus.cooldown.is_active) {
            const time = new Date(limitStatus.cooldown.available_at);
            return formatMessage(
                {id: 'recaps.addRecap.cooldownTooltip', defaultMessage: 'Available again at {time}'},
                {time: formatTime(time, {hour: 'numeric', minute: '2-digit'})},
            );
        }

        const resetTime = new Date(limitStatus.daily.reset_at);
        return formatMessage(
            {id: 'recaps.addRecap.limitReachedTooltip', defaultMessage: 'Daily limit reached. Resets at {time}'},
            {time: formatTime(resetTime, {hour: 'numeric', minute: '2-digit'})},
        );
    }, [formatMessage, formatTime, isCreationBlocked, limitStatus]);

    if (enableAIRecaps !== 'true') {
        return <Redirect to='/'/>;
    }

    const handleAddRecap = () => {
        dispatch(openModal({
            modalId: ModalIdentifiers.CREATE_RECAP_MODAL,
            dialogType: CreateRecapModal,
        }));
    };

    const handleEditScheduledRecap = (id: string) => {
        const scheduledRecapToEdit = scheduledRecaps.find((sr) => sr.id === id);

        if (!scheduledRecapToEdit) {
            return;
        }

        dispatch(openModal({
            modalId: ModalIdentifiers.CREATE_RECAP_MODAL,
            dialogType: CreateRecapModal,
            dialogProps: {
                editScheduledRecap: scheduledRecapToEdit,
            },
        }));
    };

    const displayedRecaps = activeTab === 'unread' ? unreadRecaps : readRecaps;

    const renderContent = () => {
        if (hasNoRecaps) {
            return (
                <div className='recaps-placeholder'>
                    <AICopilotIntroSvg/>
                    <h2 className='recaps-placeholder-title'>
                        {formatMessage({id: 'recaps.placeholder.title', defaultMessage: 'Set up your recap'})}
                    </h2>
                    <p className='recaps-placeholder-description'>
                        {formatMessage({id: 'recaps.placeholder.description', defaultMessage: 'Recaps help you get caught up quickly on discussions that are most important to you with a summarized report.'})}
                    </p>
                    {isCreationBlocked ? (
                        <WithTooltip
                            id='recap-placeholder-blocked-tooltip'
                            title={blockedTooltip}
                            forcedPlacement='bottom'
                        >
                            <span className='recap-add-button-wrapper'>
                                <button
                                    className='btn btn-primary recaps-placeholder-button'
                                    disabled={true}
                                    aria-disabled={true}
                                >
                                    {formatMessage({id: 'recaps.placeholder.createRecap', defaultMessage: 'Create a recap'})}
                                </button>
                            </span>
                        </WithTooltip>
                    ) : (
                        <button
                            className='btn btn-primary recaps-placeholder-button'
                            onClick={handleAddRecap}
                            disabled={!agentsBridgeEnabled.available}
                            title={agentsBridgeEnabled.available ? undefined : formatMessage({id: 'recaps.addRecap.disabled', defaultMessage: 'Agents Bridge is not enabled'})}
                        >
                            {formatMessage({id: 'recaps.placeholder.createRecap', defaultMessage: 'Create a recap'})}
                        </button>
                    )}
                </div>
            );
        }

        if (activeTab === 'scheduled') {
            return (
                <ScheduledRecapsList
                    scheduledRecaps={scheduledRecaps}
                    onEdit={handleEditScheduledRecap}
                    onCreateClick={handleAddRecap}
                    createDisabled={!agentsBridgeEnabled.available || isCreationBlocked}
                />
            );
        }

        return <RecapsList recaps={displayedRecaps}/>;
    };

    return (
        <div className='recaps-container'>
            <div className='recaps-header'>
                <div className='recaps-header-left'>
                    <div className='recaps-title-container'>
                        <i className='icon icon-robot-outline'/>
                        <h1 className='recaps-title'>
                            {formatMessage({id: 'recaps.title', defaultMessage: 'Recaps'})}
                        </h1>
                        <RecapUsageBadge/>
                    </div>
                    {!hasNoRecaps && (
                        <div className='recaps-tabs'>
                            <button
                                className={`recaps-tab ${activeTab === 'unread' ? 'active' : ''}`}
                                onClick={() => handleTabChange('unread')}
                            >
                                {formatMessage({id: 'recaps.unreadTab', defaultMessage: 'Unread'})}
                            </button>
                            <button
                                className={`recaps-tab ${activeTab === 'read' ? 'active' : ''}`}
                                onClick={() => handleTabChange('read')}
                            >
                                {formatMessage({id: 'recaps.readTab', defaultMessage: 'Read'})}
                            </button>
                            <button
                                className={`recaps-tab ${activeTab === 'scheduled' ? 'active' : ''}`}
                                onClick={() => handleTabChange('scheduled')}
                            >
                                {formatMessage({id: 'recaps.scheduled.tab', defaultMessage: 'Scheduled'})}
                            </button>
                        </div>
                    )}
                </div>
                {!hasNoRecaps && (isCreationBlocked ? (
                    <WithTooltip
                        id='recap-add-blocked-tooltip'
                        title={blockedTooltip}
                        forcedPlacement='bottom'
                    >
                        <span className='recap-add-button-wrapper'>
                            <button
                                className='btn btn-tertiary recap-add-button'
                                disabled={true}
                                aria-disabled={true}
                            >
                                <PlusIcon size={12}/>
                                {formatMessage({id: 'recaps.addRecap', defaultMessage: 'Add a recap'})}
                            </button>
                        </span>
                    </WithTooltip>
                ) : (
                    <button
                        className='btn btn-tertiary recap-add-button'
                        onClick={handleAddRecap}
                        disabled={!agentsBridgeEnabled.available}
                        title={agentsBridgeEnabled.available ? undefined : formatMessage({id: 'recaps.addRecap.disabled', defaultMessage: 'Agents Bridge is not enabled'})}
                    >
                        <PlusIcon size={12}/>
                        {formatMessage({id: 'recaps.addRecap', defaultMessage: 'Add a recap'})}
                    </button>
                ))}
            </div>

            <div className='recaps-content'>
                {renderContent()}
            </div>
        </div>
    );
};

export default Recaps;
