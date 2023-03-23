// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {OverlayTrigger, Tooltip} from 'react-bootstrap';
import {useIntl} from 'react-intl';

import {useRunFollowers, useRunMetadata} from 'src/hooks';
import LeftChevron from 'src/components/assets/icons/left_chevron';
import FollowButton from 'src/components/backstage/follow_button';
import ExternalLink from 'src/components/assets/icons/external_link';
import {pluginUrl} from 'src/browser_routing';
import {OVERLAY_DELAY} from 'src/constants';

import {
    RHSTitleButton,
    RHSTitleContainer,
    RHSTitleLink,
    RHSTitleStyledButtonIcon,
} from './rhs_title_common';

interface Props {
    onBackClick: () => void;
    runID: string;
}

const RHSRunDetailsTitle = (props: Props) => {
    const {formatMessage} = useIntl();

    const [metadata] = useRunMetadata(props.runID);
    const followState = useRunFollowers(metadata?.followers || []);

    const tooltip = (
        <Tooltip id={'view-run-overview'}>
            {formatMessage({defaultMessage: 'View run overview'})}
        </Tooltip>
    );

    return (
        <RHSTitleContainer>
            <RHSTitleButton
                onClick={props.onBackClick}
                data-testid='back-button'
            >
                <LeftChevron/>
            </RHSTitleButton>

            <OverlayTrigger
                placement={'top'}
                delay={OVERLAY_DELAY}
                overlay={tooltip}
            >
                <RHSTitleLink
                    data-testid='rhs-title'
                    role={'button'}
                    to={pluginUrl(`/runs/${props.runID}?from=channel_rhs_title`)}
                >
                    {formatMessage({defaultMessage: 'Run details'})}
                    <RHSTitleStyledButtonIcon>
                        <ExternalLink/>
                    </RHSTitleStyledButtonIcon>
                </RHSTitleLink>
            </OverlayTrigger>
            <FollowingWrapper>
                <FollowButton
                    runID={props.runID}
                    followState={metadata ? followState : undefined}
                    trigger={'channel_rhs'}
                />
            </FollowingWrapper>
        </RHSTitleContainer>
    );
};

const FollowingWrapper = styled.div`
    display: flex;
    justify-content: flex-end;
    flex: 1;

    // override default styles
    .unfollowButton {
        border: 0;
        color: var(--button-bg);
        background: rgba(var(--button-bg-rgb), 0.08);
    }

    .followButton {
        border: 0;
        color: rgba(var(--center-channel-color-rgb), 0.56);
        background: transparent;

        &:hover {
            color: rgba(var(--center-channel-color-rgb), 0.72);
            background: rgba(var(--center-channel-color-rgb), 0.08);
        }
    }
`;

export default RHSRunDetailsTitle;
