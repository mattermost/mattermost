// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';
import {OverlayTrigger, Tooltip} from 'react-bootstrap';
import styled from 'styled-components';
import {DateTime} from 'luxon';

import {
    AccountPlusOutlineIcon,
    CheckIcon,
    FlagCheckeredIcon,
    FlagOutlineIcon,
} from '@mattermost/compass-icons/components';

import {PlaybookRun} from 'src/types/playbook_run';
import {PlaybookRunType} from 'src/graphql/generated/graphql';
import {finishRun} from 'src/actions';
import {PrimaryButton, TertiaryButton} from 'src/components/assets/buttons';
import {Timestamp} from 'src/webapp_globals';
import {OVERLAY_DELAY} from 'src/constants';

import {ChecklistParent} from './rhs_checklist_list';

interface RHSFooterProps {
    playbookRun: PlaybookRun | null;
    parentContainer?: ChecklistParent;
    active: boolean;
    finished: boolean;
    canModify: boolean;
    canRestore: boolean;
    isParticipant: boolean;
    showParticipateConfirm: () => void;
    handleResume: () => void;
    onBackClick?: () => void;
}

const RHSFooter = ({
    playbookRun,
    parentContainer,
    active,
    finished,
    canModify,
    canRestore,
    isParticipant,
    showParticipateConfirm,
    handleResume,
    onBackClick,
}: RHSFooterProps) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    // Only show footers in RHS
    if (parentContainer !== ChecklistParent.RHS || !playbookRun) {
        return null;
    }

    // Priority 1: Show ParticipatePrompt if active and not a participant
    if (active && !isParticipant) {
        return (
            <ParticipatePrompt>
                <ParticipateContent>
                    <ParticipateText>{formatMessage({defaultMessage: 'Join to make changes or interact'})}</ParticipateText>
                    <ParticipateRightWrapper>
                        <OverlayTrigger
                            placement='top'
                            delay={OVERLAY_DELAY}
                            overlay={
                                <Tooltip id='participate-tooltip'>
                                    {formatMessage({defaultMessage: 'Join as a participant'})}
                                </Tooltip>
                            }
                        >
                            <ParticipateButton onClick={showParticipateConfirm}>
                                <AccountPlusOutlineIcon size={16}/>
                                {formatMessage({defaultMessage: 'Join'})}
                            </ParticipateButton>
                        </OverlayTrigger>
                    </ParticipateRightWrapper>
                </ParticipateContent>
            </ParticipatePrompt>
        );
    }

    // Priority 2: Show FinishPrompt if active and can modify
    if (active && canModify) {
        return (
            <FinishPrompt>
                <FinishContent>
                    <FinishIconWrapper>
                        <FlagOutlineIcon size={24}/>
                    </FinishIconWrapper>
                    <FinishText>{formatMessage({defaultMessage: 'Time to wrap up?'})}</FinishText>
                    <FinishRightWrapper>
                        <FinishButton
                            onClick={() => {
                                dispatch(finishRun(playbookRun.team_id, playbookRun.id));
                            }}
                        >
                            <CheckIcon size={16}/>
                            {formatMessage({defaultMessage: 'Finish'})}
                        </FinishButton>
                    </FinishRightWrapper>
                </FinishContent>
            </FinishPrompt>
        );
    }

    // Priority 3: Show FinishedFooter if finished
    if (finished) {
        return (
            <FinishedFooter>
                <FinishedIndicator>
                    <IconWrapper>
                        <FlagCheckeredIcon size={34}/>
                    </IconWrapper>
                    <FinishedNotice>
                        <FinishedPretext>
                            {formatMessage({defaultMessage: 'Finished'})}
                        </FinishedPretext>
                        <FinishedTime>
                            <Timestamp
                                value={DateTime.fromMillis(playbookRun.end_at).toJSDate()}
                                units={[
                                    {within: ['second', -45], display: formatMessage({defaultMessage: 'just now'})},
                                    ['minute', -59],
                                    ['hour', -48],
                                    ['day', -30],
                                    ['month', -12],
                                    'year',
                                ]}
                                useTime={false}
                            />
                        </FinishedTime>
                    </FinishedNotice>
                    <FinishedRightWrapper>
                        {canRestore ? (
                            <ResumeButton
                                onClick={handleResume}
                                disabled={false}
                            >
                                {playbookRun.type === PlaybookRunType.ChannelChecklist ? formatMessage({defaultMessage: 'Resume'}) : formatMessage({defaultMessage: 'Restart'})
                                }
                            </ResumeButton>
                        ) : (
                            <OverlayTrigger
                                placement='top'
                                delay={OVERLAY_DELAY}
                                overlay={
                                    <Tooltip id='resume-disabled-tooltip'>
                                        {playbookRun.type === PlaybookRunType.ChannelChecklist ? formatMessage({defaultMessage: 'Join as a participant to resume'}) : formatMessage({defaultMessage: 'Join as a participant to restart'})
                                        }
                                    </Tooltip>
                                }
                            >
                                <ResumeButtonWrapper>
                                    <ResumeButton
                                        onClick={handleResume}
                                        disabled={true}
                                    >
                                        {playbookRun.type === PlaybookRunType.ChannelChecklist ? formatMessage({defaultMessage: 'Resume'}) : formatMessage({defaultMessage: 'Restart'})
                                        }
                                    </ResumeButton>
                                </ResumeButtonWrapper>
                            </OverlayTrigger>
                        )}
                    </FinishedRightWrapper>
                </FinishedIndicator>
                <DoneButtonContainer>
                    <StyledPrimaryButton
                        onClick={() => {
                            if (onBackClick) {
                                onBackClick();
                            }
                        }}
                    >
                        {formatMessage({defaultMessage: 'Done'})}
                    </StyledPrimaryButton>
                </DoneButtonContainer>
            </FinishedFooter>
        );
    }

    return null;
};

const FinishedFooter = styled.div`
    position: sticky;
    bottom: 0;
    display: flex;
    flex-direction: column;
    margin-top: auto;
    padding-top: 24px;
    background: linear-gradient(
        to bottom,
        transparent 0%,
        var(--center-channel-bg) 20%,
        var(--center-channel-bg) 100%
    );
    padding-bottom: 12px;
    z-index: 10;
    pointer-events: none;

    & > * {
        pointer-events: all;
    }
`;

const FinishedIndicator = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 12px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 4px;
    background-color: var(--center-channel-bg);
`;

const IconWrapper = styled.span`
    display: flex;
    width: 48px;
    align-items: center;
    justify-content: center;
`;

const FinishedNotice = styled.div`
    display: flex;
    flex-direction: column;
    padding: 0;
    margin-left: 4px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-size: 12px;
    line-height: 16px;
`;

const FinishedPretext = styled.div`
    font-weight: 400;
`;

const FinishedTime = styled.div`
    font-weight: 600;
    font-size: 16px;
    line-height: 24px;
`;

const FinishedRightWrapper = styled.div`
    display: flex;
    flex: 1;
    justify-content: flex-end;
    align-items: center;
`;

const ResumeButton = styled(TertiaryButton)`
    height: 32px;
    padding: 0 20px;
    font-size: 12px;
`;

const ResumeButtonWrapper = styled.div`
    display: inline-block;
`;

const DoneButtonContainer = styled.div`
    display: flex;
    margin: 12px 0 0;

    button {
        width: 100%;
    }
`;

const StyledPrimaryButton = styled(PrimaryButton)`
    padding: 10px 20px;
`;

const FinishPrompt = styled.div`
    display: flex;
    flex-direction: column;
    margin-top: auto;
    padding-top: 24px;
`;

const FinishContent = styled.div`
    display: flex;
    height: 56px;
    flex-direction: row;
    align-items: center;
    padding: 12px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 4px;
`;

const FinishIconWrapper = styled.div`
    display: flex;
    margin-left: 4px;
    color: rgba(var(--center-channel-color-rgb), 0.32);
`;

const FinishText = styled.div`
    display: flex;
    margin: 0 4px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-size: 14px;
    line-height: 20px;
`;

const FinishRightWrapper = styled.div`
    display: flex;
    flex: 1;
    justify-content: flex-end;
`;

const FinishButton = styled(TertiaryButton)`
    display: flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 16px;
    font-size: 12px;
`;

const ParticipatePrompt = styled.div`
    display: flex;
    flex-direction: column;
    margin-top: auto;
    padding-top: 24px;
`;

const ParticipateContent = styled.div`
    display: flex;
    height: 56px;
    flex-direction: row;
    align-items: center;
    padding: 12px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 4px;
    background: rgba(var(--center-channel-color-rgb), 0.04);
`;

const ParticipateText = styled.div`
    display: flex;
    margin: 0 12px 0 4px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-size: 14px;
    line-height: 20px;
`;

const ParticipateRightWrapper = styled.div`
    display: flex;
    flex: 1;
    justify-content: flex-end;
`;

const ParticipateButton = styled(PrimaryButton)`
    display: flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    font-size: 12px;
    padding: 0 16px;
`;

export default RHSFooter;
