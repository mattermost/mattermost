// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useSelector} from 'react-redux';

import {getCurrentChannelId, getCurrentUserId} from 'mattermost-redux/selectors/entities/common';
import {getConfig, getWorkTemplatesLinkedProducts} from 'mattermost-redux/selectors/entities/general';
import {getInt} from 'mattermost-redux/selectors/entities/preferences';

import {getActiveRhsComponent} from 'selectors/rhs';
import {suitePluginIds} from 'utils/constants';
import {TutorialTourName, WorkTemplateTourSteps} from '../constant';

import {GlobalState} from 'types/store';

export const useShowTourTip = () => {
    const activeRhsComponent = useSelector(getActiveRhsComponent);
    const pluginId = activeRhsComponent?.pluginId || '';

    const currentChannelId = useSelector(getCurrentChannelId);
    const currentUserId = useSelector(getCurrentUserId);

    const enableTutorial = useSelector(getConfig).EnableTutorial === 'true';

    const tutorialStep = useSelector((state: GlobalState) => getInt(state, TutorialTourName.WORK_TEMPLATE_TUTORIAL, currentUserId, 0));

    const workTemplateTourTipShown = tutorialStep === WorkTemplateTourSteps.FINISHED;

    const channelLinkedItems = useSelector(getWorkTemplatesLinkedProducts);

    const boardsCount = channelLinkedItems?.boards || 0;
    const playbooksCount = channelLinkedItems?.playbooks || 0;
    const channelId = channelLinkedItems?.channelId || null;

    const showProductTour = channelId && channelId === currentChannelId && !workTemplateTourTipShown && enableTutorial;

    const showBoardsTour = showProductTour && pluginId === suitePluginIds.boards && boardsCount > 0;
    const showPlaybooksTour = showProductTour && pluginId === suitePluginIds.playbooks && playbooksCount > 0;

    return {
        showBoardsTour,
        showPlaybooksTour,
        boardsCount,
        playbooksCount,
        showProductTour,
    };
};
