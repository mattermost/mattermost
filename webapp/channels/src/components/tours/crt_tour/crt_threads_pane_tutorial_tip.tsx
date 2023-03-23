// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {Constants, Preferences} from 'utils/constants';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';
import {savePreferences} from 'mattermost-redux/actions/preferences';

import {TourTip, useMeasurePunchouts} from '@mattermost/components';

const translate = {x: 2, y: 25};

const CRTThreadsPaneTutorialTip = () => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const currentUserId = useSelector(getCurrentUserId);
    const title = (
        <FormattedMessage
            id='tutorial_threads.threads_pane.title'
            defaultMessage={'Viewing a thread in the sidebar'}
        />
    );

    const screen = (
        <p>
            {formatMessage(
                {
                    id: 'tutorial_threads.threads_pane.description',
                    defaultMessage: 'Click the <b>Follow</b> button to be notified about replies and see it in your <b>Threads</b> view. Within a thread, the <b>New Messages</b> line shows you where you left off.',
                },
                {
                    b: (value: string) => <b>{value}</b>,
                },
            )}
        </p>
    );

    const nextBtn = (): JSX.Element => {
        return (
            <FormattedMessage
                id={'tutorial_tip.got_it'}
                defaultMessage={'Got it'}
            />
        );
    };

    const onDismiss = (e: React.MouseEvent) => {
        e.preventDefault();
        const preferences = [
            {
                user_id: currentUserId,
                category: Preferences.CRT_THREAD_PANE_STEP,
                name: currentUserId,
                value: Constants.CrtThreadPaneSteps.FINISHED.toString(),
            },
        ];
        dispatch(savePreferences(currentUserId, preferences));
    };

    const overlayPunchOut = useMeasurePunchouts(['rhsContainer'], []);

    return (
        <TourTip
            show={true}
            screen={screen}
            title={title}
            overlayPunchOut={overlayPunchOut}
            placement='left'
            pulsatingDotPlacement='top-start'
            pulsatingDotTranslate={translate}
            step={1}
            singleTip={true}
            showOptOut={false}
            handleDismiss={onDismiss}
            handleNext={onDismiss}
            interactivePunchOut={true}
            nextBtn={nextBtn()}
        />
    );
};

export default CRTThreadsPaneTutorialTip;
