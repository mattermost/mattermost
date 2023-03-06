// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled, {css} from 'styled-components';
import React, {PropsWithChildren, useEffect, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {Link} from 'react-router-dom';

import {
    AccountMultipleOutlineIcon,
    ArchiveOutlineIcon,
    CloseIcon,
    ContentCopyIcon,
    ExportVariantIcon,
    LinkVariantIcon,
    LockOutlineIcon,
    PencilOutlineIcon,
    PlayOutlineIcon,
    PlusIcon,
    RestoreIcon,
    StarIcon,
    StarOutlineIcon,
} from '@mattermost/compass-icons/components';

import {OverlayTrigger, Tooltip} from 'react-bootstrap';

import {getTeam} from 'mattermost-redux/selectors/entities/teams';
import {Team} from '@mattermost/types/teams';
import {GlobalState} from '@mattermost/types/store';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {FormattedMessage, FormattedNumber, useIntl} from 'react-intl';
import {createGlobalState} from 'react-use';

import {navigateToPluginUrl, pluginUrl} from 'src/browser_routing';
import {
    PlaybookPermissionsMember,
    useAllowMakePlaybookPrivate,
    useHasPlaybookPermission,
    useHasTeamPermission,
} from 'src/hooks';
import {useToaster} from 'src/components/backstage/toast_banner';
import {
    archivePlaybook,
    autoFollowPlaybook,
    autoUnfollowPlaybook,
    duplicatePlaybook as clientDuplicatePlaybook,
    clientFetchPlaybookFollowers,
    getSiteUrl,
    playbookExportProps,
    restorePlaybook,
    telemetryEvent,
    telemetryEventForPlaybook,
} from 'src/client';
import {OVERLAY_DELAY} from 'src/constants';
import {ButtonIcon, PrimaryButton, SecondaryButton} from 'src/components/assets/buttons';
import CheckboxInput from 'src/components/backstage/runs_list/checkbox_input';
import {displayEditPlaybookAccessModal, openPlaybookRunModal} from 'src/actions';
import {PlaybookPermissionGeneral} from 'src/types/permissions';
import DotMenu, {DropdownMenuItem as DropdownMenuItemBase, DropdownMenuItemStyled, iconSplitStyling} from 'src/components/dot_menu';
import useConfirmPlaybookArchiveModal from 'src/components/backstage/archive_playbook_modal';
import CopyLink from 'src/components/widgets/copy_link';
import useConfirmPlaybookRestoreModal from 'src/components/backstage/restore_playbook_modal';
import {usePlaybookMembership, useUpdatePlaybookFavorite} from 'src/graphql/hooks';
import {StyledDropdownMenuItem} from 'src/components/backstage/shared';
import {copyToClipboard} from 'src/utils';
import {useLHSRefresh} from 'src/components/backstage/lhs_navigation';
import useConfirmPlaybookConvertPrivateModal from 'src/components/backstage/convert_private_playbook_modal';
import {PlaybookRunEventTarget} from 'src/types/telemetry';

type ControlProps = {
    playbook: {
        id: string,
        public: boolean,
        default_playbook_member_role: string,
        default_owner_id: string,
        default_owner_enabled: boolean,
        title: string,
        delete_at: number,
        team_id: string,
        description: string,
        members: PlaybookPermissionsMember[],
    }
    refetch?: () => void;
};

type StyledProps = {className?: string;};

const StyledLink = styled(Link)`
    a&& {
        color: rgba(var(--center-channel-color-rgb), 0.56);
        font-weight: 600;
        font-size: 14px;
        display: inline-flex;
        flex-shrink: 0;
        align-items: center;
        border-radius: 4px;
        height: 36px;
        padding: 0 8px;


        &:hover,
        &:focus {
            background: rgba(var(--button-bg-rgb), 0.08);
            color: var(--button-bg);
            text-decoration: none;
        }
    }

    span {
        padding-right: 8px;
    }

    i {
        font-size: 18px;
    }
`;

export const Back = styled((props: StyledProps) => {
    return (
        <StyledLink
            {...props}
            to={pluginUrl('/playbooks')}
        >
            <i className='icon-arrow-left'/>
            <FormattedMessage defaultMessage='Back'/>
        </StyledLink>
    );
})`

`;

export const Members = (props: {playbookId: string, numMembers: number, refetch: () => void}) => {
    const dispatch = useDispatch();
    return (
        <ButtonIconStyled
            data-testid={'playbook-members'}
            onClick={() => dispatch(displayEditPlaybookAccessModal(props.playbookId, props.refetch))}
        >
            <i className={'icon icon-account-multiple-outline'}/>
            <FormattedNumber value={props.numMembers}/>
        </ButtonIconStyled>
    );
};

export const CopyPlaybook = ({playbook: {title, id}}: ControlProps) => {
    return (
        <CopyLink
            id='copy-playbook-link-tooltip'
            to={getSiteUrl() + '/playbooks/playbooks/' + id}
            name={title}
            area-hidden={true}
        />
    );
};

const changeFollowing = async (playbookId: string, userId: string, following: boolean) => {
    if (!playbookId || !userId) {
        return null;
    }

    try {
        if (following) {
            await autoFollowPlaybook(playbookId, userId);
        } else {
            await autoUnfollowPlaybook(playbookId, userId);
        }
        return following;
    } catch {
        return null;
    }
};

const useFollowerIds = createGlobalState<string[] | null>(null);
const useIsFollowing = createGlobalState(false);

export const useEditorFollowersMeta = (playbookId: string) => {
    const [followerIds, setFollowerIds] = useFollowerIds();
    const [isFollowing, setIsFollowing] = useIsFollowing();
    const currentUserId = useSelector(getCurrentUserId);

    const refresh = async () => {
        if (!playbookId || !currentUserId) {
            return;
        }
        const followers = await clientFetchPlaybookFollowers(playbookId);
        setFollowerIds(followers);
        setIsFollowing(followers.includes(currentUserId));
    };

    useEffect(() => {
        if (followerIds === null) {
            setFollowerIds([]);
            refresh();
        }
    }, [followerIds]);

    const setFollowing = async (following: boolean) => {
        setIsFollowing(following);
        await changeFollowing(playbookId, currentUserId, following);
        refresh();
    };

    return {followerIds: followerIds ?? [], isFollowing, setFollowing};
};

export const AutoFollowToggle = ({playbook}: ControlProps) => {
    const {formatMessage} = useIntl();
    const {isFollowing, setFollowing} = useEditorFollowersMeta(playbook.id);

    const archived = playbook.delete_at !== 0;

    let toolTipText = formatMessage({defaultMessage: 'Select this to automatically receive updates when this playbook is run.'});
    if (isFollowing) {
        toolTipText = formatMessage({defaultMessage: 'You automatically receive updates when this playbook is run.'});
    }

    const tooltip = (
        <Tooltip id={`auto-follow-tooltip-${isFollowing}`}>
            {toolTipText}
        </Tooltip>
    );

    return (
        <SecondaryButtonLargerCheckbox
            checked={isFollowing}
            disabled={archived}
        >
            <OverlayTrigger
                placement={'bottom'}
                delay={OVERLAY_DELAY}
                overlay={tooltip}
            >
                <div>
                    <CheckboxInputStyled
                        testId={'auto-follow-runs'}
                        text={formatMessage({defaultMessage: 'Auto-follow runs'})}
                        checked={isFollowing}
                        disabled={archived}
                        onChange={setFollowing}
                    />
                </div>
            </OverlayTrigger>
        </SecondaryButtonLargerCheckbox>
    );
};

const LEARN_PLAYBOOKS_TITLE = 'Learn how to use playbooks';
export const playbookIsTutorialPlaybook = (playbookTitle?: string) => playbookTitle === LEARN_PLAYBOOKS_TITLE;

export const RunPlaybook = ({playbook}: ControlProps) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const team = useSelector<GlobalState, Team>((state) => getTeam(state, playbook?.team_id || ''));
    const isTutorialPlaybook = playbookIsTutorialPlaybook(playbook.title);
    const hasPermissionToRunPlaybook = useHasPlaybookPermission(PlaybookPermissionGeneral.RunCreate, playbook);
    const enableRunPlaybook = playbook.delete_at === 0 && hasPermissionToRunPlaybook;
    const refreshLHS = useLHSRefresh();
    return (
        <PrimaryButtonLarger
            onClick={() => {
                dispatch(openPlaybookRunModal({
                    onRunCreated: (runId, channelId, statsData) => {
                        navigateToPluginUrl(`/runs/${runId}?from=run_modal`);
                        refreshLHS();
                        telemetryEvent(PlaybookRunEventTarget.Create, {...statsData, place: 'backstage_playbook_editor'});
                    },
                    playbookId: playbook.id,
                    teamId: team.id,
                }));
            }}
            disabled={!enableRunPlaybook}
            title={enableRunPlaybook ? formatMessage({defaultMessage: 'Run Playbook'}) : formatMessage({defaultMessage: 'You do not have permissions'})}
            data-testid='run-playbook'
        >
            <PlayOutlineIcon size={20}/>
            {isTutorialPlaybook ? (
                <FormattedMessage defaultMessage='Start a test run'/>
            ) : (
                <FormattedMessage defaultMessage='Run'/>
            )}
        </PrimaryButtonLarger>
    );
};

export const JoinPlaybook = ({playbook: {id: playbookId}, refetch}: ControlProps & {refetch: () => void;}) => {
    const {formatMessage} = useIntl();
    const currentUserId = useSelector(getCurrentUserId);
    const {join} = usePlaybookMembership(playbookId, currentUserId);
    const {setFollowing} = useEditorFollowersMeta(playbookId);

    return (
        <PrimaryButtonLarger
            onClick={async () => {
                await join();
                await setFollowing(true);
                refetch();
            }}
            data-testid='join-playbook'
        >
            <PlusIcon size={16}/>
            {formatMessage({defaultMessage: 'Join playbook'})}
        </PrimaryButtonLarger>
    );
};

export const FavoritePlaybookMenuItem = (props: {playbookId: string, isFavorite: boolean}) => {
    const {formatMessage} = useIntl();
    const updatePlaybookFavorite = useUpdatePlaybookFavorite(props.playbookId);

    const toggleFavorite = async () => {
        await updatePlaybookFavorite(!props.isFavorite);
    };
    return (
        <StyledDropdownMenuItem onClick={toggleFavorite}>
            {props.isFavorite ? (
                <><StarOutlineIcon size={18}/>{formatMessage({defaultMessage: 'Unfavorite'})}</>
            ) : (
                <><StarIcon size={18}/>{formatMessage({defaultMessage: 'Favorite'})}</>
            )}
        </StyledDropdownMenuItem>
    );
};

export const CopyPlaybookLinkMenuItem = (props: {playbookId: string}) => {
    const {formatMessage} = useIntl();
    const {add: addToast} = useToaster();

    return (
        <StyledDropdownMenuItem
            onClick={() => {
                copyToClipboard(getSiteUrl() + '/playbooks/playbooks/' + props.playbookId);
                addToast({content: formatMessage({defaultMessage: 'Copied!'})});
            }}
        >
            <LinkVariantIcon size={18}/>
            <FormattedMessage defaultMessage='Copy link'/>
        </StyledDropdownMenuItem>
    );
};

export const LeavePlaybookMenuItem = (props: {playbookId: string}) => {
    const currentUserId = useSelector(getCurrentUserId);
    const refreshLHS = useLHSRefresh();

    const {leave} = usePlaybookMembership(props.playbookId, currentUserId);
    return (
        <StyledDropdownMenuItem
            onClick={async () => {
                await leave();
                refreshLHS();
            }}
        >
            <CloseIcon
                size={18}
                color='currentColor'
            />
            <FormattedMessage defaultMessage='Leave'/>
        </StyledDropdownMenuItem>
    );
};

type TitleMenuProps = {
    className?: string;
    editTitle: () => void;
    refetch: () => void;
} & PropsWithChildren<ControlProps>;
const TitleMenuImpl = ({playbook, children, className, editTitle, refetch}: TitleMenuProps) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const [exportHref, exportFilename] = playbookExportProps(playbook);
    const [confirmArchiveModal, openDeletePlaybookModal] = useConfirmPlaybookArchiveModal(() => {
        if (playbook) {
            archivePlaybook(playbook.id);
            navigateToPluginUrl('/playbooks');
        }
    });
    const [confirmRestoreModal, openConfirmRestoreModal] = useConfirmPlaybookRestoreModal((playbookId: string) => restorePlaybook(playbookId));
    const [confirmConvertPrivateModal, setShowMakePrivateConfirm] = useConfirmPlaybookConvertPrivateModal({playbookId: playbook.id, refetch});

    const refreshLHS = useLHSRefresh();
    const {add: addToast} = useToaster();

    const currentUserId = useSelector(getCurrentUserId);

    const archived = playbook.delete_at !== 0;
    const currentUserMember = useMemo(() => playbook?.members.find(({user_id}) => user_id === currentUserId), [playbook?.members, currentUserId]);

    const permissionForDuplicate = useHasTeamPermission(playbook.team_id, 'playbook_public_create');
    const permissionToMakePrivate = useHasPlaybookPermission(PlaybookPermissionGeneral.Convert, playbook);
    const licenseToMakePrivate = useAllowMakePlaybookPrivate();
    const isEligibleToMakePrivate = currentUserMember && playbook.public && permissionToMakePrivate && licenseToMakePrivate;

    const {leave} = usePlaybookMembership(playbook.id, currentUserId);

    return (
        <>
            <DotMenu
                dotMenuButton={TitleButton}
                className={className}
                placement='bottom-start'
                focusManager={{returnFocus: false}}
                icon={
                    <>
                        {children}
                        <i className={'icon icon-chevron-down'}/>
                    </>
                }
            >
                {currentUserMember && (
                    <>
                        <DropdownMenuItem
                            onClick={() => dispatch(displayEditPlaybookAccessModal(playbook.id, refetch))}
                        >
                            <AccountMultipleOutlineIcon size={18}/>
                            <FormattedMessage defaultMessage='Manage access'/>
                        </DropdownMenuItem>
                        <div className='MenuGroup menu-divider'/>
                        <DropdownMenuItem
                            onClick={editTitle}
                            disabled={archived}
                            disabledAltText={formatMessage({defaultMessage: 'This archived playbook cannot be renamed.'})}
                        >
                            <PencilOutlineIcon size={18}/>
                            <FormattedMessage defaultMessage='Rename'/>
                        </DropdownMenuItem>
                    </>
                )}
                <DropdownMenuItem
                    onClick={async () => {
                        const newID = await clientDuplicatePlaybook(playbook.id);
                        navigateToPluginUrl(`/playbooks/${newID}/outline`);
                        addToast({content: formatMessage({defaultMessage: 'Successfully duplicated playbook'})});
                        refreshLHS();
                        telemetryEventForPlaybook(playbook.id, 'playbook_duplicate_clicked_in_playbook');
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
                    onClick={() => telemetryEventForPlaybook(playbook.id, 'playbook_export_clicked_in_playbook')}
                >
                    <ExportVariantIcon size={18}/>
                    <FormattedMessage defaultMessage='Export'/>
                </DropdownMenuItemStyled>
                {isEligibleToMakePrivate && (
                    <DropdownMenuItemStyled
                        role={'button'}
                        css={`${iconSplitStyling}`}
                        onClick={() => {
                            telemetryEventForPlaybook(playbook.id, 'playbook_makeprivate');
                            setShowMakePrivateConfirm(true);
                        }}
                    >
                        <LockOutlineIcon size={18}/>
                        <FormattedMessage defaultMessage='Convert to private playbook'/>
                    </DropdownMenuItemStyled>
                )
                }
                {currentUserMember && (
                    <>
                        <div className='MenuGroup menu-divider'/>
                        <DropdownMenuItem
                            onClick={async () => {
                                await leave();
                                refetch();
                            }}
                        >
                            <CloseIcon size={18}/>
                            <FormattedMessage defaultMessage='Leave'/>
                        </DropdownMenuItem>
                        <div className='MenuGroup menu-divider'/>
                        {archived ? (
                            <DropdownMenuItem
                                onClick={() => openConfirmRestoreModal(playbook, () => refetch())}
                            >
                                <RestoreIcon size={18}/>
                                <FormattedMessage defaultMessage='Restore'/>
                            </DropdownMenuItem>
                        ) : (
                            <DropdownMenuItem
                                onClick={() => openDeletePlaybookModal(playbook)}
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
            {confirmArchiveModal}
            {confirmRestoreModal}
            {confirmConvertPrivateModal}
        </>
    );
};

const DropdownMenuItem = styled(DropdownMenuItemBase)`
    ${iconSplitStyling};
    min-width: 220px;
`;

export const TitleMenu = styled(TitleMenuImpl)`
`;

const buttonCommon = css`
    padding: 0 16px;
    height: 36px;
    gap: 8px;

    i::before {
        margin-left: 0;
        margin-right: 0;
        font-size: 1.05em;
    }
`;

const PrimaryButtonLarger = styled(PrimaryButton)`
    ${buttonCommon};
`;

export const SecondaryButtonLarger = styled(SecondaryButton)`
    ${buttonCommon};
`;

const CheckboxInputStyled = styled(CheckboxInput)`
    padding: 8px 16px;
    font-size: 14px;
    height: 36px;

    &:hover {
        background-color: transparent;
    }
`;

const SecondaryButtonLargerCheckbox = styled(SecondaryButtonLarger) <{checked: boolean}>`
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.24);
    color: rgba(var(--center-channel-color-rgb), 0.56);
    padding: 0;

    &:hover:enabled {
        background-color: rgba(var(--center-channel-color-rgb), 0.08);
    }

    ${({checked}) => checked && css`
    border: 1px solid var(--button-bg);
        color: var(--button-bg);

        &:hover:enabled {
            background-color: rgba(var(--button-bg-rgb), 0.12);
        }
    `}
`;

const ButtonIconStyled = styled(ButtonIcon)`
    display: inline-flex;
    align-items: center;
    font-size: 14px;
    line-height: 24px;
    font-weight: 600;
    border-radius: 4px;
    padding: 0px 8px;
    margin: 0;
    color: rgba(var(--center-channel-color-rgb),0.56);
    height: 36px;
    width: auto;
`;

export const TitleButton = styled.div`
    padding-left: 16px;
    display: inline-flex;
    border-radius: 4px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    fill: rgba(var(--center-channel-color-rgb), 0.64);

    &:hover {
        background: rgba(var(--link-color-rgb), 0.08);
        color: rgba(var(--link-color-rgb), 0.72);
    }
`;

const RedText = styled.div`
    color: var(--error-text);
`;
