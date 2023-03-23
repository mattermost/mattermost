// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {Placement} from 'tippy.js';

import {setAutoShowLinkedBoardPreference} from 'mattermost-redux/actions/boards';

import {TourTip} from '@mattermost/components';
import {shouldShowAutoLinkedBoard} from 'selectors/plugins';
import {suitePluginIds} from 'utils/constants';
import {getPluggableId} from 'selectors/rhs';
import {PluginComponent} from 'types/store/plugins';
import {GlobalState} from 'types/store';

type Props = {
    pulsatingDotPlacement?: Omit<Placement, 'auto'| 'auto-end'>;
}

const AutoShowLinkedBoardTourTip = ({
    pulsatingDotPlacement = 'auto',
}: Props): JSX.Element | null => {
    const dispatch = useDispatch();

    const rhsPlugins: PluginComponent[] = useSelector((state: GlobalState) => state.plugins.components.RightHandSidebarComponent);
    const pluggableId = useSelector(getPluggableId);
    const pluginComponent = rhsPlugins.find((element: PluginComponent) => element.id === pluggableId);

    const isBoards = pluginComponent && (pluginComponent.pluginId === suitePluginIds.focalboard || pluginComponent.pluginId === suitePluginIds.boards);
    const showAutoLinkedBoard = useSelector(shouldShowAutoLinkedBoard);
    const showAutoLinkedBoardTourTip = isBoards && showAutoLinkedBoard;

    const title = (
        <FormattedMessage
            id='autoShowLinkedBoard.tutorialTip.title'
            defaultMessage='Link kanban boards to channels'
        />
    );

    const screen = (
        <FormattedMessage
            id='autoShowLinkedBoard.tutorialTip.description'
            defaultMessage='Manage tasks, plan sprints, conduct standup with the help of kanban boards and tables.'
        />
    );

    const handleDismiss = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        dispatch(setAutoShowLinkedBoardPreference());
    }, []);

    const handleOpen = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        dispatch(setAutoShowLinkedBoardPreference());
    }, []);

    const nextBtn = (
        <FormattedMessage
            id={'tutorial_tip.done'}
            defaultMessage={'Done'}
        />
    );

    if (!showAutoLinkedBoardTourTip) {
        return null;
    }

    return (
        <TourTip
            show={true}
            screen={screen}
            title={title}
            overlayPunchOut={null}
            placement='left-start'
            pulsatingDotPlacement={pulsatingDotPlacement}
            step={1}
            singleTip={true}
            showOptOut={false}
            interactivePunchOut={true}
            handleDismiss={handleDismiss}
            handleOpen={handleOpen}
            handlePrevious={handleDismiss}
            pulsatingDotTranslate={{x: -10, y: 70}}
            tippyBlueStyle={true}
            hideBackdrop={true}
            nextBtn={nextBtn}
            handleNext={handleDismiss}
        />
    );
};

export default AutoShowLinkedBoardTourTip;
