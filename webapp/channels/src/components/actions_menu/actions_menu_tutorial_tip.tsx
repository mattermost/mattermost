// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TourTip} from '@mattermost/components';
import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';

const translate = {x: 6, y: -16};

type Props = {
    handleNext: (e: React.MouseEvent) => void;
    handleOpen: (e: React.MouseEvent) => void;
    handleDismiss: () => void;
    showTip: boolean;
}

const title = (
    <FormattedMessage
        id='post_info.actions.tutorialTip.title'
        defaultMessage='Actions for messages'
    />
);
const screen = (
    <FormattedMessage
        id='post_info.actions.tutorialTip'
        defaultMessage='Message actions that are provided\nthrough apps, integrations or plugins\nhave moved to this menu item.'
    />
);
const nextBtn = (
    <FormattedMessage
        id={'tutorial_tip.got_it'}
        defaultMessage={'Got it'}
    />
);

export const ActionsTutorialTip = ({handleOpen, handleDismiss, handleNext, showTip}: Props) => {
    const onDismiss = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        handleDismiss();
    }, [handleDismiss]);

    const onNext = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        handleNext(e);
    }, [handleNext]);

    return (
        <TourTip
            show={showTip}
            screen={screen}
            title={title}
            overlayPunchOut={null}
            placement='top'
            pulsatingDotPlacement='left'
            pulsatingDotTranslate={translate}
            step={1}
            singleTip={true}
            showOptOut={false}
            interactivePunchOut={true}
            handleDismiss={onDismiss}
            handleNext={onNext}
            handleOpen={handleOpen}
            nextBtn={nextBtn}
        />
    );
};
