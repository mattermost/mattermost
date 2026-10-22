// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {Redirect, useHistory, useLocation} from 'react-router-dom';

import {PlusIcon} from '@mattermost/compass-icons/components';
import {Button} from '@mattermost/shared/components/button';

import {getAgents} from 'mattermost-redux/actions/agents';
import {getRecaps, getScheduledRecaps, getRecapLimitStatus as fetchRecapLimitStatus, markRecapsAsViewed} from 'mattermost-redux/actions/recaps';
import {getAllRecaps, getUnreadRecaps, getReadRecaps, getAllScheduledRecaps} from 'mattermost-redux/selectors/entities/recaps';

import {selectLhsItem} from 'actions/views/lhs';
import {openModal} from 'actions/views/modals';

import useGetAgentsBridgeEnabled from 'components/common/hooks/useGetAgentsBridgeEnabled';
import useGetFeatureFlagValue from 'components/common/hooks/useGetFeatureFlagValue';
import CreateRecapModal from 'components/create_recap_modal';

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
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const history = useHistory();
    const location = useLocation();
    const query = useQuery();
    const tabParam = query.get('tab');
    const [activeTab, setActiveTab] = useState<TabName>(() => {
        return isValidTab(tabParam) ? tabParam : 'unread';
    });
    const [isLoading, setIsLoading] = useState(true);

    // Handle tab change: update state and URL
    const handleTabChange = useCallback((tab: TabName) => {
        setActiveTab(tab);

        // Update URL with the new tab parameter using replace to avoid polluting history
        const newSearchParams = new URLSearchParams(location.search);
        if (tab === 'unread') {
            // Remove tab param for default tab to keep URL clean
            newSearchParams.delete('tab');
        } else {
            newSearchParams.set('tab', tab);
        }
        const newSearch = newSearchParams.toString();
        const newUrl = newSearch ? `${location.pathname}?${newSearch}` : location.pathname;
        history.replace(newUrl);
    }, [history, location.pathname, location.search]);
    const enableAIRecaps = useGetFeatureFlagValue('EnableAIRecaps');
    const agentsBridgeEnabled = useGetAgentsBridgeEnabled();

    const allRecaps = useSelector(getAllRecaps);
    const unreadRecaps = useSelector(getUnreadRecaps);
    const readRecaps = useSelector(getReadRecaps);
    const scheduledRecaps = useSelector(getAllScheduledRecaps);
    const hasNoRecaps = !isLoading && allRecaps.length === 0;

    // Sync activeTab with URL query parameter changes (e.g., when navigating via history.push)
    useEffect(() => {
        const urlTab = isValidTab(tabParam) ? tabParam : 'unread';
        setActiveTab(urlTab);
    }, [tabParam]);

    useEffect(() => {
        dispatch(selectLhsItem(LhsItemType.Page, LhsPage.Recaps));
        const fetchData = async () => {
            try {
                const result = await dispatch(getRecaps(0, 60));

                // Only mark viewed when getRecaps succeeded. Marking after the
                // fetch (rather than in parallel) also prevents getRecaps's
                // response from overwriting the viewed_at timestamps the
                // WS-driven refresh is about to set.
                if (!result.error) {
                    dispatch(markRecapsAsViewed());
                }
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
        dispatch(getScheduledRecaps(0, 60));
        dispatch(getAgents());
        dispatch(fetchRecapLimitStatus());
    }, [dispatch]);

    // Redirect if feature flag is disabled
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
        // Find the scheduled recap to edit
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
    let recapsContent: React.ReactNode;
    if (activeTab === 'scheduled') {
        recapsContent = (
            <ScheduledRecapsList
                scheduledRecaps={scheduledRecaps}
                onEdit={handleEditScheduledRecap}
                onCreateClick={handleAddRecap}
                createDisabled={!agentsBridgeEnabled.available}
            />
        );
    } else if (hasNoRecaps) {
        recapsContent = (
            <div className='recaps-placeholder'>
                <AICopilotIntroSvg/>
                <h2 className='recaps-placeholder-title'>
                    {formatMessage({id: 'recaps.placeholder.title', defaultMessage: 'Set up your recap'})}
                </h2>
                <p className='recaps-placeholder-description'>
                    {formatMessage({id: 'recaps.placeholder.description', defaultMessage: 'Recaps help you get caught up quickly on discussions that are most important to you with a summarized report.'})}
                </p>
                <Button
                    emphasis='primary'
                    className='recaps-placeholder-button'
                    onClick={handleAddRecap}
                    disabled={!agentsBridgeEnabled.available}
                    title={agentsBridgeEnabled.available ? undefined : formatMessage({id: 'recaps.addRecap.disabled', defaultMessage: 'Agents Bridge is not enabled'})}
                >
                    {formatMessage({id: 'recaps.placeholder.createRecap', defaultMessage: 'Create a recap'})}
                </Button>
            </div>
        );
    } else {
        recapsContent = <RecapsList recaps={displayedRecaps}/>;
    }

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
                </div>
                {(activeTab === 'scheduled' || !hasNoRecaps) && (
                    <Button
                        emphasis='tertiary'
                        className='recap-add-button'
                        onClick={handleAddRecap}
                        disabled={!agentsBridgeEnabled.available}
                        title={agentsBridgeEnabled.available ? undefined : formatMessage({id: 'recaps.addRecap.disabled', defaultMessage: 'Agents Bridge is not enabled'})}
                    >
                        <PlusIcon size={12}/>
                        {formatMessage({id: 'recaps.addRecap', defaultMessage: 'Add a recap'})}
                    </Button>
                )}
            </div>

            <div className='recaps-content'>
                {recapsContent}
            </div>
        </div>
    );
};

export default Recaps;
