// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {OverlayTrigger, Tooltip} from 'react-bootstrap';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {GlobalState} from '@mattermost/types/store';

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
    runName: string;
    isPlaybookRun: boolean;
}

const getCurrentChannelName = (state: GlobalState) => getCurrentChannel(state)?.display_name;

const RHSRunDetailsTitle = (props: Props) => {
    const {formatMessage} = useIntl();

    const [metadata] = useRunMetadata(props.runID);
    const followState = useRunFollowers(metadata?.followers || []);
    const currentChannelName = useSelector<GlobalState, string | undefined>(getCurrentChannelName);

    const tooltip = (
        <Tooltip id={'view-run-details'}>
            {formatMessage({defaultMessage: 'Go to overview'})}
        </Tooltip>
    );

    const backTooltip = (
        <Tooltip id={'back-to-checklists'}>
            {formatMessage({defaultMessage: 'Back to checklists'})}
        </Tooltip>
    );

    return (
        <RHSTitleContainer>
            <OverlayTrigger
                placement={'top'}
                delay={OVERLAY_DELAY}
                overlay={backTooltip}
            >
                <RHSTitleButton
                    onClick={props.onBackClick}
                    data-testid='back-button'
                >
                    <LeftChevron/>
                </RHSTitleButton>
            </OverlayTrigger>

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
                    {formatMessage({defaultMessage: 'Checklist'})}
                    <RHSTitleStyledButtonIcon>
                        <ExternalLink/>
                    </RHSTitleStyledButtonIcon>
                </RHSTitleLink>
            </OverlayTrigger>
            <VerticalLine/>
            <ChannelNameText>
                {currentChannelName}
            </ChannelNameText>
            {props.isPlaybookRun &&
            <FollowingWrapper>
                <FollowButton
                    runID={props.runID}
                    followState={metadata ? followState : undefined}
                />
            </FollowingWrapper>
            }
        </RHSTitleContainer>
    );
};

const VerticalLine = styled.div`
    height: 24px;
    border-left: 1px solid var(--center-channel-color);
    opacity: 0.16;
    margin: 0 8px;
`;

const ChannelNameText = styled.div`
    overflow: hidden;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-family: "Open Sans", sans-serif;
    font-size: 12px;
    font-weight: 400;
    line-height: 20px;
    text-overflow: ellipsis;
`;

const FollowingWrapper = styled.div`
    display: flex;
    flex: 1;
    justify-content: flex-end;

    /* override default styles */
    .unfollowButton {
        border: 0;
        background: rgba(var(--button-bg-rgb), 0.08);
        color: var(--button-bg);
    }

    .followButton {
        border: 0;
        background: transparent;
        color: rgba(var(--center-channel-color-rgb), 0.56);

        &:hover {
            background: rgba(var(--center-channel-color-rgb), 0.08);
            color: rgba(var(--center-channel-color-rgb), 0.72);
        }
    }
`;

export default RHSRunDetailsTitle;
