// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';
import {OverlayTrigger, Tooltip} from 'react-bootstrap';
import {useIntl} from 'react-intl';
import {Placement} from '@floating-ui/react-dom-interactions';
import {GlobalState} from '@mattermost/types/store';

import {OVERLAY_DELAY} from 'src/constants';
import {InvertedTertiaryButton} from 'src/components/assets/buttons';

interface Props {
    className?: string;
    tooltipPlacement?: Placement;
}

const GiveFeedbackButton = ({className, tooltipPlacement}: Props) => {
    const serverVersion = useSelector((state: GlobalState) => state.entities.general.serverVersion);
    const {formatMessage} = useIntl();

    const tooltip = (
        <Tooltip id='give_feedback_about_playbooks'>
            {formatMessage({defaultMessage: 'Give feedback about Playbooks.'})}
        </Tooltip>
    );

    const giveFeedbackURL = new URL('https://mattermost.com/pl/playbooks-feedback');
    const searchParams = giveFeedbackURL.searchParams;

    // Set the 'Server Version' field on the linked Google Form. (If we move to a different
    // form platform, we'll need to preserve backwards compatibility.)
    searchParams.set('entry.796122893', serverVersion);
    giveFeedbackURL.search = searchParams.toString();

    return (
        <OverlayTrigger
            trigger={['hover', 'focus']}
            delay={OVERLAY_DELAY}
            placement={tooltipPlacement || 'bottom'}
            overlay={tooltip}
            aria-label={formatMessage({defaultMessage: 'Give feedback about Playbooks.'})}

        >
            <InvertedTertiaryButton
                as='a'
                target='_blank'
                href={giveFeedbackURL.toString()}
                className={className}
            >
                {formatMessage({defaultMessage: 'Give feedback'})}
            </InvertedTertiaryButton>
        </OverlayTrigger>
    );
};

export default GiveFeedbackButton;
