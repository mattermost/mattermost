// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {
    BookOutlineIcon,
    CheckAllIcon,
    CheckIcon,
    LinkVariantIcon,
    PencilOutlineIcon,
    PlayOutlineIcon,
    SortAscendingIcon,
} from '@mattermost/compass-icons/components';
import Scrollbars from 'react-custom-scrollbars';
import {DateTime} from 'luxon';
import {debounce} from 'lodash';
import {GlobalState} from '@mattermost/types/store';
import {getCurrentChannel, getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';

import appIcon from 'src/components/assets/app-bar-icon.png';
import {useUpdateRun} from 'src/graphql/hooks';
import {useViewTelemetry} from 'src/hooks';
import {HamburgerButton} from 'src/components/assets/icons/three_dots_icon';
import {openPlaybookRunModal, openUpdateRunChannelModal, openUpdateRunNameModal} from 'src/actions';
import Profile from 'src/components/profile/profile';
import DotMenu, {DotMenuButton, DropdownMenuItem, TitleButton} from 'src/components/dot_menu';
import {PrimaryButton, SecondaryButton, TertiaryButton} from 'src/components/assets/buttons';
import {RHSTitleRemoteRender} from 'src/rhs_title_remote_render';
import ClipboardChecklist from 'src/components/assets/illustrations/clipboard_checklist_svg';
import LoadingSpinner from 'src/components/assets/loading_spinner';
import GiveFeedbackButton from 'src/components/give_feedback_button';
import {navigateToPluginUrl} from 'src/browser_routing';
import {useToaster} from 'src/components/backstage/toast_banner';
import {ToastStyle} from 'src/components/backstage/toast';

import {GeneralViewTarget} from 'src/types/telemetry';
import {PlaybookRunType} from 'src/graphql/generated/graphql';

import {UserList} from './rhs_participants';
import {RHSTitleText} from './rhs_title_common';

interface PlaybookToDisplay {
    title: string
}

interface RunToDisplay {
    id: string
    name: string
    participantIDs: string[]
    ownerUserID: string
    playbookID: string
    playbook?: Maybe<PlaybookToDisplay>
    numTasksClosed: number
    numTasks: number
    lastUpdatedAt: number
    type: string
}

export enum FilterType {
    InProgress,
    Finished,
}

export interface RunListOptions {
    sort: string
    direction: string
    filter: FilterType
}

interface Props {
    runs: RunToDisplay[];
    onSelectRun: (runID: string) => void;
    onRunCreated: (runID: string, channelId: string, statsData: object) => void;
    onLinkRunToChannel: () => void;
    getMore: () => Promise<any>;
    hasMore: boolean;

    options: RunListOptions;
    setOptions: React.Dispatch<React.SetStateAction<RunListOptions>>;
    numInProgress: number;
    numFinished: number;
}

const getCurrentChannelName = (state: GlobalState) => getCurrentChannel(state)?.display_name;

const RHSRunList = (props: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const currentTeamId = useSelector(getCurrentTeamId);
    const currentChannelId = useSelector(getCurrentChannelId);
    const [loadingMore, setLoadingMore] = useState(false);
    const debouncedSetLoadingMore = useMemo(() => debounce(setLoadingMore, 100), [setLoadingMore]);
    const getMore = async () => {
        debouncedSetLoadingMore(true);
        await props.getMore();
        debouncedSetLoadingMore(false);
    };
    const currentChannelName = useSelector<GlobalState, string>(getCurrentChannelName);
    const filterMenuTitleText = props.options.filter === FilterType.InProgress ? formatMessage({defaultMessage: 'Runs in progress'}) : formatMessage({defaultMessage: 'Finished runs'});
    const showNoRuns = props.runs.length === 0;
    useViewTelemetry(GeneralViewTarget.ChannelsRHSRunList, currentChannelId);

    const handleStartRun = () => {
        dispatch(openPlaybookRunModal({
            onRunCreated: props.onRunCreated,
            triggerChannelId: currentChannelId,
            teamId: currentTeamId,
        }));
    };

    return (
        <>
            <RHSTitleRemoteRender>
                <TitleContainer>
                    <ClipboardImage src={appIcon}/>
                    <RHSTitleText>
                        {/* product name; don't translate */}
                        {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
                        {'Playbooks'}
                    </RHSTitleText>
                    <VerticalLine/>
                    <ChannelNameText>
                        {currentChannelName}
                    </ChannelNameText>
                </TitleContainer>
            </RHSTitleRemoteRender>
            <Container>
                <Header>
                    <DotMenu
                        dotMenuButton={TitleButton}
                        placement='bottom-start'
                        icon={
                            <FilterMenuTitle data-testid='rhs-runs-filter-menu'>
                                {filterMenuTitleText}
                                <i className={'icon icon-chevron-down'}/>
                            </FilterMenuTitle>
                        }
                    >
                        <FilterMenuItem
                            onClick={() => props.setOptions((oldOptions) => ({...oldOptions, filter: FilterType.InProgress}))}
                        >
                            {formatMessage({defaultMessage: 'Runs in progress'})}
                            <FilterMenuNumericValue>
                                {props.numInProgress}
                            </FilterMenuNumericValue>
                        </FilterMenuItem>
                        <FilterMenuItem
                            onClick={() => props.setOptions((oldOptions) => ({...oldOptions, filter: FilterType.Finished}))}
                        >
                            {formatMessage({defaultMessage: 'Finished runs'})}
                            <FilterMenuNumericValue>
                                {props.numFinished}
                            </FilterMenuNumericValue>
                        </FilterMenuItem>
                    </DotMenu>
                    <Spacer/>
                    <StartRunButton
                        data-testid='rhs-runlist-start-run'
                        onClick={handleStartRun}
                    >
                        <PlayOutlineIcon size={14}/>
                        {formatMessage({defaultMessage: 'Start run'})}
                    </StartRunButton>
                    <DotMenu
                        dotMenuButton={SortDotMenuButton}
                        placement='bottom-start'
                        icon={<SortAscendingIcon size={18}/>}
                    >
                        <SortMenuTitle>{formatMessage({defaultMessage: 'Sort runs by'})}</SortMenuTitle>
                        <SortMenuItem
                            label={formatMessage({defaultMessage: 'Recently created'})}
                            sortItem={'create_at'}
                            sortDirection={'DESC'}
                            options={props.options}
                            setOptions={props.setOptions}
                        />
                        <SortMenuItem
                            label={formatMessage({defaultMessage: 'Last status update'})}
                            sortItem={'last_status_update_at'}
                            sortDirection={'DESC'}
                            options={props.options}
                            setOptions={props.setOptions}
                        />
                        <SortMenuItem
                            label={formatMessage({defaultMessage: 'Alphabetically'})}
                            sortItem={'name'}
                            sortDirection={'ASC'}
                            options={props.options}
                            setOptions={props.setOptions}
                        />
                    </DotMenu>
                </Header>
                {showNoRuns &&
                    <>
                        <NoRunsWrapper>
                            <NoRuns
                                active={props.options.filter === FilterType.InProgress}
                                numInProgress={props.numInProgress}
                                numFinished={props.numFinished}
                                setOptions={props.setOptions}
                                onStartRunClicked={handleStartRun}
                            />
                        </NoRunsWrapper>
                        <FeedbackWrapper>
                            <StyledGiveFeedbackButton tooltipPlacement='top'/>
                        </FeedbackWrapper>
                    </>
                }
                {!showNoRuns &&
                    <Scrollbars
                        autoHide={true}
                        autoHideTimeout={500}
                        autoHideDuration={500}
                    >
                        <RunsList data-testid='rhs-runs-list'>
                            {props.runs.map((run: RunToDisplay) => (
                                <RHSRunListCard
                                    key={run.id}
                                    onLinkRunToChannel={props.onLinkRunToChannel}
                                    onClick={() => props.onSelectRun(run.id)}
                                    {...run}
                                />
                            ))}
                            {props.hasMore && !loadingMore &&
                                <TertiaryButton
                                    onClick={getMore}
                                >
                                    {formatMessage({defaultMessage: 'Show more'})}
                                </TertiaryButton>
                            }
                            {loadingMore &&
                                <StyledLoadingSpinner/>
                            }
                        </RunsList>
                        <FeedbackWrapper>
                            <StyledGiveFeedbackButton tooltipPlacement='top'/>
                        </FeedbackWrapper>
                    </Scrollbars>
                }
            </Container>
        </>
    );
};

const FeedbackWrapper = styled.div`
    padding: 0px 16px;
    text-align: center;
    margin-bottom: 30px;
    margin-top: 10px;
`;

const Container = styled.div`
    display: flex;
    flex-direction: column;
    height: 100%;
`;

const Header = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 12px 16px;
    gap: 4px;
`;

const RunsList = styled.div`
    display: flex;
    flex-direction: column;
    padding: 0px 16px;
    gap: 12px;
    min-height: calc(100% - 65px);
`;
const NoRunsWrapper = styled.div`
    min-height: calc(100% - 123px);
    display: flex;
`;

const FilterMenuTitle = styled.div`
    font-family: Metropolis;
    font-weight: 600;
    font-size: 16px;
    line-height: 24px;
`;

const Spacer = styled.div`
    flex-grow: 1;
`;

const StyledLoadingSpinner = styled(LoadingSpinner)`
    margin-top: 12px;
    width: 20px;
    height: 20px;
    align-self: center;
`;

const TitleContainer = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
`;

const VerticalLine = styled.div`
    opacity: 0.16;
    border: 1px solid var(--center-channel-color);
    height: 24px;
`;

const ChannelNameText = styled.div`
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-weight: 400;
    font-size: 12px;
    line-height: 20px;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const ClipboardImage = styled.img`
    width: 24px;
    height: 24px;
    border-radius: 50%;
`;

const StartRunButton = styled(SecondaryButton)`
    display: flex;
    flex-direction: row;
    gap: 6px;
    padding: 8px 16px;

    border: 0;
    height: 100%;
    font-weight: 600;
    font-size: 12px;
    color: var(--button-bg);
    background: rgba(var(--button-bg-rgb), 0.08);
`;

const SortDotMenuButton = styled(DotMenuButton)`
    justify-content: center;
    align-items: center;
`;

const SortMenuTitle = styled.div`
    color: rgba(var(--center-channel-color-rgb), 0.56);
    text-transform: uppercase;
    font-size: 12px;
    line-height: 16px;
    font-weight: 600;
    margin: 5px 18px;
`;

const FilterMenuItem = styled(DropdownMenuItem)`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    min-width: 182px;
`;

const StyledDropdownMenuSort = styled(DropdownMenuItem)`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    min-width: 190px;
    align-items: center;
`;

const StyledGiveFeedbackButton = styled(GiveFeedbackButton)`
    && {
        font-size: 12px;
        color: var(--center-channel-color-64);
        width: 100%;
    }

    &&:hover:not([disabled]) {
        color: var(--center-channel-color-72);
        background-color: var(--center-channel-color-08);
    }

`;

interface SortMenuItemProps {
    label: string
    sortItem: string
    sortDirection: string
    options: RunListOptions
    setOptions: React.Dispatch<React.SetStateAction<RunListOptions>>
}

const SortMenuItem = (props: SortMenuItemProps) => {
    return (
        <StyledDropdownMenuSort
            onClick={() => props.setOptions((oldOptions) => ({...oldOptions, sort: props.sortItem, direction: props.sortDirection}))}
        >
            {props.label}
            {props.sortItem === props.options.sort &&
                <BlueCheckmark/>
            }
        </StyledDropdownMenuSort>
    );
};

const FilterMenuNumericValue = styled.div`
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;

const BlueCheckmark = styled(CheckIcon)`
    color: var(--button-bg);
    width: 18px;
    height: 18px;
`;

interface RHSRunListCardProps extends RunToDisplay {
    onClick: () => void;
    onLinkRunToChannel: () => void;
}

const RHSRunListCard = (props: RHSRunListCardProps) => {
    const {formatMessage} = useIntl();
    const [removed, setRemoved] = useState(false);
    const {add: addToastMessage} = useToaster();
    const teamId = useSelector(getCurrentTeamId);
    const currentUserId = useSelector(getCurrentUserId);
    const canEditRun = currentUserId === props.ownerUserID || props.participantIDs.includes(currentUserId);
    const participatIDsWithoutOwner = props.participantIDs.filter((id) => id !== props.ownerUserID);
    const [movedChannel, setMovedChannel] = useState({channelId: '', channelName: ''});
    const updateRun = useUpdateRun(props.id);
    const isPlaybookRun = props.type === PlaybookRunType.Playbook;
    const icon = isPlaybookRun ? <PlayOutlineIcon size={22}/> : <CheckAllIcon size={22}/>;

    return (
        <CardWrapper
            progress={(props.numTasksClosed / props.numTasks) * 100}
            className={removed ? 'removed' : ''}
            onAnimationEnd={() => {
                if (!movedChannel.channelId) {
                    return;
                }
                updateRun({channelID: movedChannel.channelId});
                addToastMessage({
                    content: isPlaybookRun ? formatMessage({defaultMessage: 'Run moved to {channel}'}, {channel: movedChannel.channelName}) : formatMessage({defaultMessage: 'Checklist moved to {channel}'}, {channel: movedChannel.channelName}),
                    toastStyle: ToastStyle.Success,
                });
                props.onLinkRunToChannel();
            }}
        >
            <CardContainer
                onClick={props.onClick}
                data-testid='run-list-card'
            >
                <CardTitleContainer>
                    <IconWrapper margin='6px'>
                        {icon}
                    </IconWrapper>
                    <TitleRow>{props.name}</TitleRow>
                    <Spacer/>
                    {isPlaybookRun &&
                        <ContextMenu
                            playbookID={props.playbookID}
                            playbookTitle={props.playbook?.title || ''}
                            playbookRunID={props.id}
                            teamID={teamId}
                            canSeePlaybook={Boolean(props.playbook?.title)}
                            canEditRun={canEditRun}
                            onUpdateName={(newName) => {
                                updateRun({name: newName});
                            }}
                            onUpdateChannel={(newChannelId: string, newChannelName: string) => {
                                setRemoved(true);
                                setMovedChannel({
                                    channelId: newChannelId,
                                    channelName: newChannelName,
                                });
                            }}
                        />
                    }
                    {!isPlaybookRun &&
                        <ChannelChecklistContextMenu
                            playbookRunID={props.id}
                            teamID={teamId}
                            canEditRun={canEditRun}
                            onUpdateName={(newName) => {
                                updateRun({name: newName});
                            }}
                            onUpdateChannel={(newChannelId: string, newChannelName: string) => {
                                setRemoved(true);
                                setMovedChannel({
                                    channelId: newChannelId,
                                    channelName: newChannelName,
                                });
                            }}
                        />
                    }
                </CardTitleContainer>
                {isPlaybookRun &&
                    <PeopleRow>
                        <OwnerProfileChip userId={props.ownerUserID}/>
                        <ParticipantsProfiles>
                            <UserList
                                userIds={participatIDsWithoutOwner}
                                sizeInPx={20}
                            />
                        </ParticipantsProfiles>
                    </PeopleRow>
                }
                {!isPlaybookRun && props.numTasks > 0 &&
                    <TasksDone>
                        <TasksDoneNumbers>
                            {/* eslint-disable formatjs/no-literal-string-in-jsx */}
                            {props.numTasksClosed + '/' + props.numTasks}
                        </TasksDoneNumbers>
                        <TasksDoneText>
                            {formatMessage({defaultMessage: 'tasks done'})}
                        </TasksDoneText>
                    </TasksDone>
                }
                <InfoRow>
                    <LastUpdatedText>
                        {formatMessage(
                            {defaultMessage: 'Last updated {time}'},
                            {time: DateTime.fromMillis(props.lastUpdatedAt).toRelative()}
                        )}
                    </LastUpdatedText>
                    {props.playbook && isPlaybookRun &&
                        <PlaybookChip>
                            <StyledBookOutlineIcon
                                size={11}
                            />
                            <PlaybookChipText>{props.playbook.title}</PlaybookChipText>
                        </PlaybookChip>
                    }
                </InfoRow>
            </CardContainer>
        </CardWrapper>
    );
};
const CardWrapper = styled.div<{ progress: number }>`
    margin: 0;
    padding:0;
    border-radius: 4px;
    position: relative;

    &:after {
        content: '';
        display: block;
        position: absolute;
        right: calc(${({progress}) => 100 - progress}% + 1px);
        bottom: 1px;
        left: 1px;
        border-bottom: 2px solid var(--online-indicator);
        border-bottom-left-radius: inherit;
        border-bottom-right-radius: ${({progress}) => (progress < 100 ? 0 : 'inherit')}
    }

    &.removed {
        -webkit-animation: disapear 0.7s;
        -webkit-animation-fill-mode: forwards;
        animation: disapear 0.7s;
        animation-fill-mode: forwards;
    }

    @-webkit-keyframes disapear{
        35% {
            -webkit-transform: translateY(5%);
            transform: translateY(5%);
        }
        100% {
            -webkit-transform: translateY(-1000%);
            transform: translateY(-1000%);
        }
    }

    @keyframes disapear{
        35% {
            -webkit-transform: translateY(5%);
            transform: translateY(5%);
        }
        100% {
            -webkit-transform: translateY(-1000%);
            transform: translateY(-1000%);
        }
    }
`;

const CardContainer = styled.div`
    display: flex;
    flex-direction: column;
    padding: 16px 20px 20px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    box-shadow: 0px 2px 3px 0px rgba(0, 0, 0, 0.08);
    border-radius: 4px;
    gap: 8px;

    cursor: pointer;

    &:hover {
        box-shadow: 0px 4px 6px 0px rgba(0, 0, 0, 0.12);
    }

    &:active {
        box-shadow: inset 0px 2px 3px rgba(0, 0, 0, 0.08);
    }
`;
const CardTitleContainer = styled.div`
    display: flex;
    flex-direction: row;
    justify-content: space-between;

`;
const TitleRow = styled.div`
    font-size: 14px;
    font-weight: 600;

    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;
const PeopleRow = styled.div`
    display: flex;
    flex-direction: row;
    gap: 4px;
`;
const InfoRow = styled.div`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
`;
const LastUpdatedText = styled.div`
    font-size: 11px;
    font-weight: 400;
    line-height: 16px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
`;
const PlaybookChip = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 0px 4px;
    gap: 4px;
    max-width: 40%;

    background: rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 4px;
`;
const PlaybookChipText = styled.span`
    font-size: 10px;
    font-weight: 600;
    line-height: 16px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const OwnerProfileChip = styled(Profile)`
    flex-grow: 0;

    font-weight: 400;
    font-size: 11px;
    line-height: 15px;
    padding: 2px 10px 2px 2px;
    background: rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 12px;

    > .image {
        width: 16px;
        height: 16px;
    }
`;
const ParticipantsProfiles = styled.div`
    display: flex;
    flex-direction: row;
`;

const ThreeDotsIcon = styled(HamburgerButton)`
    font-size: 18px;
    margin-left: 1px;
`;

const StyledBookOutlineIcon = styled(BookOutlineIcon)`
    flex-shrink: 0;
`;

const StyledDotMenuButton = styled(DotMenuButton)`
    width: 28px;
    height: 28px;
`;

const StyledDropdownMenuItem = styled(DropdownMenuItem)`
    display: flex;
    align-content: center;
`;

const Separator = styled.hr`
    display: flex;
    align-content: center;
    border-top: 1px solid var(--center-channel-color-08);
    margin: 5px auto;
    width: 100%;
`;

const IconWrapper = styled.div<{ margin?: string }>`
    margin-right: ${({margin}) => (margin || '11px')};
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;

interface NoRunsProps {
    active: boolean
    numInProgress: number;
    numFinished: number;
    onStartRunClicked: () => void;
    setOptions: React.Dispatch<React.SetStateAction<RunListOptions>>
}

const NoRuns = (props: NoRunsProps) => {
    const {formatMessage} = useIntl();

    let text = formatMessage({defaultMessage: 'There are no runs in progress linked to this channel'});
    if (!props.active) {
        text = formatMessage({defaultMessage: 'There are no finished runs linked to this channel'});
    }

    return (
        <NoActiveRunsContainer data-testid={'no-active-runs'}>
            <StyledClipboardChecklist/>
            <NoRunsText>
                {text}
            </NoRunsText>
            <PrimaryButton onClick={props.onStartRunClicked}>
                <PlayOutlineIcon size={18}/>
                <FormattedMessage defaultMessage={'Start a run'}/>
            </PrimaryButton>
            {props.active && props.numFinished > 0 &&
                <ViewOtherRunsButton
                    onClick={() => props.setOptions((oldOptions) => ({...oldOptions, filter: FilterType.Finished}))}
                >
                    {formatMessage({defaultMessage: 'View finished runs'})}
                </ViewOtherRunsButton>
            }
            {!props.active && props.numInProgress > 0 &&
                <ViewOtherRunsButton
                    onClick={() => props.setOptions((oldOptions) => ({...oldOptions, filter: FilterType.InProgress}))}
                >
                    {formatMessage({defaultMessage: 'View in progress runs'})}
                </ViewOtherRunsButton>
            }
        </NoActiveRunsContainer>
    );
};

const NoActiveRunsContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    align-self: center;
    gap: 24px;
    max-width: 325px;
    margin: auto;
`;
const NoRunsText = styled.div`
    font-weight: 600;
    font-size: 20px;
    line-height: 28px;
    text-align: center;
`;
const ViewOtherRunsButton = styled(TertiaryButton)`
    background: none;
`;
const StyledClipboardChecklist = styled(ClipboardChecklist)`
    width: 98px;
    height: 98px;
`;

interface ContextMenuProps {
    playbookID: string;
    teamID: string;
    playbookRunID: string;
    playbookTitle: string;
    canSeePlaybook: boolean;
    canEditRun: boolean;
    onUpdateChannel: (channelId: string, channelName: string) => void;
    onUpdateName: (name: string) => void;
}
const ContextMenu = (props: ContextMenuProps) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const overviewURL = `/runs/${props.playbookRunID}?from=channel_rhs_dotmenu`;
    const playbookURL = `/playbooks/${props.playbookID}`;

    return (
        <DotMenu
            dotMenuButton={StyledDotMenuButton}
            placement='bottom-start'
            icon={<ThreeDotsIcon/>}
        >
            <StyledDropdownMenuItem
                onClick={() => dispatch(openUpdateRunChannelModal(props.playbookRunID, props.teamID, PlaybookRunType.Playbook, props.onUpdateChannel))}
                disabled={!props.canEditRun}
                disabledAltText={formatMessage({defaultMessage: 'You do not have permission to edit this run'})}
            >
                <IconWrapper>
                    <LinkVariantIcon size={22}/>
                </IconWrapper>
                <FormattedMessage defaultMessage='Link run to a different channel'/>
            </StyledDropdownMenuItem>
            <StyledDropdownMenuItem
                onClick={() => dispatch(openUpdateRunNameModal(props.playbookRunID, props.onUpdateName))}
                disabled={!props.canEditRun}
                disabledAltText={formatMessage({defaultMessage: 'You do not have permission to edit this run'})}
            >
                <IconWrapper>
                    <PencilOutlineIcon size={22}/>
                </IconWrapper>
                <FormattedMessage defaultMessage='Rename run'/>
            </StyledDropdownMenuItem>
            <Separator/>
            <StyledDropdownMenuItem onClick={() => navigateToPluginUrl(overviewURL)}>
                <IconWrapper>
                    <PlayOutlineIcon size={22}/>
                </IconWrapper>
                <FormattedMessage defaultMessage='Go to run overview'/>
            </StyledDropdownMenuItem>
            <StyledDropdownMenuItem
                disabled={!props.canSeePlaybook}
                onClick={() => navigateToPluginUrl(playbookURL)}
                disabledAltText={formatMessage({defaultMessage: 'You do not have permission to see this playbook'})}
            >
                <RowContainer>
                    <ColContainer>
                        <IconWrapper>
                            <BookOutlineIcon size={22}/>
                        </IconWrapper>
                        <FormattedMessage defaultMessage='Go to playbook'/>
                    </ColContainer>
                    <MenuItemSubTitle>{props.playbookTitle}</MenuItemSubTitle>
                </RowContainer>
            </StyledDropdownMenuItem>
        </DotMenu>
    );
};

interface ChannelChecklistContextMenuProps {
    teamID: string;
    playbookRunID: string;
    canEditRun: boolean;
    onUpdateChannel: (channelId: string, channelName: string) => void;
    onUpdateName: (name: string) => void;
}
const ChannelChecklistContextMenu = (props: ChannelChecklistContextMenuProps) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();

    return (
        <DotMenu
            dotMenuButton={StyledDotMenuButton}
            placement='bottom-start'
            icon={<ThreeDotsIcon/>}
        >
            <StyledDropdownMenuItem
                onClick={() => dispatch(openUpdateRunChannelModal(props.playbookRunID, props.teamID, PlaybookRunType.ChannelChecklist, props.onUpdateChannel))}
                disabled={!props.canEditRun}
                disabledAltText={formatMessage({defaultMessage: 'You do not have permission to edit this checklist'})}
            >
                <IconWrapper>
                    <LinkVariantIcon size={22}/>
                </IconWrapper>
                <FormattedMessage defaultMessage='Link checklist to a different channel'/>
            </StyledDropdownMenuItem>
            <StyledDropdownMenuItem
                onClick={() => dispatch(openUpdateRunNameModal(props.playbookRunID, props.onUpdateName))}
                disabled={!props.canEditRun}
                disabledAltText={formatMessage({defaultMessage: 'You do not have permission to edit this checklist'})}
            >
                <IconWrapper>
                    <PencilOutlineIcon size={22}/>
                </IconWrapper>
                <FormattedMessage defaultMessage='Rename checklist'/>
            </StyledDropdownMenuItem>
        </DotMenu>
    );
};

const ColContainer = styled.div`
    display: flex;
    flex-direction: row;
`;

const RowContainer = styled.div`
    display: flex;
    flex-direction: column;
`;

const MenuItemSubTitle = styled.div`
    margin-left: 33px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    // don't let the playbook title make context menu grow too wide
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const TasksDone = styled.div`
    display: flex;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    font-size: 11px;
`;

const TasksDoneNumbers = styled.div`
    margin-right: 6px;
    font-weight: 600;
`;

const TasksDoneText = styled.div`
    font-weight: 400;
`;

export default RHSRunList;
