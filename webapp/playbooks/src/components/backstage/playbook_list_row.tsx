// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {Fragment, useMemo} from 'react';
import styled from 'styled-components';

import {getTeam} from 'mattermost-redux/selectors/entities/teams';
import {useDispatch, useSelector} from 'react-redux';
import {FormattedMessage, useIntl} from 'react-intl';
import {
    AccountPlusOutlineIcon,
    ArchiveOutlineIcon,
    CloseIcon,
    ContentCopyIcon,
    DotsVerticalIcon,
    ExportVariantIcon,
    EyeOutlineIcon,
    PencilOutlineIcon,
    PlayOutlineIcon,
    RestoreIcon,
} from '@mattermost/compass-icons/components';
import {Client4} from 'mattermost-redux/client';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import {GlobalState} from '@mattermost/types/store';

import {useHasPlaybookPermission, useHasTeamPermission} from 'src/hooks';
import {Playbook} from 'src/types/playbook';
import TextWithTooltip from 'src/components/widgets/text_with_tooltip';
import DotMenu, {
    DotMenuButton,
    DropdownMenuItem as DropdownMenuItemBase,
    DropdownMenuItemStyled,
    iconSplitStyling,
} from 'src/components/dot_menu';
import Tooltip from 'src/components/widgets/tooltip';
import {
    createPlaybookRun,
    playbookExportProps,
    telemetryEvent,
    telemetryEventForPlaybook,
} from 'src/client';
import {PlaybookPermissionGeneral} from 'src/types/permissions';
import {SecondaryButton, TertiaryButton} from 'src/components/assets/buttons';
import {navigateToPluginUrl, navigateToUrl} from 'src/browser_routing';
import {usePlaybookMembership} from 'src/graphql/hooks';
import {Timestamp} from 'src/webapp_globals';
import {openPlaybookRunModal} from 'src/actions';

import {PlaybookRunEventTarget} from 'src/types/telemetry';

import {InfoLine} from './styles';
import {playbookIsTutorialPlaybook} from './playbook_editor/controls';
import {useLHSRefresh} from './lhs_navigation';

interface Props {
    playbook: Playbook
    onClick: () => void
    onEdit: () => void
    onArchive: () => void
    onRestore: () => void
    onDuplicate: () => void
    onMembershipChanged: (joined: boolean) => void;
}

const ActionCol = styled.div`
    margin-left: -8px;
	width: 16.666667%;
	float: left;
    position: relative;
	min-height: 1px;
	padding-left: 15px;
	padding-right: 15px;
	cursor: pointer;
`;

const PlaybookItem = styled.div`
    cursor: pointer;
    display: flex;
    padding-top: 15px;
    padding-bottom: 15px;
    align-items: center;
    margin: 0;
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
`;

const PlaybookItemTitle = styled.div`
    display: flex;
	font-weight: 600;
    flex-direction: column;
    position: relative;
    width: 33.333333%;
    min-height: 1px;
    padding-right: 15px;
    padding-left: 15px;
	float: left;
`;

const PlaybookItemRow = styled.div`
	width: 16.666667%;
	float: left;
    position: relative;
	min-height: 1px;
	padding-left: 15px;
	padding-right: 15px;
`;

export const ArchiveIcon = styled.i`
    font-size: 11px;
`;

const TIME_SPEC: React.ComponentProps<typeof Timestamp> = {
    useTime: false,
    style: 'narrow',
    ranges: [
        {within: ['minute', -1], display: ['second', 0]},
        {within: ['hour', -1], display: ['minute']},
        {within: ['day', -1], display: ['hour']}, // today, yesterday: N hours ago
        {within: ['month', -1], display: ['day']}, // this month, last month: N days ago
        {within: ['month', -11], display: ['month']},
        {within: ['year', -1000], display: ['year']},
    ],
};

const PlaybookListRow = (props: Props) => {
    const team = useSelector((state: GlobalState) => getTeam(state, props.playbook.team_id || ''));
    const dispatch = useDispatch();
    const currentUser = useSelector(getCurrentUser);
    const currentUserPlaybookMember = useMemo(() => props.playbook?.members.find(({user_id}) => user_id === currentUser.id), [props.playbook?.members, currentUser.id]);
    const refreshLHS = useLHSRefresh();

    const permissionForDuplicate = useHasTeamPermission(props.playbook.team_id, 'playbook_public_create');
    const {formatMessage} = useIntl();

    const {join, leave} = usePlaybookMembership(props.playbook.id, currentUser.id);

    const isTutorialPlaybook = playbookIsTutorialPlaybook(props.playbook.title);
    const hasPermissionToRunPlaybook = useHasPlaybookPermission(PlaybookPermissionGeneral.RunCreate, props.playbook);
    const enableRunPlaybook = props.playbook.delete_at === 0 && hasPermissionToRunPlaybook;

    const run = async () => {
        if (props.playbook && isTutorialPlaybook) {
            const playbookRun = await createPlaybookRun(props.playbook.id, currentUser.id, props.playbook.team_id, `${currentUser.username}'s onboarding run`, props.playbook.description);
            const channel = await Client4.getChannel(playbookRun.channel_id);

            navigateToUrl({
                pathname: `/${team.name}/channels/${channel.name}`,
                search: '?forceRHSOpen&openTakeATourDialog',
            });
            return;
        }
        if (props.playbook?.id) {
            telemetryEventForPlaybook(props.playbook.id, 'playbook_list_run_clicked');
            dispatch(openPlaybookRunModal({
                onRunCreated: (runId, channelId, statsData) => {
                    navigateToPluginUrl(`/runs/${runId}?from=run_modal`);
                    refreshLHS();
                    telemetryEvent(PlaybookRunEventTarget.Create, {...statsData, place: 'backstage_playbook_list'});
                },
                playbookId: props.playbook.id,
                teamId: team.id,
            }));
        }
    };

    const infos: JSX.Element[] = [];
    if (props.playbook.delete_at > 0) {
        infos.push((
            <Tooltip
                delay={{show: 0, hide: 1000}}
                id={`archive-${props.playbook.id}`}
                content={formatMessage({defaultMessage: 'This playbook is archived.'})}
            >
                <ArchiveIcon className='icon icon-archive-outline'/>
            </Tooltip>
        ));
    }

    const [exportHref, exportFilename] = playbookExportProps(props.playbook);
    return (
        <PlaybookItem
            key={props.playbook.id}
            onClick={props.onClick}
            data-testid='playbook-item'
        >
            <PlaybookItemTitle data-testid='playbook-title'>
                <TextWithTooltip
                    id={props.playbook.title}
                    text={props.playbook.title}
                />
                {infos.length > 0 &&
                    <InfoLine>
                        {infos.map((info, i) => (
                            <Fragment key={props.playbook.id + '-infoline' + i}>
                                {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
                                {i > 0 && ' - '}
                                {info}
                            </Fragment>))}
                    </InfoLine>
                }
            </PlaybookItemTitle>
            <PlaybookItemRow>
                {props.playbook.last_run_at ? (
                    <Timestamp
                        {...TIME_SPEC}
                        value={props.playbook.last_run_at}
                    />
                ) : (
                    '-' // eslint-disable-line formatjs/no-literal-string-in-jsx
                )}
            </PlaybookItemRow>
            <PlaybookItemRow>{props.playbook.active_runs}</PlaybookItemRow>
            <PlaybookItemRow>{props.playbook.num_runs}</PlaybookItemRow>
            <ActionCol
                css={`
                    display: flex;
                    gap: 4px;
                `}
            >
                {currentUserPlaybookMember ? (
                    <SecondaryButton
                        onClick={(e) => {
                            e.stopPropagation();
                            run();
                        }}
                        disabled={!enableRunPlaybook}
                        title={enableRunPlaybook ? formatMessage({defaultMessage: 'Run Playbook'}) : formatMessage({defaultMessage: 'You do not have permissions'})}
                        data-testid='run-playbook'
                        css={`
                            height: 32px;
                            ${iconSplitStyling};
                            gap: 2px;
                            padding: 0 20px;
                        `}
                    >
                        <PlayOutlineIcon size={22}/>
                        {formatMessage({defaultMessage: 'Run'})}
                    </SecondaryButton>
                ) : (
                    <TertiaryButton
                        onClick={async (e) => {
                            e.stopPropagation();
                            await join();
                            props.onMembershipChanged(true);
                        }}
                        data-testid='join-playbook'
                        css={`
                            height: 32px;
                            ${iconSplitStyling};
                            gap: 7px;
                            padding: 0 20px;
                        `}
                    >
                        <AccountPlusOutlineIcon size={16}/>
                        {formatMessage({defaultMessage: 'Join'})}
                    </TertiaryButton>
                )}
                <DotMenu
                    title={'Actions'}
                    placement='bottom-end'
                    icon={(
                        <DotsVerticalIcon size={18}/>
                    )}
                    dotMenuButton={DotMenuButtonStyled}
                >
                    {currentUserPlaybookMember ? (
                        <DropdownMenuItem
                            onClick={props.onEdit}
                        >
                            <PencilOutlineIcon size={18}/>
                            <FormattedMessage defaultMessage='Edit'/>
                        </DropdownMenuItem>
                    ) : (
                        <DropdownMenuItem
                            onClick={props.onClick}
                        >
                            <EyeOutlineIcon size={18}/>
                            <FormattedMessage defaultMessage='View'/>
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                        onClick={() => {
                            props.onDuplicate();
                            telemetryEventForPlaybook(props.playbook.id, 'playbook_duplicate_clicked_in_playbooks_list');
                        }}
                        disabled={!permissionForDuplicate}
                        disabledAltText={formatMessage({defaultMessage: 'Duplicate is disabled for this team.'})}
                    >
                        <ContentCopyIcon size={18}/>
                        <FormattedMessage defaultMessage='Duplicate'/>
                    </DropdownMenuItem>
                    <DropdownMenuItemStyled
                        href={exportHref}
                        download={exportFilename}
                        role={'button'}
                        css={`${iconSplitStyling}`}
                        onClick={() => telemetryEventForPlaybook(props.playbook.id, 'playbook_export_clicked_in_playbooks_list')}
                    >
                        <ExportVariantIcon size={18}/>
                        <FormattedMessage defaultMessage='Export'/>
                    </DropdownMenuItemStyled>
                    {currentUserPlaybookMember && (
                        <>
                            <div className='MenuGroup menu-divider'/>
                            <DropdownMenuItem
                                onClick={async () => {
                                    await leave();
                                    props.onMembershipChanged(false);
                                }}
                            >
                                <CloseIcon size={18}/>
                                <FormattedMessage defaultMessage='Leave'/>
                            </DropdownMenuItem>
                            <div className='MenuGroup menu-divider'/>
                            {props.playbook.delete_at > 0 ? (
                                <DropdownMenuItem
                                    onClick={props.onRestore}
                                >
                                    <RestoreIcon size={18}/>
                                    <FormattedMessage defaultMessage='Restore'/>
                                </DropdownMenuItem>
                            ) : (
                                <DropdownMenuItem
                                    onClick={props.onArchive}
                                >
                                    <RedText css={`${iconSplitStyling}`}>
                                        <ArchiveOutlineIcon size={18}/>
                                        <FormattedMessage defaultMessage='Archive'/>
                                    </RedText>
                                </DropdownMenuItem>
                            )}
                        </>
                    )}
                </DotMenu>
            </ActionCol>
        </PlaybookItem>
    );
};

export default PlaybookListRow;

const DropdownMenuItem = styled(DropdownMenuItemBase)`
    ${iconSplitStyling};
`;

const RedText = styled.div`
    color: var(--error-text);
`;

const DotMenuButtonStyled = styled(DotMenuButton)`
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
`;
