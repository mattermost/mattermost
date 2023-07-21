// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TourTip, useMeasurePunchouts} from '@mattermost/components';
import React, {memo, useCallback, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {useHistory, useRouteMatch} from 'react-router-dom';

import {setDraftsTourTipPreference} from 'actions/views/drafts';
import {Preferences} from 'mattermost-redux/constants';
import {showDraftsPulsatingDotAndTourTip} from 'selectors/drafts';

import Tag from 'components/widgets/tag/tag';

const title = (
    <span className='d-flex align-items-center'>
        <FormattedMessage
            id='drafts.tutorialTip.title'
            defaultMessage='Drafts'
        />
        <Tag
            variant='success'
            text={(
                <FormattedMessage
                    id='tag.default.new'
                    defaultMessage='NEW'
                />
            )}
        />
    </span>
);

const screen = (
    <>
        <FormattedMessage
            id='drafts.tutorialTip.description'
            defaultMessage='With the new Drafts view, all of your unfinished messages are collected in one place. Return here to read, edit, or send draft messages.'
        />
    </>

);

const prevBtn = (
    <FormattedMessage
        id='drafts.tutorial_tip.notNow'
        defaultMessage='Not now'
    />
);

const nextBtn = (
    <FormattedMessage
        id='drafts.tutorial_tip.viewDrafts'
        defaultMessage='View drafts'
    />
);

const DraftsTourTip = () => {
    const dispatch = useDispatch();
    const history = useHistory();

    const showTip = useSelector(showDraftsPulsatingDotAndTourTip);
    const {url} = useRouteMatch();
    const nextUrl = `${url}/drafts`;

    const [tipOpened, setTipOpened] = useState(showTip);

    const handleDismiss = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        dispatch(setDraftsTourTipPreference({[Preferences.DRAFTS_TOUR_TIP_SHOWED]: true}));
        setTipOpened(false);
    }, []);

    const handleNext = useCallback(() => {
        dispatch(setDraftsTourTipPreference({[Preferences.DRAFTS_TOUR_TIP_SHOWED]: true}));
        setTipOpened(false);
        history.push(nextUrl);
    }, []);

    const handleOpen = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();

        if (tipOpened) {
            dispatch(setDraftsTourTipPreference({[Preferences.DRAFTS_TOUR_TIP_SHOWED]: true}));
            setTipOpened(false);
        } else {
            setTipOpened(true);
        }
    }, []);

    const overlayPunchOut = useMeasurePunchouts(['sidebar-drafts-button'], []);

    return (
        <>
            {
                (showTip) &&
                <TourTip
                    show={tipOpened}
                    screen={screen}
                    title={title}
                    overlayPunchOut={overlayPunchOut}
                    placement='right-start'
                    pulsatingDotPlacement='right'
                    step={1}
                    singleTip={true}
                    showOptOut={false}
                    interactivePunchOut={false}
                    handleDismiss={handleDismiss}
                    handleNext={handleNext}
                    handleOpen={handleOpen}
                    handlePrevious={handleDismiss}
                    nextBtn={nextBtn}
                    prevBtn={prevBtn}
                />
            }
        </>
    );
};

export default memo(DraftsTourTip);
