// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {UserProfile} from '@mattermost/types/users';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {PlaybookRun, PlaybookRunStatus} from 'src/types/playbook_run';
import {setOwner} from 'src/client';
import ProfileSelector from 'src/components/profile/profile_selector';
import RHSPostUpdate from 'src/components/rhs/rhs_post_update';
import {useEnsureProfiles, useParticipateInRun, useProfilesInTeam} from 'src/hooks';
import RHSParticipants from 'src/components/rhs/rhs_participants';
import {HoverMenu} from 'src/components/rhs/rhs_shared';
import RHSAboutButtons from 'src/components/rhs/rhs_about_buttons';
import RHSAboutTitle, {DefaultRenderedTitle} from 'src/components/rhs/rhs_about_title';
import RHSAboutDescription from 'src/components/rhs/rhs_about_description';
import {currentRHSAboutCollapsedState} from 'src/selectors';
import {setRHSAboutCollapsedState} from 'src/actions';
import {useUpdateRun} from 'src/graphql/hooks';

interface Props {
    playbookRun: PlaybookRun;
    readOnly?: boolean;
    onReadOnlyInteract?: () => void
    setShowParticipants: React.Dispatch<React.SetStateAction<boolean>>
}

const RHSAbout = (props: Props) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const collapsed = useSelector(currentRHSAboutCollapsedState);
    const channel = useSelector(getCurrentChannel);
    const profilesInTeam = useProfilesInTeam();
    const updateRun = useUpdateRun(props.playbookRun.id);

    const myUserId = useSelector(getCurrentUserId);
    const shouldShowParticipate = myUserId !== props.playbookRun.owner_user_id && props.playbookRun.participant_ids.find((id: string) => id === myUserId) === undefined;

    const toggleCollapsed = () => dispatch(setRHSAboutCollapsedState(channel.id, !collapsed));
    const fetchUsersInTeam = async () => {
        return profilesInTeam;
    };

    const setOwnerUtil = async (userId?: string) => {
        if (!userId) {
            return;
        }
        const response = await setOwner(props.playbookRun.id, userId);
        if (response.error) {
            // TODO: Should be presented to the user? https://mattermost.atlassian.net/browse/MM-24271
            console.log(response.error); // eslint-disable-line no-console
        }
    };

    const onSelectedProfileChange = (user?: UserProfile) => {
        if (!user) {
            return;
        }
        setOwnerUtil(user?.id);
    };

    const onTitleEdit = (value: string) => {
        updateRun({name: value});
    };

    const onDescriptionEdit = (value: string) => {
        updateRun({summary: value});
    };

    const [editingSummary, setEditingSummary] = useState(false);
    const editSummary = () => {
        setEditingSummary(true);
    };

    const isFinished = props.playbookRun.current_status === PlaybookRunStatus.Finished;
    const {ParticipateConfirmModal, showParticipateConfirm} = useParticipateInRun(props.playbookRun, 'channel_rhs');
    useEnsureProfiles(props.playbookRun.participant_ids);

    return (
        <>
            <Container
                tabIndex={0}
                id={'rhs-about'}
            >
                <ButtonsRow data-testid='buttons-row'>
                    <RHSAboutButtons
                        playbookRun={props.playbookRun}
                        collapsed={collapsed}
                        toggleCollapsed={toggleCollapsed}
                        editSummary={editSummary}
                        readOnly={props.readOnly}
                    />
                </ButtonsRow>
                <RHSAboutTitle
                    value={props.playbookRun.name}
                    onEdit={onTitleEdit}
                    renderedTitle={RenderedTitle}
                    status={props.playbookRun.current_status}
                />
                {!collapsed &&
                    <>
                        <RHSAboutDescription
                            value={props.playbookRun.summary}
                            onEdit={onDescriptionEdit}
                            editing={editingSummary}
                            setEditing={setEditingSummary}
                            readOnly={props.readOnly}
                            onReadOnlyInteract={props.onReadOnlyInteract}
                        />
                        <Row>
                            <OwnerSection>
                                <MemberSectionTitle>{formatMessage({defaultMessage: 'Owner'})}</MemberSectionTitle>
                                <StyledProfileSelector
                                    testId={'owner-profile-selector'}
                                    selectedUserId={props.playbookRun.owner_user_id}
                                    placeholder={formatMessage({defaultMessage: 'Assign the owner role'})}
                                    placeholderButtonClass={'NoAssignee-button'}
                                    profileButtonClass={'Assigned-button'}
                                    enableEdit={!isFinished && !props.readOnly}
                                    onEditDisabledClick={props.onReadOnlyInteract}
                                    getAllUsers={fetchUsersInTeam}
                                    onSelectedChange={onSelectedProfileChange}
                                    selfIsFirstOption={true}
                                    userGroups={{
                                        subsetUserIds: props.playbookRun.participant_ids,
                                        defaultLabel: formatMessage({defaultMessage: 'NOT PARTICIPATING'}),
                                        subsetLabel: formatMessage({defaultMessage: 'RUN PARTICIPANTS'}),
                                    }}
                                />
                            </OwnerSection>
                            <ParticipantsSection>
                                <MemberSectionTitle>{formatMessage({defaultMessage: 'Participants'})}</MemberSectionTitle>
                                <RHSParticipants
                                    userIds={props.playbookRun.participant_ids.filter((id) => id !== props.playbookRun.owner_user_id)}
                                    onParticipate={shouldShowParticipate ? showParticipateConfirm : undefined}
                                    setShowParticipants={props.setShowParticipants}
                                />
                            </ParticipantsSection>
                        </Row>
                    </>
                }
                {props.playbookRun.status_update_enabled && (
                    <RHSPostUpdate
                        readOnly={props.readOnly}
                        onReadOnlyInteract={props.onReadOnlyInteract}
                        collapsed={collapsed}
                        playbookRun={props.playbookRun}
                        updatesExist={props.playbookRun.status_posts.length !== 0}
                    />
                )}
            </Container>
            {ParticipateConfirmModal}
        </>
    );
};

const Container = styled.div`
    position: relative;
    z-index: 2;

    margin-top: 3px;
    padding: 16px 12px;

    :hover {
        background-color: rgba(var(--center-channel-color-rgb), 0.04);
    }
`;

const StyledProfileSelector = styled(ProfileSelector)`
    margin-top: 8px;

    .Assigned-button {
        max-width: 100%;
        height: 28px;
        padding: 2px;
        margin-top: 0;
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: var(--center-channel-color);
        border-radius: 100px;

        :hover {
            background: rgba(var(--center-channel-color-rgb), 0.16);
        }

        .image {
            width: 24px;
            height: 24px;
        }
    }
`;

const ButtonsRow = styled(HoverMenu)`
    top: 9px;
    right: 12px;

    display: none;

    ${Container}:hover & {
        display: block;
    }
`;

const RenderedTitle = styled(DefaultRenderedTitle)`
    ${Container}:hover & {
        max-width: calc(100% - 75px);
    }
`;

const Row = styled.div`
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;

    padding: 0 8px;
    margin-bottom: 30px;
`;

const MemberSection = styled.div`
    :not(:first-child) {
        margin-left: 36px;
    }
`;

const OwnerSection = styled(MemberSection)`
    max-width: calc(100% - 210px);
`;

const ParticipantsSection = styled(MemberSection)`
`;

const MemberSectionTitle = styled.div`
    font-weight: 600;
    font-size: 12px;
    line-height: 16px;

    color: rgba(var(--center-channel-color-rgb), 0.72);
`;

export default RHSAbout;
