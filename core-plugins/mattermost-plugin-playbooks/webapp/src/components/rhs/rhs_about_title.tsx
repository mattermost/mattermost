// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';
import styled, {css} from 'styled-components';
import {useIntl} from 'react-intl';
import {OverlayTrigger, Tooltip} from 'react-bootstrap';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {BookOutlineIcon} from '@mattermost/compass-icons/components';

import {PrimaryButton, TertiaryButton} from 'src/components/assets/buttons';
import {CONTEXT_MENU_LOCATION, ContextMenu} from 'src/components/backstage/playbook_runs/playbook_run/context_menu';
import {Role} from 'src/components/backstage/playbook_runs/shared';
import {CancelSaveContainer} from 'src/components/checklist_item/inputs';
import TextEdit from 'src/components/text_edit';
import {SemiBoldHeading} from 'src/styles/headings';
import {PlaybookRun, PlaybookRunStatus} from 'src/types/playbook_run';
import {PlaybookRunType} from 'src/graphql/generated/graphql';
import {usePlaybookName} from 'src/hooks';
import {navigateToUrl, pluginUrl} from 'src/browser_routing';
import {OVERLAY_DELAY} from 'src/constants';

interface Props {
    playbookRun: PlaybookRun;
    onEdit: (newTitle: string) => void;
    isFavoriteRun: boolean;
    isFollowing: boolean;
    hasPermanentViewerAccess: boolean;
    toggleFavorite: () => void;
}

const RHSAboutTitle = (props: Props) => {
    const {formatMessage} = useIntl();
    const currentUserId = useSelector(getCurrentUserId);

    // Determine role
    const isParticipant = props.playbookRun.participant_ids.includes(currentUserId);
    const role = isParticipant ? Role.Participant : Role.Viewer;

    // Fetch playbook name for runs (not channel checklists)
    const isPlaybookRun = props.playbookRun.type === PlaybookRunType.Playbook;
    const playbookName = usePlaybookName(props.playbookRun.playbook_id);
    const showPlaybookChip = isPlaybookRun && playbookName && props.playbookRun.playbook_id;

    const handlePlaybookChipClick = () => {
        if (props.playbookRun.playbook_id) {
            navigateToUrl(pluginUrl(`/playbooks/${props.playbookRun.playbook_id}`));
        }
    };

    return (
        <>
            {showPlaybookChip && (
                <PlaybookChipContainer>
                    <OverlayTrigger
                        placement='top'
                        delay={OVERLAY_DELAY}
                        overlay={
                            <Tooltip id={`playbook-chip-${props.playbookRun.id}`}>
                                {formatMessage(
                                    {defaultMessage: 'Created from {playbook} playbook'},
                                    {playbook: playbookName}
                                )}
                            </Tooltip>
                        }
                    >
                        <PlaybookChip
                            onClick={handlePlaybookChipClick}
                            data-testid='playbook-badge'
                        >
                            <StyledBookOutlineIcon size={11}/>
                            <PlaybookChipText>{playbookName}</PlaybookChipText>
                        </PlaybookChip>
                    </OverlayTrigger>
                </PlaybookChipContainer>
            )}
            <TitleWrapper>
                <TextEdit
                    disabled={props.playbookRun.current_status !== PlaybookRunStatus.InProgress}
                    placeholder={formatMessage({defaultMessage: 'Run name'})}
                    value={props.playbookRun.name}
                    onSave={(name: string) => props.onEdit(name)}
                    testId='rendered-run-name'
                    editStyles={css`
                        display: flex;
                        flex-direction: column;
                        align-items: flex-start;
                        width: 100%;

                        input {
                            ${SemiBoldHeading};
                            font-size: 18px;
                            line-height: 24px;
                            color: var(--center-channel-color);
                            height: 30px;
                            width: 100%;
                            padding: 0 8px;
                            border-radius: 5px;
                            border: none;
                            background: rgba(var(--center-channel-color-rgb), 0.04);
                            margin-bottom: 0;
                        }
                        ${CancelSaveContainer} {
                            padding: 0;
                            margin-top: 8px;
                            align-self: flex-end;
                        }
                        ${PrimaryButton}, ${TertiaryButton} {
                            height: 28px;
                        }
                    `}
                >
                    {(edit: () => void) => (
                        <>
                            <ContextMenu
                                playbookRun={props.playbookRun}
                                role={role}
                                onRenameClick={edit}
                                isFavoriteRun={props.isFavoriteRun}
                                isFollowing={props.isFollowing}
                                toggleFavorite={props.toggleFavorite}
                                hasPermanentViewerAccess={props.hasPermanentViewerAccess}
                                location={CONTEXT_MENU_LOCATION.RHS}
                            />
                        </>
                    )}
                </TextEdit>
            </TitleWrapper>
        </>
    );
};

const PlaybookChipContainer = styled.div`
    margin-bottom: 8px;
`;

const PlaybookChip = styled.button`
    display: inline-flex;
    max-width: 100%;
    flex-direction: row;
    align-items: center;
    padding: 0 4px;
    border-radius: 4px;
    background: rgba(var(--center-channel-color-rgb), 0.08);
    gap: 4px;
    cursor: pointer;
    transition: background 0.15s ease;
    border: none;

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.16);
    }
`;

const PlaybookChipText = styled.span`
    overflow: hidden;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-size: 10px;
    font-weight: 600;
    line-height: 16px;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const StyledBookOutlineIcon = styled(BookOutlineIcon)`
    flex-shrink: 0;
`;

const TitleWrapper = styled.div`
    display: flex;
    align-items: center;
    margin-bottom: 6px;
`;

export default RHSAboutTitle;
