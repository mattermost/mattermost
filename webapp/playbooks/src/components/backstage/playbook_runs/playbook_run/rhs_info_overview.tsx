// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {Link} from 'react-router-dom';
import {useIntl} from 'react-intl';
import styled, {css} from 'styled-components';
import {Channel} from '@mattermost/types/channels';

import {
    AccountMultipleOutlineIcon,
    AccountOutlineIcon,
    ArrowForwardIosIcon,
    BookOutlineIcon,
    BullhornOutlineIcon,
    LockOutlineIcon,
    OpenInNewIcon,
    ProductChannelsIcon,
} from '@mattermost/compass-icons/components';
import {UserProfile} from '@mattermost/types/users';

import {TertiaryButton} from 'src/components/assets/buttons';
import FollowButton from 'src/components/backstage/follow_button';
import {Role} from 'src/components/backstage/playbook_runs/shared';
import {useToaster} from 'src/components/backstage/toast_banner';
import {ToastStyle} from 'src/components/backstage/toast';
import Following from 'src/components/backstage/playbook_runs/playbook_run/following';
import AssignTo, {AssignToContainer} from 'src/components/checklist_item/assign_to';
import {UserList} from 'src/components/rhs/rhs_participants';
import {Section, SectionHeader} from 'src/components/backstage/playbook_runs/playbook_run/rhs_info_styles';
import ConfirmModal from 'src/components/widgets/confirmation_modal';
import {setOwner as clientSetOwner, requestJoinChannel} from 'src/client';
import {pluginUrl} from 'src/browser_routing';
import {Metadata, PlaybookRun} from 'src/types/playbook_run';
import {PlaybookWithChecklist} from 'src/types/playbook';
import {CompassIcon} from 'src/types/compass';

import {useLHSRefresh} from 'src/components/backstage/lhs_navigation';

import {FollowState} from './rhs_info';

const useRequestJoinChannel = (playbookRunId: string) => {
    const {formatMessage} = useIntl();
    const addToast = useToaster().add;
    const [showRequestJoinConfirm, setShowRequestJoinConfirm] = useState(false);
    const requestJoin = async () => {
        const response = await requestJoinChannel(playbookRunId);
        if (response?.error) {
            addToast({
                content: formatMessage({defaultMessage: 'The join channel request was unsuccessful.'}),
                toastStyle: ToastStyle.Failure,
            });
        } else {
            addToast({
                content: formatMessage({defaultMessage: 'Your request was sent to the run channel.'}),
                toastStyle: ToastStyle.Success,
            });
        }
    };
    const RequestJoinModal = (
        <ConfirmModal
            show={showRequestJoinConfirm}
            title={formatMessage({defaultMessage: 'Request to join channel'})}
            message={formatMessage({defaultMessage: 'A join request will be sent to the run channel.'})}
            confirmButtonText={formatMessage({defaultMessage: 'Send request '})}
            onConfirm={() => {
                requestJoin();
                setShowRequestJoinConfirm(false);
            }}
            onCancel={() => setShowRequestJoinConfirm(false)}
        />
    );
    return {
        RequestJoinModal,
        showRequestJoinConfirm: () => setShowRequestJoinConfirm(true),
    };
};

interface Props {
    run: PlaybookRun;
    runMetadata?: Metadata;
    editable: boolean;
    channel: Channel | undefined | null;
    followState: FollowState;
    playbook?: PlaybookWithChecklist;
    role: Role;
    onViewParticipants: () => void;
}

const StyledArrowIcon = styled(ArrowForwardIosIcon)`
    margin-left: 7px;
`;

const RHSInfoOverview = ({run, role, channel, runMetadata, followState, editable, playbook, onViewParticipants}: Props) => {
    const {formatMessage} = useIntl();
    const addToast = useToaster().add;
    const refreshLHS = useLHSRefresh();
    const {RequestJoinModal, showRequestJoinConfirm} = useRequestJoinChannel(run.id);

    const setOwner = async (userID: string) => {
        try {
            const response = await clientSetOwner(run.id, userID);

            if (response.error) {
                let message;
                switch (response.error.status_code) {
                case 403:
                    message = formatMessage({defaultMessage: 'You have no permissions to change the owner'});
                    break;
                default:
                    message = formatMessage({defaultMessage: 'It was not possible to change the owner'});
                }

                addToast({
                    content: message,
                    toastStyle: ToastStyle.Failure,
                });
            } else {
                refreshLHS();
            }
        } catch (error) {
            addToast({
                content: formatMessage({defaultMessage: 'It was not possible to change the owner'}),
                toastStyle: ToastStyle.Failure,
            });
        }
    };

    const onOwnerChange = async (user?: UserProfile) => {
        if (!user) {
            return;
        }
        setOwner(user.id);
    };

    return (
        <Section>
            <SectionHeader title={formatMessage({defaultMessage: 'Overview'})}/>
            <Item
                id='runinfo-playbook'
                icon={BookOutlineIcon}
                name={formatMessage({defaultMessage: 'Playbook'})}
            >
                {playbook ? <ItemLink to={pluginUrl(`/playbooks/${run.playbook_id}`)}>{playbook.title}</ItemLink> : <ItemDisabledContent><LockOutlineIcon size={18}/>{formatMessage({defaultMessage: 'Private'})}</ItemDisabledContent>}
            </Item>
            <Item
                id='runinfo-owner'
                icon={AccountOutlineIcon}
                name={formatMessage({defaultMessage: 'Owner'})}
            >
                <AssignTo
                    assignee_id={run.owner_user_id}
                    editable={editable}
                    onSelectedChange={onOwnerChange}
                    participantUserIds={run.participant_ids}
                    placement={'bottom-end'}
                />
            </Item>
            <Item
                id='runinfo-participants'
                icon={AccountMultipleOutlineIcon}
                name={formatMessage({defaultMessage: 'Participants'})}
                onClick={onViewParticipants}
            >
                <ParticipantsContainer>
                    <Participants>
                        <UserList
                            userIds={run.participant_ids}
                            sizeInPx={20}
                        />
                    </Participants>
                    <StyledArrowIcon
                        size={12}
                        color={'rgba(var(--center-channel-color-rgb), 0.56)'}
                    />
                </ParticipantsContainer>
            </Item>
            <Item
                id='runinfo-following'
                icon={BullhornOutlineIcon}
                name={formatMessage({defaultMessage: 'Followers'})}
            >
                <FollowersWrapper>
                    <FollowButton
                        runID={run.id}
                        followState={followState}
                        trigger={'run_details'}
                    />
                    <Following
                        userIds={followState.followers}
                        maxUsers={4}
                    />
                </FollowersWrapper>
            </Item>
            <Item
                id='runinfo-channel'
                icon={ProductChannelsIcon}
                name={formatMessage({defaultMessage: 'Channel'})}
            >
                {channel && runMetadata ? <>
                    <ItemLink
                        to={`/${runMetadata.team_name}/channels/${channel.name}`}
                        data-testid='runinfo-channel-link'
                    >
                        <ItemContent >
                            {channel.display_name}
                        </ItemContent>
                        <OpenInNewIcon
                            size={14}
                            color={'var(--button-bg)'}
                        />
                    </ItemLink>
                </> : <ItemDisabledContent>
                    {role === Role.Participant ? <RequestJoinButton onClick={showRequestJoinConfirm}>{formatMessage({defaultMessage: 'Request to Join'})}</RequestJoinButton> : null}
                    <LockOutlineIcon size={20}/> {formatMessage({defaultMessage: 'Private'})}
                </ItemDisabledContent>
                }
            </Item>
            {RequestJoinModal}
        </Section>
    );
};

export default RHSInfoOverview;

interface ItemProps {
    id: string;
    icon: CompassIcon;
    name: string;
    children: React.ReactNode;
    onClick?: () => void;
}

const Item = (props: ItemProps) => {
    const Icon = props.icon;

    return (
        <OverviewRow
            onClick={props.onClick}
            data-testid={props.id}
        >
            <OverviewItemName>
                <Icon
                    size={18}
                    color={'rgba(var(--center-channel-color-rgb), 0.56)'}
                />
                {props.name}
            </OverviewItemName>
            {props.children}
        </OverviewRow>
    );
};

const ItemLink = styled(Link)`
    display: flex;
    flex-direction: row;
    align-items: center;

    svg {
        margin-left: 3px;
    }
`;

const ItemContent = styled.div`
    max-width: 230px;
    display: inline-flex;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    align-items: center;
`;

const ItemDisabledContent = styled(ItemContent)`
    svg {
        margin-right: 3px;
    }
    color: rgba(var(--center-channel-color-rgb), 0.64);
`;

const OverviewRow = styled.div<{onClick?: () => void}>`
    padding: 10px 24px;
    height: 44px;
    display: flex;
    justify-content: space-between;

    :hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
    }

    ${({onClick}) => onClick && css`
        cursor: pointer;
    `}

    ${AssignToContainer} {
        margin-left: 0;
        max-width: none;
    }
`;

const OverviewItemName = styled.div`
    display: flex;
    align-items: center;
    gap: 11px;
`;

const Participants = styled.div`
    display: flex;
    flex-direction: row;
`;

const FollowersWrapper = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
`;

const RequestJoinButton = styled(TertiaryButton)`
    font-size: 12px;
    height: 24px;
    padding: 0 10px;
    margin-right: 10px;
`;

const ParticipantsContainer = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
`;
