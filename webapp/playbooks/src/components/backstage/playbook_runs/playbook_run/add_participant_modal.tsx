// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useIntl} from 'react-intl';
import {Modal} from 'react-bootstrap';
import styled from 'styled-components';
import {useDispatch, useSelector} from 'react-redux';
import {searchProfiles} from 'mattermost-webapp/packages/mattermost-redux/src/actions/users';
import {UserProfile} from 'mattermost-webapp/packages/types/src/users';
import {LightningBoltOutlineIcon} from '@mattermost/compass-icons/components';
import {OptionTypeBase, StylesConfig} from 'react-select';
import {General} from 'mattermost-webapp/packages/mattermost-redux/src/constants';

import GenericModal from 'src/components/widgets/generic_modal';
import {PlaybookRun} from 'src/types/playbook_run';
import {useManageRunMembership} from 'src/graphql/hooks';

import CheckboxInput from 'src/components/backstage/runs_list/checkbox_input';

import {isCurrentUserChannelMember} from 'src/selectors';

import ProfileAutocomplete from 'src/components/backstage/profile_autocomplete';

import {useChannel} from 'src/hooks';
import {telemetryEvent} from 'src/client';
import {PlaybookRunEventTarget} from 'src/types/telemetry';

interface Props {
    playbookRun: PlaybookRun;
    id: string;
    title: React.ReactNode;
    show: boolean;
    hideModal: () => void;
}

const AddParticipantsModal = ({playbookRun, id, title, show, hideModal}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const [profiles, setProfiles] = useState<UserProfile[]>([]);
    const {addToRun} = useManageRunMembership(playbookRun.id);
    const [forceAddToChannel, setForceAddToChannel] = useState(false);
    const [channel, meta] = useChannel(playbookRun.channel_id);
    const isChannelMember = useSelector(isCurrentUserChannelMember(playbookRun.channel_id));
    const isPrivateChannelWithAccess = meta.error === null && channel?.type === General.PRIVATE_CHANNEL;

    const searchUsers = (term: string) => {
        return dispatch(searchProfiles(term, {team_id: playbookRun.team_id}));
    };

    const header = (
        <Header>
            {title}
        </Header>
    );

    const renderFooter = () => {
        if (playbookRun.create_channel_member_on_new_participant) {
            return (
                <FooterExtraInfoContainer>
                    <LightningBoltOutlineIcon
                        size={18}
                        color={'rgba(var(--center-channel-color-rgb), 0.56)'}
                    />
                    <FooterText>
                        {formatMessage({defaultMessage: 'Participants will also be added to the channel linked to this run'})}
                    </FooterText>
                </FooterExtraInfoContainer>
            );
        }
        if (isChannelMember || isPrivateChannelWithAccess) {
            return (
                <StyledCheckboxInput
                    testId={'also-add-to-channel'}
                    text={formatMessage({defaultMessage: 'Also add people to the channel linked to this run'})}
                    checked={forceAddToChannel}
                    onChange={(checked) => setForceAddToChannel(checked)}
                />
            );
        }
        return null;
    };

    const onConfirm = () => {
        const ids = profiles.map((e) => e.id);
        addToRun(ids, forceAddToChannel);
        telemetryEvent(PlaybookRunEventTarget.Participate, {playbookrun_id: playbookRun.id, from: 'run_details', trigger: 'add_participant', count: ids.length.toString()});
        hideModal();
    };

    return (
        <GenericModal
            id={id}
            modalHeaderText={header}
            show={show}
            onHide={hideModal}

            confirmButtonText={formatMessage({defaultMessage: 'Add'})}
            handleConfirm={onConfirm}
            isConfirmDisabled={!profiles || profiles.length === 0}

            onExited={() => {
                setProfiles([]);
                setForceAddToChannel(false);
            }}

            isConfirmDestructive={false}
            autoCloseOnCancelButton={true}
            autoCloseOnConfirmButton={false}
            enforceFocus={true}
            footer={renderFooter()}
            components={{
                Header: ModalHeader,
                FooterContainer: StyledFooterContainer,
            }}
        >
            <ProfileAutocomplete
                searchProfiles={searchUsers}
                userIds={[]}
                isDisabled={false}
                isMultiMode={true}
                customSelectStyles={selectStyles}
                setValues={setProfiles}
                placeholder={formatMessage({defaultMessage: 'Search for people'})}
            />
        </GenericModal>
    );
};

const ModalHeader = styled(Modal.Header)`
    &&&& {
        margin-bottom: 16px;
    }
`;

const Header = styled.div`
    display: flex;
    flex-direction: row;
`;

const StyledFooterContainer = styled.div`
    display: flex;
    flex-direction: row-reverse;
    align-items: center;
`;

const FooterExtraInfoContainer = styled.div`
    display: flex;
    flex-direction: row;

    text-align: left;
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
    align-items: center;
    margin-right: auto;
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;

const FooterText = styled.span`
    margin-left: 10px;
`;

const StyledCheckboxInput = styled(CheckboxInput)`
    padding: 10px 16px 10px 0;
    margin-right: auto;
    white-space: normal;
    font-weight: normal;

    &:hover {
        background-color: transparent;
    }
`;

const selectStyles: StylesConfig<OptionTypeBase, boolean> = {
    control: (provided, {isDisabled}) => ({
        ...provided,
        backgroundColor: isDisabled ? 'rgba(var(--center-channel-bg-rgb),0.16)' : 'var(--center-channel-bg)',
        border: '1px solid rgba(var(--center-channel-color-rgb), 0.16)',
        minHeight: '48px',
        fontSize: '16px',
        '&&:before': {content: 'none'},
    }),
    placeholder: (provided) => ({
        ...provided,
        marginLeft: '8px',
    }),
    input: (provided) => ({
        ...provided,
        marginLeft: '8px',
        color: 'var(--center-channel-color)',
    }),
    multiValue: (provided) => ({
        ...provided,
        backgroundColor: 'rgba(var(--center-channel-color-rgb), 0.08)',
        borderRadius: '16px',
        paddingLeft: '8px',
        overflow: 'hidden',
        height: '32px',
        alignItems: 'center',
    }),
    multiValueLabel: (provided) => ({
        ...provided,
        padding: 0,
        paddingLeft: 0,
        lineHeight: '18px',
        color: 'var(--center-channel-color)',
    }),
    multiValueRemove: (provided) => ({
        ...provided,
        color: 'rgba(var(--center-channel-bg-rgb), 0.80)',
        backgroundColor: 'rgba(var(--center-channel-color-rgb),0.32)',
        borderRadius: '50%',
        margin: '4px',
        padding: 0,
        cursor: 'pointer',
        width: '16px',
        height: '16px',
        ':hover': {
            backgroundColor: 'rgba(var(--center-channel-color-rgb),0.56)',
        },
        ':active': {
            backgroundColor: 'rgba(var(--center-channel-color-rgb),0.56)',
        },
        '> svg': {
            height: '16px',
            width: '16px',
        },
    }),
};

export default AddParticipantsModal;
