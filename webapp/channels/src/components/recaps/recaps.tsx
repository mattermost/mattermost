// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {Redirect} from 'react-router-dom';

import {PlusIcon} from '@mattermost/compass-icons/components';

import {getAgents} from 'mattermost-redux/actions/agents';
import {getRecaps} from 'mattermost-redux/actions/recaps';
import {getUnreadRecaps, getReadRecaps} from 'mattermost-redux/selectors/entities/recaps';

import {openModal} from 'actions/views/modals';

import useGetAgentsBridgeEnabled from 'components/common/hooks/useGetAgentsBridgeEnabled';
import useGetFeatureFlagValue from 'components/common/hooks/useGetFeatureFlagValue';
import CreateRecapModal from 'components/create_recap_modal';

import {ModalIdentifiers} from 'utils/constants';

import RecapsList from './recaps_list';

import './recaps.scss';

const Recaps = () => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const [activeTab, setActiveTab] = useState<'unread' | 'read'>('unread');
    const enableAIRecaps = useGetFeatureFlagValue('EnableAIRecaps');
    const agentsBridgeEnabled = useGetAgentsBridgeEnabled();

    const unreadRecaps = useSelector(getUnreadRecaps);
    const readRecaps = useSelector(getReadRecaps);

    useEffect(() => {
        dispatch(getRecaps(0, 60));
        dispatch(getAgents());
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

    const displayedRecaps = activeTab === 'unread' ? unreadRecaps : readRecaps;

    return (
        <div className='recaps-container'>
            <div className='recaps-header'>
                <div className='recaps-header-left'>
                    <div className='recaps-title-container'>
                        <i className='icon icon-robot-outline'/>
                        <h1 className='recaps-title'>
                            {formatMessage({id: 'recaps.title', defaultMessage: 'Recaps'})}
                        </h1>
                    </div>
                    <div className='recaps-tabs'>
                        <button
                            className={`recaps-tab ${activeTab === 'unread' ? 'active' : ''}`}
                            onClick={() => setActiveTab('unread')}
                        >
                            {formatMessage({id: 'recaps.unreadTab', defaultMessage: 'Unread'})}
                        </button>
                        <button
                            className={`recaps-tab ${activeTab === 'read' ? 'active' : ''}`}
                            onClick={() => setActiveTab('read')}
                        >
                            {formatMessage({id: 'recaps.readTab', defaultMessage: 'Read'})}
                        </button>
                    </div>
                </div>
                <button
                    className='btn btn-tertiary recap-add-button'
                    onClick={handleAddRecap}
                    disabled={!agentsBridgeEnabled.available}
                    title={agentsBridgeEnabled.available ? undefined : formatMessage({id: 'recaps.addRecap.disabled', defaultMessage: 'Agents Bridge is not enabled'})}
                >
                    <PlusIcon size={12}/>
                    {formatMessage({id: 'recaps.addRecap', defaultMessage: 'Add a recap'})}
                </button>
            </div>

            <div className='recaps-content'>
                <RecapsList recaps={displayedRecaps}/>
            </div>
        </div>
    );
};

export default Recaps;

