// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {CSSProperties, useEffect, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';
import {ContainerProps, components} from 'react-select';

import {Post} from '@mattermost/types/posts';
import {GlobalState} from '@mattermost/types/store';
import {Channel} from '@mattermost/types/channels';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {Team} from '@mattermost/types/teams';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';
import {ApolloProvider, useQuery} from '@apollo/client';

import {getPlaybooksGraphQLClient} from 'src/graphql_client';
import PostText from 'src/components/post_text';
import {PrimaryButton} from 'src/components/assets/buttons';
import {promptUpdateStatus} from 'src/actions';
import {resetReminder} from 'src/client';
import {CustomPostContainer} from 'src/components/custom_post_styles';
import {
    Mode,
    Option,
    ms,
    useMakeOption,
} from 'src/components/datetime_input';
import {nearest} from 'src/utils';
import {StyledSelect} from 'src/components/backstage/styles';
import {useClientRect} from 'src/hooks';
import {graphql} from 'src/graphql/generated';
import {PlaybookRunReminderQuery} from 'src/graphql/generated/graphql';

interface Props {
    post: Post;
}

const playbookRunReminderQuery = graphql(/* GraphQL */`
    query PlaybookRunReminder($runID: String!) {
        run (id: $runID){
            id
            name
            previousReminder
            reminderTimerDefaultSeconds
        }
    }
`);

const firstActiveRunInChannelQuery = graphql(/* GraphQL */`
    query FirstActiveRunInChannel($channelID: String!) {
        runs(
            channelID: $channelID,
            statuses: ["InProgress"],
            first: 1,
        ) {
            edges {
                node {
                    id
                    name
                    previousReminder
                    reminderTimerDefaultSeconds
                }
            }
        }
    }
`);

const UpdateRequestPost = (props: Props) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const channel = useSelector<GlobalState, Channel>((state) => getChannel(state, props.post.channel_id));
    const team = useSelector<GlobalState, Team>((state) => getTeam(state, channel.team_id));
    const targetUsername = props.post.props.targetUsername ?? '';
    const playbookRunId = props.post.props.playbookRunId;

    const [run, setRun] = useState<PlaybookRunReminderQuery['run']>(null);
    const {data, loading} = useQuery(playbookRunReminderQuery, {
        variables: {
            runID: playbookRunId,
        },
        fetchPolicy: 'network-only',
        skip: playbookRunId === undefined,
    });

    const {data: firstRunInChannelData} = useQuery(firstActiveRunInChannelQuery, {
        variables: {
            channelID: props.post.channel_id,
        },
        fetchPolicy: 'network-only',
        skip: playbookRunId !== undefined,
    });

    useEffect(() => {
        if (data && !loading) {
            setRun(data?.run);
        }

        // If playbookRunId is undefined (could be in old existent reminders), we need this fallback
        // to get all runs for the channel and take the first one (will be enough for
        // old one-run-per-channel cases but without post props)
        //
        // Since posts are removed after post-update or snooze, this fallback will be unused with the
        // pass of time. However, the only way the to check that the fallback is not needed is executing
        // an SQL query.
        if (!data && !loading && firstRunInChannelData && firstRunInChannelData.runs.edges.length > 0) {
            setRun(firstRunInChannelData.runs.edges[0]?.node);
        }
    }, [data, loading, firstRunInChannelData, props.post.channel_id]);

    // Decide whether to open the snooze menu above or below
    const [snoozeMenuPos, setSnoozeMenuPos] = useState('top');
    const [rect, ref] = useClientRect();
    useEffect(() => {
        if (!rect) {
            return;
        }

        setSnoozeMenuPos((rect.top < 250) ? 'bottom' : 'top');
    }, [rect]);

    const makeOption = useMakeOption(Mode.DurationValue);

    if (!run) {
        return (
            <StyledPostText
                text={props.post.message}
                team={team}
            />
        );
    }

    const options = [
        makeOption({minutes: 60}),
        makeOption({hours: 24}),
        makeOption({days: 7}),
    ];
    const pushIfNotIn = (option: Option) => {
        if (!options.find((o) => ms(option.value) === ms(o.value))) {
            // option doesn't already exist
            options.push(option);
        }
    };
    if (run.previousReminder) {
        pushIfNotIn(makeOption({seconds: nearest(run.previousReminder * 1e-9, 1)}));
    }
    if (run.reminderTimerDefaultSeconds) {
        pushIfNotIn(makeOption({seconds: run.reminderTimerDefaultSeconds}));
    }
    options.sort((a, b) => ms(a.value) - ms(b.value));

    const snoozeFor = (option: Option) => {
        resetReminder(run.id, ms(option.value) / 1000);
    };

    const SelectContainer = ({children, ...ownProps}: ContainerProps<Option, boolean>) => {
        return (
            <components.SelectContainer
                {...ownProps}

                // @ts-ignore
                innerProps={{...ownProps.innerProps, role: 'button'}}
            >
                {children}
            </components.SelectContainer>
        );
    };

    const playbookRunURL = `/playbooks/runs/${run.id}`;

    return (
        <>
            <StyledPostText
                text={formatMessage({defaultMessage: '@{targetUsername}, please provide a status update for [{runName}]({playbookURL}).'}, {runName: run.name, targetUsername, playbookURL: playbookRunURL})}
                team={team}
            />
            <Container ref={ref}>
                <PostUpdatePrimaryButton
                    onClick={() => {
                        dispatch(promptUpdateStatus(
                            team.id,
                            run.id,
                            props.post.channel_id,
                        ));
                    }}
                >
                    {formatMessage({defaultMessage: 'Post update'})}
                </PostUpdatePrimaryButton>
                <SelectWrapper
                    filterOption={null}
                    isMulti={false}
                    menuPlacement={snoozeMenuPos}
                    components={{
                        IndicatorSeparator: () => null,
                        SelectContainer,
                    }}
                    placeholder={formatMessage({defaultMessage: 'Snooze for…'})}
                    options={options}
                    onChange={snoozeFor}
                    menuPortalTarget={document.body}
                    styles={{
                        control: (base: CSSProperties) => ({
                            ...base,
                            height: '40px',
                            minWidth: '100px',
                        }),
                        menuPortal: (base: CSSProperties) => ({
                            ...base,
                            minWidth: '168px',
                            zIndex: 22,
                        }),
                    }}
                />
            </Container>
        </>
    );
};

const SelectWrapper = styled(StyledSelect)`
    margin: 4px;
`;

const PostUpdatePrimaryButton = styled(PrimaryButton)`
    justify-content: center;
    flex: 1;
    margin: 4px;
    white-space: nowrap;
`;

const Container = styled(CustomPostContainer)`
    display: flex;
    flex-direction: row;
    padding: 12px;
    flex-wrap: wrap;
    max-width: 440px;
`;

const StyledPostText = styled(PostText)`
    margin-bottom: 8px;
`;

const ApolloWrappedPost = (props: Props) => {
    const client = getPlaybooksGraphQLClient();
    return <ApolloProvider client={client}><UpdateRequestPost {...props}/></ApolloProvider>;
};

export default ApolloWrappedPost;
