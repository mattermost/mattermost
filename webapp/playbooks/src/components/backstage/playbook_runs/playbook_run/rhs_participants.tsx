// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';
import {AccountPlusOutlineIcon} from '@mattermost/compass-icons/components';
import {useDispatch, useSelector} from 'react-redux';
import {getProfilesByIds} from 'mattermost-redux/actions/users';
import {UserProfile} from 'mattermost-webapp/packages/types/src/users';
import {sortByUsername} from 'mattermost-redux/utils/user_utils';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import Profile from 'src/components/profile/profile';
import Tooltip from 'src/components/widgets/tooltip';
import {formatProfileName} from 'src/components/profile/profile_selector';

import SearchInput from 'src/components/backstage/search_input';

import {PrimaryButton, TertiaryButton} from 'src/components/assets/buttons';
import DotMenu, {DropdownMenuItem} from 'src/components/dot_menu';
import {useManageRunMembership} from 'src/graphql/hooks';

import {Role} from 'src/components/backstage/playbook_runs/shared';

import {PlaybookRun} from 'src/types/playbook_run';

import {telemetryEvent} from 'src/client';

import {PlaybookRunEventTarget} from 'src/types/telemetry';

import {SendMessageButton} from './send_message_button';
import AddParticipantsModal from './add_participant_modal';

interface Props {
    playbookRun: PlaybookRun;
    role: Role;
    teamName?: string;
}

export const Participants = ({playbookRun, role, teamName}: Props) => {
    const dispatch = useDispatch();

    const {formatMessage} = useIntl();
    const [manageMode, setManageMode] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const myUser = useSelector(getCurrentUser);
    const [participantsProfiles, setParticipantsProfiles] = useState<UserProfile[]>([]);
    const [showAddParticipantsModal, setShowAddParticipantsModal] = useState(false);

    const {removeFromRun, changeRunOwner} = useManageRunMembership(playbookRun.id);

    const remove = (userIDs?: string[] | undefined) => {
        telemetryEvent(PlaybookRunEventTarget.Leave, {playbookrun_id: playbookRun.id, from: 'run_details', trigger: 'remove_participant', count: userIDs?.length.toString() ?? ''});
        return removeFromRun(userIDs);
    };

    useEffect(() => {
        const profiles = dispatch(getProfilesByIds(playbookRun.participant_ids));

        //@ts-ignore
        profiles.then(({data}: { data: UserProfile[] }) => {
            // getProfilesByIds doesn't return current user profile, so add it when a user is participant
            if (role === Role.Participant) {
                data.push(myUser);
            }
            data.sort(sortByUsername);
            setParticipantsProfiles(data || []);
        });
    }, [dispatch, myUser, playbookRun.participant_ids, role]);

    const includesTerm = (user: UserProfile) => {
        const userInfo = user.first_name + ';' + user.last_name + ';' + user.nickname + ';' + user.username;
        if (!userInfo.toLowerCase().includes(searchTerm.toLowerCase())) {
            return false;
        }
        return true;
    };

    const manageParticipantsSection = () => {
        if (manageMode) {
            return (
                <StyledPrimaryButton onClick={() => setManageMode(false)}>
                    {formatMessage({defaultMessage: 'Done'})}
                </StyledPrimaryButton>
            );
        }

        return (
            <>
                <StyledSecondaryButton
                    onClick={() => setManageMode(true)}
                    data-testid='participants-manage-btn'
                >
                    {formatMessage({defaultMessage: 'Manage'})}
                </StyledSecondaryButton>

                <StyledPrimaryButton onClick={() => setShowAddParticipantsModal(true)}>
                    <AddParticipantIcon color={'var(--button-color)'}/>
                    {formatMessage({defaultMessage: 'Add'})}
                </StyledPrimaryButton>

                <AddParticipantsModal
                    playbookRun={playbookRun}
                    id={'add-participants-rdp'}
                    show={showAddParticipantsModal}
                    title={formatMessage({defaultMessage: 'Add people to {runName}'}, {runName: playbookRun.name})}
                    hideModal={() => setShowAddParticipantsModal(false)}
                />
            </>
        );
    };

    return (
        <Container>
            <HeaderSection>
                <ParticipantsNumber>
                    {formatMessage(
                        {defaultMessage: '{num} {num, plural, one {Participant} other {Participants}}'},
                        {num: playbookRun.participant_ids.length}
                    )}
                </ParticipantsNumber>

                {role === Role.Participant && manageParticipantsSection()}

            </HeaderSection>

            <SearchSection>
                <SearchInput
                    testId={'search-filter'}
                    default={''}
                    onSearch={setSearchTerm}
                    placeholder={formatMessage({defaultMessage: 'Search'})}
                    width={'100%'}
                />
            </SearchSection>
            <SectionTitle>
                {formatMessage({defaultMessage: 'Owner'})}
            </SectionTitle>

            <ParticipantRow
                testId={'run-owner'}
                id={playbookRun.owner_user_id}
                teamName={teamName}
                isRunOwner={true}
                manageMode={manageMode}
                removeFromRun={remove}
                changeRunOwner={changeRunOwner}
            />

            {participantsProfiles.filter((user) => user.id !== playbookRun.owner_user_id).length ? <SectionTitle>
                {formatMessage({defaultMessage: 'Participants'})}
            </SectionTitle> : null}
            <ListSection>
                {
                    participantsProfiles.filter((user) => (includesTerm(user))).map((user: UserProfile) => {
                        // skip the owner
                        if (user.id === playbookRun.owner_user_id) {
                            return null;
                        }
                        return (
                            <ParticipantRow
                                testId={user.id}
                                key={user.id}
                                id={user.id}
                                teamName={teamName}
                                isRunOwner={false}
                                manageMode={manageMode}
                                removeFromRun={remove}
                                changeRunOwner={changeRunOwner}
                            />
                        );
                    })
                }
            </ListSection>
        </Container>
    );
};

interface ParticipantRowProps {
    id: string;
    teamName: string | undefined;
    isRunOwner: boolean;
    manageMode: boolean;
    removeFromRun: (userIDs?: string[] | undefined) => Promise<void>;
    changeRunOwner: (ownerID?: string | undefined) => Promise<void>;
    testId?: string;
}

const ParticipantRow = ({id, teamName, isRunOwner, manageMode, removeFromRun, changeRunOwner, testId}: ParticipantRowProps) => {
    const {formatMessage} = useIntl();

    const renderRightButton = () => {
        if (!manageMode) {
            return (
                <HoverButtonContainer>
                    <Tooltip
                        id={`${id}-tooltip`}
                        shouldUpdatePosition={true}
                        content={formatMessage({defaultMessage: 'Send message'})}
                    >
                        <SendMessageButton
                            userId={id}
                            teamName={teamName ?? null}
                        />
                    </Tooltip>
                </HoverButtonContainer>
            );
        }

        if (isRunOwner) {
            return null;
        }

        return (
            <DotMenu
                placement='bottom-end'
                dotMenuButton={ParticipantButton}
                icon={
                    <IconWrapper>
                        {formatMessage({defaultMessage: 'Participant'})}
                        <i className={'icon-chevron-down'}/>
                    </IconWrapper>
                }
            >
                <DropdownMenuItem
                    onClick={() => changeRunOwner(id)}
                >
                    {formatMessage({defaultMessage: 'Make run owner'})}
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => {
                        removeFromRun([id]);
                    }}
                >
                    {formatMessage({defaultMessage: 'Remove from run'})}
                </DropdownMenuItem>
            </DotMenu>
        );
    };

    return (
        <ProfileWrapper
            data-testid={testId}
            key={id}
            manageMode={manageMode}
        >
            <Profile
                userId={id}
                nameFormatter={formatProfileName('')}
                css={`
                    width: ${(manageMode ? '75%' : '95%')};
                `}
            />
            {renderRightButton()}
        </ProfileWrapper>
    );
};

const Container = styled.div`
    display: flex;
    flex-direction: column;
`;

const ParticipantsNumber = styled.div`
    color: var(--center-channel-color);
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
    margin-right: auto;
`;

const SectionTitle = styled.div`
    color: rgba(var(--sys-center-channel-color-rgb), 0.56);
    font-size: 12px;
    font-weight: 600;
    line-height: 16px;
    text-transform: uppercase;
    margin-top: 16px;
    padding: 0 20px;
`;

const SearchSection = styled.div`
    background-color: var(--center-channel-bg);
    z-index: 2;
    position: sticky;
    top: 0;
    display: flex;
    flex-direction: column;
    padding: 16px 20px 0 20px;
`;

const ListSection = styled.div`
    display: flex;
    flex-direction: column;
    margin: 8px 4px;
    padding-bottom: 50px;
`;

const HoverButtonContainer = styled.div`
    position: absolute;
    right: 20px;
`;

const ProfileWrapper = styled.div<{manageMode: boolean}>`
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 5px 24px;
    :hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        border-radius: 5px;
    }

    ${HoverButtonContainer} {
        opacity: 0;
    }
    :hover,
    :focus-within {
        background: rgba(var(--center-channel-color-rgb), 0.04);
        ${HoverButtonContainer} {
            opacity: 1;
        }
    }
`;

const HeaderSection = styled.div`
    display: flex;
    flex-direction: row;
    padding: 20px 20px 0 20px;
    color: var(--center-channel-color);
    align-items: center;
`;

const StyledSecondaryButton = styled(TertiaryButton)`
    display: flex;
    align-items: center;
    height: 32px;
    font-size: 12px;
    line-height: 10px;
    margin-right: 8px;
`;

const StyledPrimaryButton = styled(PrimaryButton)`
    display: flex;
    align-items: center;
    height: 32px;
    font-size: 12px;
    line-height: 10px;
`;

const AddParticipantIcon = styled(AccountPlusOutlineIcon)`
    height: 14.4px;
    width: 14.4px;
    margin-right: 3px;
`;

const ParticipantButton = styled.div`
    display: inline-flex;
    border-radius: 4px;
    fill: var(--link-color);
    height: 25px;
    align-items: center;
    color: var(--link-color);
    &:hover {
       background: rgba(var(--button-bg-rgb), 0.08);
       color: rgba(var(--center-channel-color-rgb), 0.72);
    }

    position: absolute;
    right: 20px;
`;

const IconWrapper = styled.div`
    display: inline-flex;
    padding: 10px 5px 10px 8px;
`;
