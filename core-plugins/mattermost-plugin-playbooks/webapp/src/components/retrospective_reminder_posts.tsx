// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import {DateTime} from 'luxon';
import styled from 'styled-components';

import {Post} from '@mattermost/types/posts';

import {getPostsInCurrentChannel} from 'mattermost-redux/selectors/entities/posts';

import {GlobalState} from '@mattermost/types/store';

import {currentPlaybookRun} from 'src/selectors';

import {navigateToPluginUrl} from 'src/browser_routing';

import {noRetrospective} from 'src/client';

import {
    CustomPostButtonRow,
    CustomPostContainer,
    CustomPostContent,
    CustomPostHeader,
} from 'src/components/custom_post_styles';

import {Timestamp} from 'src/webapp_globals';

import ClipboardChecklist from 'src/components/assets/illustrations/clipboard_checklist_svg';

import {PrimaryButton, TertiaryButton} from './assets/buttons';
import {FutureTimeSpec} from './rhs/rhs_post_update';

const Divider = styled.div`
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    margin-top: 12px;
    margin-bottom: 12px;
`;

const ReminderText = styled.div`
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-size: 14px;
    line-height: 20px;
`;

const StyledTertiaryButton = styled(TertiaryButton)`
    margin-left: 10px;
`;

const IllustrationContainer = styled.div`
    padding: 12px;
`;

interface ReminderCommonProps {
    header: string
    primary: string
    secondary: string
    post: Post
}

const selectLatestReminderPost = (state: GlobalState) => getPostsInCurrentChannel(state)?.find((value: Post) => value.type?.startsWith('custom_retro'));

const ReminderCommon = (props: ReminderCommonProps) => {
    const playbookRun = useSelector(currentPlaybookRun);
    const reminderDuration = playbookRun?.retrospective_reminder_interval_seconds || 0;
    const wasPublishedOrCanceled = playbookRun?.retrospective_published_at !== 0;
    const latestReminderPost = useSelector(selectLatestReminderPost);

    const disableButtons = wasPublishedOrCanceled || latestReminderPost?.id !== props.post.id;

    let reminderText = (
        <FormattedMessage defaultMessage='You will not be reminded again.'/>
    );
    if (reminderDuration !== 0) {
        reminderText = (
            <FormattedMessage
                defaultMessage='A reminder will be sent <b>{timestamp}</b>'
                values={{
                    b: (x: React.ReactNode) => <b>{x}</b>,
                    timestamp: (
                        <Timestamp
                            value={DateTime.now().plus({seconds: reminderDuration}).toJSDate()}
                            units={FutureTimeSpec}
                            useTime={false}
                        />
                    ),
                }}
            />
        );
    }

    return (
        <CustomPostContainer data-testid={'retrospective-reminder'}>
            <CustomPostContent>
                <CustomPostHeader>
                    {props.header}
                </CustomPostHeader>
                <CustomPostButtonRow>
                    <PrimaryButton
                        onClick={() => playbookRun && navigateToPluginUrl(`/runs/${playbookRun.id}/retrospective`)}
                        disabled={disableButtons}
                    >
                        {props.primary}
                    </PrimaryButton>
                    <StyledTertiaryButton
                        onClick={() => playbookRun && noRetrospective(playbookRun.id)}
                        disabled={disableButtons}
                    >
                        {props.secondary}
                    </StyledTertiaryButton>
                </CustomPostButtonRow>
                <Divider/>
                <ReminderText>
                    {reminderText}
                </ReminderText>
            </CustomPostContent>
            <IllustrationContainer>
                <ClipboardChecklist/>
            </IllustrationContainer>
        </CustomPostContainer>
    );
};

export const RetrospectiveFirstReminder = (props: {post: Post}) => {
    const {formatMessage} = useIntl();
    return (
        <ReminderCommon
            post={props.post}
            header={formatMessage({defaultMessage: 'Would you like to fill out the retrospective report?'})}
            primary={formatMessage({defaultMessage: 'Yes, start retrospective'})}
            secondary={formatMessage({defaultMessage: 'No, skip retrospective'})}
        />
    );
};

export const RetrospectiveReminder = (props: {post: Post}) => {
    const {formatMessage} = useIntl();
    return (
        <ReminderCommon
            post={props.post}
            header={formatMessage({defaultMessage: 'Reminder to fill out the retrospective'})}
            primary={formatMessage({defaultMessage: 'Start retrospective'})}
            secondary={formatMessage({defaultMessage: 'Skip retrospective'})}
        />
    );
};
