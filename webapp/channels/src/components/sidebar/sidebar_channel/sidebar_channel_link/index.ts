// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators, Dispatch} from 'redux';

import {getCurrentUserId, getMyChannelMemberships} from 'mattermost-redux/selectors/entities/common';
import {getInt} from 'mattermost-redux/selectors/entities/preferences';

import {GenericAction} from 'mattermost-redux/types/actions';
import {isChannelMuted} from 'mattermost-redux/utils/channel_utils';
import {makeGetChannelUnreadCount} from 'mattermost-redux/selectors/entities/channels';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {clearChannelSelection, multiSelectChannelAdd, multiSelectChannelTo} from 'actions/views/channel_sidebar';
import {getFirstChannelName} from 'selectors/onboarding';
import {markMostRecentPostInChannelAsUnread, unsetEditingPost} from 'actions/post_actions';
import {closeRightHandSide} from 'actions/views/rhs';
import {isChannelSelected} from 'selectors/views/channel_sidebar';
import {getIsRhsOpen, getRhsState} from 'selectors/rhs';
import {GlobalState} from 'types/store';
import {
    GenericTaskSteps,
    OnboardingTaskCategory,
    OnboardingTasksName,
} from 'components/onboarding_tasks';
import {FINISHED, OnboardingTourSteps, TutorialTourName} from 'components/tours';

import {Channel} from '@mattermost/types/channels';

import SidebarChannelLink from './sidebar_channel_link';

type OwnProps = {
    channel: Channel;
}

function makeMapStateToProps() {
    const getUnreadCount = makeGetChannelUnreadCount();

    return (state: GlobalState, ownProps: OwnProps) => {
        const member = getMyChannelMemberships(state)[ownProps.channel.id];
        const unreadCount = getUnreadCount(state, ownProps.channel.id);
        const firstChannelName = getFirstChannelName(state);
        const config = getConfig(state);
        const enableTutorial = config.EnableTutorial === 'true';
        const currentUserId = getCurrentUserId(state);
        const tutorialStep = getInt(state, TutorialTourName.ONBOARDING_TUTORIAL_STEP, currentUserId, 0);
        const triggerStep = getInt(state, OnboardingTaskCategory, OnboardingTasksName.CHANNELS_TOUR, FINISHED);
        const channelTourTriggered = triggerStep === GenericTaskSteps.STARTED;
        const isOnboardingFlowEnabled = config.EnableOnboardingFlow;
        const showChannelsTour = enableTutorial && tutorialStep === OnboardingTourSteps.CHANNELS_AND_DIRECT_MESSAGES;
        const showChannelsTutorialStep = showChannelsTour && channelTourTriggered && isOnboardingFlowEnabled === 'true';
        return {
            unreadMentions: unreadCount.mentions,
            unreadMsgs: unreadCount.messages,
            isUnread: unreadCount.showUnread,
            isMuted: isChannelMuted(member),
            hasUrgent: unreadCount.hasUrgent,
            isChannelSelected: isChannelSelected(state, ownProps.channel.id),
            firstChannelName: showChannelsTutorialStep ? firstChannelName : '',
            showChannelsTutorialStep,
            rhsState: getRhsState(state),
            rhsOpen: getIsRhsOpen(state),
        };
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators({
            markMostRecentPostInChannelAsUnread,
            unsetEditingPost,
            clearChannelSelection,
            multiSelectChannelTo,
            multiSelectChannelAdd,
            closeRightHandSide,
        }, dispatch),
    };
}

export default connect(makeMapStateToProps, mapDispatchToProps)(SidebarChannelLink);
