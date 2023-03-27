import React from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import styled from 'styled-components';

import {Post} from '@mattermost/types/posts';
import {getChannel, getChannelsNameMapInCurrentTeam} from 'mattermost-redux/selectors/entities/channels';
import {Channel} from '@mattermost/types/channels';
import {GlobalState} from '@mattermost/types/store';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';
import {Team} from '@mattermost/types/teams';

import {PlaybookRunViewTarget} from 'src/types/telemetry';
import Tooltip from 'src/components/widgets/tooltip';
import PostText from 'src/components/post_text';
import {CustomPostContainer, CustomPostContent} from 'src/components/custom_post_styles';
import {formatText, messageHtmlToComponent} from 'src/webapp_globals';
import {ChannelNamesMap} from 'src/types/backstage';
import {useFormattedUsernameByID} from 'src/hooks/general';
import {useViewTelemetry} from 'src/hooks/telemetry';

interface Props {
    post: Post;
}

export const UpdatePost = (props: Props) => {
    const {formatMessage} = useIntl();
    const channel = useSelector<GlobalState, Channel>((state) => getChannel(state, props.post.channel_id));
    const team = useSelector<GlobalState, Team>((state) => getTeam(state, channel?.team_id));
    const channelNamesMap = useSelector<GlobalState, ChannelNamesMap>(getChannelsNameMapInCurrentTeam);

    const markdownOptions = {
        singleline: false,
        mentionHighlight: true,
        atMentions: true,
        team,
        channelNamesMap,
    };

    const messageHtmlToComponentOptions = {
        hasPluginTooltips: true,
    };

    const mdText = (text: string) => messageHtmlToComponent(formatText(text, markdownOptions), true, messageHtmlToComponentOptions);

    const numTasksChecked = props.post.props.numTasksChecked ?? 0;
    const numTasks = props.post.props.numTasks ?? 0;
    const authorUsername = props.post.props.authorUsername ?? '';

    const participantIDs = props.post.props.participantIds ?? [];
    const numParticipants = participantIDs.length;
    const participantUsernames = participantIDs.map(useFormattedUsernameByID).join(', ');

    const playbookRunId = props.post.props.playbookRunId ?? '';
    const overviewURL = `/playbooks/runs/${playbookRunId}`;
    const runName = props.post.props.runName ?? '';
    useViewTelemetry(PlaybookRunViewTarget.StatusUpdate, props.post.id, {
        post_id: props.post.id,
        channel_type: channel?.type || '', // not always available
        playbook_run_id: props.post.props.playbookRunId || '',
    });

    return (
        <>
            <StyledPostText
                text={formatMessage({defaultMessage: '@{authorUsername} posted an update for [{runName}]({overviewURL})'}, {
                    runName,
                    overviewURL,
                    authorUsername,
                })}
                team={team}
            />
            <FullWidthContainer>
                <FullWidthContent>
                    <TextBody>{mdText(props.post.message)}</TextBody>
                    <Separator/>
                    <Badges>
                        <Badge tooltipText={formatMessage({defaultMessage: 'Tasks'})}>
                            <BadgeIcon className={'icon-check-all icon-12'}/>
                            <span>
                                {formatMessage({defaultMessage: '<b>{numTasksChecked, number}</b> of <b>{numTasks, number}</b> {numTasks, plural, =1 {task} other {tasks}} checked'}, {b: (x) => <b>{x}</b>, numTasksChecked, numTasks})}
                            </span>
                        </Badge>
                        <BadgeSeparator/>
                        <Badge tooltipText={participantUsernames}>
                            <BadgeIcon className={'icon-account-multiple-outline icon-12'}/>
                            <span>
                                {formatMessage({defaultMessage: '{numParticipants, plural, =1 {<b>#</b> participant} other {<b>#</b> participants}}'}, {b: (x) => <b>{x}</b>, numParticipants})}
                            </span>
                        </Badge>
                    </Badges>
                </FullWidthContent>
            </FullWidthContainer>
        </>
    );
};

const FullWidthContainer = styled(CustomPostContainer)`
    max-width: 100%;
`;

const FullWidthContent = styled(CustomPostContent)`
    width: 100%;
`;

const TextBody = styled.div`
    width: 100%;
    margin-top: 4px;
    margin-bottom: 4px;
`;

const StyledPostText = styled(PostText)`
    margin-bottom: 8px;
`;

const Separator = styled.hr`
    &&& {
        border: none;
        height: 1px;
        background: rgba(var(--center-channel-color-rgb), 0.16);
        margin: 12px 0;
        opacity: 1;
    }
`;

const Badges = styled.div`
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
`;

interface BadgeProps {
    tooltipText: string;
    children: React.ReactNode;
}

const Badge = (props: BadgeProps) => {
    return (
        <Tooltip
            id={'custom-status-post-badge-' + props.tooltipText}
            content={props.tooltipText}
        >
            <BadgeContainer>
                {props.children}
            </BadgeContainer>
        </Tooltip>
    );
};

const BadgeContainer = styled.div`
    margin-right: 8px;

    display: inline-flex;
    align-items: center;

    svg {
        margin-right: 4px;
    }

    font-weight: normal;
    font-size: 11px;
    line-height: 16px;
    letter-spacing: 0.02em;

    color: rgba(var(--center-channel-color-rgb), 0.64);

    height: 24px;
`;

const BadgeSeparator = styled(BadgeContainer)`
    font-size: 14px;
    color: rgba(var(--center-channel-color-rgb), 0.24);

    :after{
        content: '•';
    }
`;

const BadgeIcon = styled.i`
    padding-bottom: 2px;
    margin-left: -4px;
`;
