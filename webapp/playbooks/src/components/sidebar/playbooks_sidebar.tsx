import React, {useEffect} from 'react';
import styled from 'styled-components';
import {useSelector} from 'react-redux';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {useIntl} from 'react-intl';

import {useQuery} from '@apollo/client';

import {ReservedCategory, useReservedCategoryTitleMapper} from 'src/hooks';

import {graphql} from 'src/graphql/generated';

import {pluginUrl} from 'src/browser_routing';

import {LHSPlaybookDotMenu} from 'src/components/backstage/lhs_playbook_dot_menu';
import {LHSRunDotMenu} from 'src/components/backstage/lhs_run_dot_menu';
import {PlaybookRunType} from 'src/graphql/generated/graphql';

import Sidebar, {SidebarGroup} from './sidebar';
import CreatePlaybookDropdown from './create_playbook_dropdown';
import {ItemContainer, StyledNavLink} from './item';

export const RunsCategoryName = 'runsCategory';
export const PlaybooksCategoryName = 'playbooksCategory';

export const playbookLHSQueryDocument = graphql(/* GraphQL */`
    query PlaybookLHS($userID: String!, $teamID: String!, $types: [PlaybookRunType!]) {
        runs (participantOrFollowerID: $userID, teamID: $teamID, sort: "name", statuses: ["InProgress"], types: $types){
            edges {
                node {
                    id
                    name
                    isFavorite
                    playbookID
                    ownerUserID
                    participantIDs
                    followers
                }
            }
        }
        playbooks (teamID: $teamID, withMembershipOnly: true) {
            id
            title
            isFavorite
            public
        }
    }
`);

const pollInterval = 60000; // Poll every minute for updates

const useLHSData = (teamID: string) => {
    const normalizeCategoryName = useReservedCategoryTitleMapper();
    const {data, error, startPolling, stopPolling} = useQuery(playbookLHSQueryDocument, {
        variables: {
            userID: 'me',
            teamID,
            types: [PlaybookRunType.Playbook],
        },
        fetchPolicy: 'cache-and-network',
    });

    useEffect(() => {
        const focus = () => {
            startPolling(pollInterval);
        };
        const blur = () => {
            stopPolling();
        };
        window.addEventListener('focus', focus);
        window.addEventListener('blur', blur);

        return () => {
            window.removeEventListener('focus', focus);
            window.removeEventListener('blur', blur);
        };
    }, [startPolling, stopPolling]);

    if (error || !data) {
        return {groups: [], ready: false};
    }

    // Extract from pagination
    const runs = data.runs.edges.map((edge) => edge.node);
    const playbooks = data.playbooks;

    const playbookItems = playbooks.map((pb) => {
        const icon = pb.public ? 'icon-book-outline' : 'icon-book-lock-outline';
        const link = `/playbooks/playbooks/${pb.id}`;

        return {
            areaLabel: pb.title,
            display_name: pb.title,
            id: pb.id,
            icon,
            link,
            isCollapsed: false,
            itemMenu: (
                <LHSPlaybookDotMenu
                    playbookId={pb.id}
                    isFavorite={pb.isFavorite}
                />),
            isFavorite: pb.isFavorite,
            className: '',
        };
    });
    const playbookFavorites = playbookItems.filter((group) => group.isFavorite);
    const playbooksWithoutFavorites = playbookItems.filter((group) => !group.isFavorite);

    const hasViewerAccessToPlaybook = (playbookId: string) => {
        // if the run's playbook is visible to the user, then they have permanent access to the run
        return playbooks.find((pb) => pb.id === playbookId) !== undefined;
    };

    const runItems = runs.map((run) => {
        const icon = 'icon-play-outline';
        const link = pluginUrl(`/runs/${run.id}?from=playbooks_lhs`);

        return {
            areaLabel: run.name,
            display_name: run.name,
            id: run.id,
            icon,
            link,
            isCollapsed: false,
            itemMenu: (
                <LHSRunDotMenu
                    playbookRunId={run.id}
                    isFavorite={run.isFavorite}
                    ownerUserId={run.ownerUserID}
                    participantIDs={run.participantIDs}
                    followerIDs={run.followers}
                    hasPermanentViewerAccess={hasViewerAccessToPlaybook(run.playbookID)}
                />),
            isFavorite: run.isFavorite,
            className: '',
        };
    });
    const runFavorites = runItems.filter((group) => group.isFavorite);
    const runsWithoutFavorites = runItems.filter((group) => !group.isFavorite);

    const allFavorites = playbookFavorites.concat(runFavorites);
    let groups = [
        {
            collapsed: false,
            display_name: normalizeCategoryName(ReservedCategory.Runs),
            id: ReservedCategory.Runs,
            items: runsWithoutFavorites,
        },
        {
            collapsed: false,
            display_name: normalizeCategoryName(ReservedCategory.Playbooks),
            id: ReservedCategory.Playbooks,
            items: playbooksWithoutFavorites,
        },
    ];
    if (allFavorites.length > 0) {
        groups = [
            {
                collapsed: false,
                display_name: normalizeCategoryName(ReservedCategory.Favorite),
                id: ReservedCategory.Favorite,
                items: playbookFavorites.concat(runFavorites),
            },
        ].concat(groups);
    }

    return {groups, ready: true};
};

const ViewAllRuns = () => {
    const {formatMessage} = useIntl();
    const viewAllMessage = formatMessage({defaultMessage: 'View all...'});
    return (
        <ItemContainer>
            <ViewAllNavLink
                id={'sidebarItem_view_all_runs'}
                aria-label={formatMessage({defaultMessage: 'View all runs'})}
                data-testid={'playbookRunsLHSButton'}
                to={'/playbooks/runs'}
                exact={true}
            >
                {viewAllMessage}
            </ViewAllNavLink>
        </ItemContainer>
    );
};

const ViewAllPlaybooks = () => {
    const {formatMessage} = useIntl();
    const viewAllMessage = formatMessage({defaultMessage: 'View all...'});
    return (
        <ItemContainer key={'sidebarItem_view_all_playbooks'}>
            <ViewAllNavLink
                id={'sidebarItem_view_all_playbooks'}
                aria-label={formatMessage({defaultMessage: 'View all playbooks'})}
                data-testid={'playbooksLHSButton'}
                to={'/playbooks/playbooks'}
                exact={true}
            >
                {viewAllMessage}
            </ViewAllNavLink>
        </ItemContainer>
    );
};

const addViewAllsToGroups = (groups: SidebarGroup[]) => {
    for (let i = 0; i < groups.length; i++) {
        if (groups[i].id === ReservedCategory.Runs) {
            groups[i].afterGroup = <ViewAllRuns/>;
        } else if (groups[i].id === ReservedCategory.Playbooks) {
            groups[i].afterGroup = <ViewAllPlaybooks/>;
        }
    }
};

const PlaybooksSidebar = () => {
    const teamID = useSelector(getCurrentTeamId);
    const {groups, ready} = useLHSData(teamID);

    if (!ready) {
        return (
            <Sidebar
                groups={[]}
                headerDropdown={<CreatePlaybookDropdown team_id={teamID}/>}
                team_id={teamID}
            />
        );
    }

    addViewAllsToGroups(groups);

    return (
        <Sidebar
            groups={groups}
            headerDropdown={<CreatePlaybookDropdown team_id={teamID}/>}
            team_id={teamID}
        />
    );
};

export default PlaybooksSidebar;

const ViewAllNavLink = styled(StyledNavLink)`
    &&& {
        &:not(.active) {
            color: rgba(var(--sidebar-text-rgb), 0.56);
        }

        padding-left: 23px;
    }
`;
