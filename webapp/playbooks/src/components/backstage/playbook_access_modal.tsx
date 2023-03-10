import {getTeam} from 'mattermost-redux/selectors/entities/teams';
import {getProfilesInTeam, searchProfiles} from 'mattermost-redux/actions/users';
import {GlobalState} from '@mattermost/types/store';
import {Team} from '@mattermost/types/teams';
import React, {ComponentProps, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import styled from 'styled-components';

import GenericModal from 'src/components/widgets/generic_modal';
import {AdminNotificationType, PROFILE_CHUNK_SIZE} from 'src/constants';
import {useAllowMakePlaybookPrivate, useEditPlaybook, useHasPlaybookPermission} from 'src/hooks';
import {Playbook, PlaybookMember, PlaybookWithChecklist} from 'src/types/playbook';

import {PlaybookPermissionGeneral, PlaybookRole} from 'src/types/permissions';

import SelectUsersBelow from './select_users_below';
import UpgradeModal from './upgrade_modal';
import useConfirmPlaybookConvertPrivateModal from './convert_private_playbook_modal';

const ID = 'playbooks_access';

type Props = {
    playbookId: string
    refetch?: () => void
} & Partial<ComponentProps<typeof GenericModal>>;

export const makePlaybookAccessModalDefinition = (props: Props) => ({
    modalId: ID,
    dialogType: PlaybookAccessModal,
    dialogProps: props,
});

const SizedGenericModal = styled(GenericModal)`
    width: 800px;
`;

const HorizontalBlock = styled.div`
    display: flex;
    flex-direction: row;
    color: rgba(var(--center-channel-color-rgb), 0.64);

    > i {
        font-size: 12px;
        margin-left: -3px;
    }
`;

const SubTitle = styled.div`
    font-size: 12px;
    line-height: 16px;
`;

const PrivateLink = styled.a`
	font-size: 12px;
	line-height: 16px;
	color: var(--link-color);
	margin-left: 4px;
	margin-right: 3px;
`;

const BlueArrow = styled.i`
	color: var(--link-color);
`;

const PlaybookAccessModal = ({
    playbookId,
    refetch,
    ...modalProps
}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const [playbook, updatePlaybook] = useEditPlaybook(playbookId, refetch);
    const team = useSelector<GlobalState, Team>((state) => getTeam(state, playbook?.team_id || ''));
    const permissionToMakePrivate = useHasPlaybookPermission(PlaybookPermissionGeneral.Convert, playbook);
    const licenseToMakePrivate = useAllowMakePlaybookPrivate();

    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [confirmConvertPrivateModal, setShowMakePrivateConfirm] = useConfirmPlaybookConvertPrivateModal({playbookId, refetch, updater: updatePlaybook});

    const onChange = (update: Partial<PlaybookWithChecklist>) => {
        if (playbook) {
            const updatedPlaybook: PlaybookWithChecklist = {...playbook, ...update};
            updatePlaybook(updatedPlaybook);
        }
    };

    const onAddMember = (member: PlaybookMember) => {
        if (!playbook) {
            return;
        }
        if (!playbook.members.find((elem: PlaybookMember) => elem.user_id === member.user_id)) {
            onChange({
                members: [...playbook.members, member],
            });
        }
    };

    const onRemoveUser = (userId: string) => {
        if (!playbook) {
            return;
        }
        const idx = playbook.members.findIndex((elem: PlaybookMember) => elem.user_id === userId);
        onChange({
            members: [...playbook.members.slice(0, idx), ...playbook.members.slice(idx + 1)],
        });
    };

    const modifyRoles = (userId: string, roles: string[]) => {
        if (!playbook) {
            return;
        }
        const idx = playbook.members.findIndex((elem: PlaybookMember) => elem.user_id === userId);
        const member = {...playbook.members[idx]};
        member.roles = roles;
        onChange({
            members: [...playbook.members.slice(0, idx), ...playbook.members.slice(idx + 1), member],
        });
    };

    const onMakeAdmin = (userId: string) => {
        modifyRoles(userId, [PlaybookRole.Admin, PlaybookRole.Member]);
    };

    const onMakeMember = (userId: string) => {
        modifyRoles(userId, [PlaybookRole.Member]);
    };

    const searchUsers = (term: string) => {
        return dispatch(searchProfiles(term, {team_id: playbook?.team_id}));
    };

    const getUsers = () => {
        return dispatch(getProfilesInTeam(playbook?.team_id || '', 0, PROFILE_CHUNK_SIZE, '', {active: true}));
    };

    const getSubtitle = (pb: Playbook) => {
        if (pb.public) {
            if (team) {
                return formatMessage({defaultMessage: 'Everyone in {team} can view this playbook.'}, {team: team.display_name});
            }
            return formatMessage({defaultMessage: 'Everyone in this team can view this playbook.'});
        }
        return formatMessage({defaultMessage: '{members, plural, =0 {No one} =1 {One person} other {# people}} can access this playbook.'}, {members: pb.members.length});
    };

    return (
        <>
            <SizedGenericModal
                modalHeaderText={formatMessage({defaultMessage: 'Playbook Access'})}
                {...modalProps}
                id={ID}
            >
                {playbook &&
                <>
                    <HorizontalBlock>
                        <i className={'icon ' + (playbook.public ? 'icon-globe' : 'icon-lock-outline')}/>
                        <SubTitle>{getSubtitle(playbook)}</SubTitle>
                        {(playbook.public && permissionToMakePrivate && licenseToMakePrivate) &&
                        <>
                            <PrivateLink
                                onClick={() => setShowMakePrivateConfirm(true)}
                            >
                                {formatMessage({defaultMessage: 'Convert to private playbook'})}
                            </PrivateLink>
                            <BlueArrow className={'icon icon-arrow-right'}/>
                        </>
                        }
                    </HorizontalBlock>
                    <SelectUsersBelow
                        playbook={playbook}
                        members={playbook.members}
                        onAddMember={onAddMember}
                        onRemoveUser={onRemoveUser}
                        onMakeAdmin={onMakeAdmin}
                        onMakeMember={onMakeMember}
                        searchProfiles={searchUsers}
                        getProfiles={getUsers}
                    />
                </>
                }
            </SizedGenericModal>
            {confirmConvertPrivateModal}
            <UpgradeModal
                messageType={AdminNotificationType.PLAYBOOK_GRANULAR_ACCESS}
                show={showUpgradeModal}
                onHide={() => setShowUpgradeModal(false)}
            />
        </>
    );
};
