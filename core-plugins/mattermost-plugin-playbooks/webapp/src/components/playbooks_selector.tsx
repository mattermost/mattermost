// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import styled, {css} from 'styled-components';
import {useIntl} from 'react-intl';
import {ApolloProvider, useQuery} from '@apollo/client';
import {BookLockOutlineIcon, BookOutlineIcon, PlayOutlineIcon} from '@mattermost/compass-icons/components';
import Scrollbars from 'react-custom-scrollbars';
import {DateTime} from 'luxon';

import {FragmentType, getFragmentData, graphql} from 'src/graphql/generated';
import {getPlaybooksGraphQLClient} from 'src/graphql_client';

import {PrimaryButton, SecondaryButton} from 'src/components/assets/buttons';
import {PresetTemplate, PresetTemplates} from 'src/components/templates/template_data';
import {PlaybookPermissionGeneral} from 'src/types/permissions';
import {PlaybookPermissionsParams, useHasPlaybookPermission} from 'src/hooks';
import LoadingSpinner from 'src/components/assets/loading_spinner';
import {savePlaybook} from 'src/client';
import {setPlaybookDefaults} from 'src/types/playbook';

interface Props {
    teamID: string;
    channelID: string;
    searchTerm: string;

    /**
     * Callback that will be triggered when a playbook is selected to run.
     * For templates, a new playbook will be created first, then this callback is triggered with the new playbook ID.
     */
    onSelectPlaybook: (playbookId: string) => void;
}

const PlaybookModalFieldsFragment = graphql(/* GraphQL */`
    fragment PlaybookModalFields on Playbook {
        id
        title
        description
        is_favorite: isFavorite
        public
        team_id: teamID
        members {
            user_id: userID
            scheme_roles: schemeRoles
        }
        default_playbook_member_role: defaultPlaybookMemberRole
        last_run_at: lastRunAt
        active_runs: activeRuns
    }
`);

const PlaybooksModalQuery = graphql(/* GraphQL */`
    query PlaybooksModal($channelID: String!, $teamID: String!, $searchTerm: String!) {
        channelPlaybooks: 	runs(
            channelID: $channelID,
            first: 1000,
        ) {
            edges {
                node {
                    playbookID
                }
            }
        }
        yourPlaybooks: playbooks (teamID: $teamID, withMembershipOnly: true, searchTerm: $searchTerm) {
            id
            ...PlaybookModalFields
        }
        allPlaybooks: playbooks (teamID: $teamID, withMembershipOnly: false, searchTerm: $searchTerm) {
            id
            ...PlaybookModalFields
        }
    }
`);

const PlaybooksSelector = (props: Props) => {
    const {formatMessage} = useIntl();
    const {data, loading} = useQuery(PlaybooksModalQuery, {
        variables: {
            teamID: props.teamID,
            searchTerm: props.searchTerm,
            channelID: props.channelID,
        },
        fetchPolicy: 'cache-and-network',
    });

    // Prepare template list once on mount
    const templatesList = useMemo(() => PresetTemplates, []);

    // Groups are mutually exclusive
    // -> 1) YOUR PLAYBOOKS - playbooks the user is a member of
    // -> 2) PRE-BUILT PLAYBOOKS - preset templates
    const groups = useMemo(() => {
        const groupYours = data?.yourPlaybooks || [];

        return [
            {
                title: formatMessage({defaultMessage: 'YOUR PLAYBOOKS'}),
                list: groupYours,
                hideIfEmpty: true,
                isTemplates: false,
            },
            {
                title: formatMessage({defaultMessage: 'PRE-BUILT PLAYBOOKS'}),
                list: templatesList,
                hideIfEmpty: false,
                isTemplates: true,
            },
        ];
    }, [data?.yourPlaybooks, formatMessage, templatesList]);

    if (loading) {
        return <LoadingContainer><LoadingSpinner/></LoadingContainer>;
    }

    return (
        <Container>
            <Scrollbars
                autoHide={true}
                autoHideTimeout={500}
                autoHideDuration={500}
            >
                {groups.map((group) => {
                    // Hide section if hideIfEmpty is true and list is empty
                    if (group.hideIfEmpty && (!group.list || group.list.length === 0)) {
                        return null;
                    }

                    return (
                        <React.Fragment key={group.title}>
                            {group.list && group.list.length > 0 && <GroupTitle>{group.title}</GroupTitle>}
                            <Group>
                                {group.isTemplates ? (
                                    (group.list as PresetTemplate[])?.map((template) => (
                                        <TemplateRow
                                            key={`template-${template.title}`}
                                            template={template}
                                            teamID={props.teamID}
                                            onSelectPlaybook={props.onSelectPlaybook}
                                        />
                                    ))
                                ) : (
                                    (group.list as Array<FragmentType<typeof PlaybookModalFieldsFragment>>)?.map((playbook) => {
                                        const playbookData = getFragmentData(PlaybookModalFieldsFragment, playbook);
                                        return (
                                            <PlaybookRow
                                                key={`item-${playbookData.id}`}
                                                playbook={playbook}
                                                onSelectPlaybook={props.onSelectPlaybook}
                                            />
                                        );
                                    })
                                )}
                            </Group>
                        </React.Fragment>
                    );
                })}
            </Scrollbars>
        </Container>
    );
};

interface PlaybookRowProps {
    onSelectPlaybook: (playbookId: string) => void;
    playbook: FragmentType<typeof PlaybookModalFieldsFragment>;
}

const PlaybookRow = (props: PlaybookRowProps) => {
    const {formatMessage} = useIntl();
    const hasPermission = useHasPlaybookPermission(PlaybookPermissionGeneral.RunCreate, props.playbook as Maybe<PlaybookPermissionsParams>);
    const playbook = getFragmentData(PlaybookModalFieldsFragment, props.playbook);

    const iconProps = {
        size: 18,
        color: 'rgba(var(--center-channel-color-rgb), 0.56)',
    };
    return (
        <PlaybookItem
            $hasPermission={hasPermission}
            onClick={hasPermission ? () => props.onSelectPlaybook(playbook.id) : undefined}
        >
            <ItemIcon>
                {playbook.public ? <BookOutlineIcon {...iconProps}/> : <BookLockOutlineIcon {...iconProps}/>}
            </ItemIcon>
            <ItemCenter>
                <ItemTitle>{playbook.title}</ItemTitle>
                {playbook.description && <ItemDescription>{playbook.description}</ItemDescription>}
                <ItemSubTitle>
                    <span>{playbook.last_run_at === 0 ? formatMessage({defaultMessage: 'Never used'}) : formatMessage({defaultMessage: 'Last used {time}'}, {time: DateTime.fromMillis(playbook.last_run_at).toRelative()})}</span>
                    <Dot/>
                    <span>{formatMessage({defaultMessage: '{count, plural, =0 {None in progress} other {# in progress}}'}, {count: playbook.active_runs})}</span>
                </ItemSubTitle>
            </ItemCenter>
            <ButtonWrappper className='modal-list-cta'>
                {hasPermission ? (
                    <PrimaryButton>
                        <PlayOutlineIcon size={18}/>
                        {formatMessage({defaultMessage: 'Run'})}
                    </PrimaryButton>
                ) : (
                    <SecondaryButton
                        disabled={true}
                        title={'You do not have permissions'}
                    >
                        <PlayOutlineIcon size={18}/>
                        {formatMessage({defaultMessage: 'Run'})}
                    </SecondaryButton>
                )}
            </ButtonWrappper>
        </PlaybookItem>
    );
};

interface TemplateRowProps {
    template: PresetTemplate;
    teamID: string;
    onSelectPlaybook: (playbookId: string) => void;
}

const TemplateRow = (props: TemplateRowProps) => {
    const {formatMessage} = useIntl();
    const template = props.template;

    const handleCreateFromTemplateAndRun = async () => {
        // Create the playbook from template (without navigation)
        const pb = setPlaybookDefaults(template.template);
        pb.team_id = props.teamID;
        const data = await savePlaybook(pb);

        if (data?.id) {
            // Trigger the run flow with the newly created playbook
            props.onSelectPlaybook(data.id);
        }
    };

    const iconProps = {
        size: 18,
        color: 'rgba(var(--center-channel-color-rgb), 0.56)',
    };
    return (
        <PlaybookItem
            $hasPermission={true}
            onClick={handleCreateFromTemplateAndRun}
        >
            <ItemIcon>
                <BookOutlineIcon {...iconProps}/>
            </ItemIcon>
            <ItemCenter>
                <ItemTitle>{template.title}</ItemTitle>
                {template.description && <ItemDescription>{template.description}</ItemDescription>}
                <ItemSubTitle>
                    <span>{formatMessage({defaultMessage: 'Never used'})}</span>
                    <Dot/>
                    <span>{formatMessage({defaultMessage: 'No runs in progress'})}</span>
                </ItemSubTitle>
            </ItemCenter>
            <ButtonWrappper className='modal-list-cta'>
                <PrimaryButton>
                    <PlayOutlineIcon size={18}/>
                    {formatMessage({defaultMessage: 'Run'})}
                </PrimaryButton>
            </ButtonWrappper>
        </PlaybookItem>
    );
};

const WrappedPlaybooksSelector = (props: Props) => {
    const client = getPlaybooksGraphQLClient();
    return <ApolloProvider client={client}><PlaybooksSelector {...props}/></ApolloProvider>;
};
export default WrappedPlaybooksSelector;

const Dot = styled.span`
    margin: 0 5px;
    font-size: 18px;
    font-weight: 600;

    &::before {
        content: '·';
    }
`;

const Container = styled.div`
    display: flex;
    height: 350px;
    flex-direction: column;
`;
const GroupTitle = styled.div`
    color: rgba(var(--center-channel-color-rgb), 0.64);
    font-size:  12px;
    font-weight: 600;
    line-height: 16px;
    text-transform: uppercase;
`;
const Group = styled.div`
    display: flex;
    flex-direction: column;
    padding: 0;
    margin: 0 0 10px;
`;

const PlaybookItem = styled.div<{$hasPermission: boolean}>`
    display: flex;
    flex-direction: row;
    ${(props) => props.$hasPermission && css`
        cursor: pointer;
    `};
    padding: 10px 0;
    margin-right: 10px;
    border-radius: 4px;

    &:hover {
        background-color: rgba(var(--center-channel-color-rgb), 0.08);

        .modal-list-cta {
            display: block;
        }
    }
`;

const ItemIcon = styled.div`
    display: flex;
    align-items: flex-start;
    padding: 0 10px 0 5px;
`;
const ItemCenter = styled.div`
    display: flex;
    flex-direction: column;
`;

const ItemTitle = styled.div`
    margin-bottom: 4px;
    color: var(--center-channel-color);
    font-size:  14px;
    font-weight: 400;
    line-height: 20px;
`;
const ItemDescription = styled.div`
    margin-bottom: 4px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    font-size:  12px;
    font-weight: 400;
    line-height: 16px;
`;
const ItemSubTitle = styled.div`
    display: flex;
    align-items: center;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-size:  12px;
    font-weight: 400;
    line-height: 16px;
`;

const ButtonWrappper = styled.div`
    display: none;
    margin-right: 10px;
    margin-left: auto;

    button {
        display: flex;
        align-items: center;
        gap: 4px;
    }
`;

const LoadingContainer = styled(Container)`
    align-items: center;
    justify-content: center;
`;
