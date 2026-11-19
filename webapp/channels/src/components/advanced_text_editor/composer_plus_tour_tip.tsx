// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';
import {getInt} from 'mattermost-redux/selectors/entities/preferences';

import AnchoredTourPoint from 'components/tour_point/anchored_tour_point';

import type {GlobalState} from 'types/store';

export const COMPOSER_PLUS_TOUR_TIP_PREFERENCE = 'composer_plus_tour_tip';

export function hasSeenComposerPlusTourTip(state: GlobalState): boolean {
    const currentUserId = getCurrentUserId(state);
    return getInt(state, COMPOSER_PLUS_TOUR_TIP_PREFERENCE, currentUserId, 0) === 1;
}

const title = (
    <FormattedMessage
        id='textbox.plus_tour.title'
        defaultMessage='Message options moved here'
    />
);

const closedBarScreen = (
    <FormattedMessage
        id='textbox.plus_tour.description'
        defaultMessage='Attach files, add an emoji, set a priority, and open formatting from this button. Skills and AI rewrite show up here when they are available.'
    />
);

const openBarScreen = (
    <FormattedMessage
        id='textbox.plus_tour.description_formatting_open'
        defaultMessage='Attach files from this button. Emoji and message priority are in the formatting bar. Skills and AI rewrite show up here when they are available.'
    />
);

const nextBtn = (
    <FormattedMessage
        id='tutorial_tip.got_it'
        defaultMessage='Got it'
    />
);

type Props = {
    formattingBarOpen: boolean;
};

const ComposerPlusTourTip = ({formattingBarOpen}: Props) => {
    const dispatch = useDispatch();
    const intl = useIntl();
    const currentUserId = useSelector(getCurrentUserId);

    const markSeen = useCallback(() => {
        dispatch(savePreferences(currentUserId, [{
            user_id: currentUserId,
            category: COMPOSER_PLUS_TOUR_TIP_PREFERENCE,
            name: currentUserId,
            value: '1',
        }]));
    }, [currentUserId, dispatch]);

    return (
        <AnchoredTourPoint
            anchorId='agentComposerMenuButton'
            aim='corner'
            testId='composer-plus-tour'
            title={title}
            closeLabel={intl.formatMessage({id: 'tutorial_tip.close', defaultMessage: 'Close'})}
            onClose={markSeen}
            primaryAction={{label: nextBtn, onClick: markSeen}}
        >
            {formattingBarOpen ? openBarScreen : closedBarScreen}
        </AnchoredTourPoint>
    );
};

export default ComposerPlusTourTip;
