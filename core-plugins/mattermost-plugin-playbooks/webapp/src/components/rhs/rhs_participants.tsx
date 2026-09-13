// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {useDispatch, useSelector} from 'react-redux';
import {FormattedMessage, useIntl} from 'react-intl';
import {Link} from 'react-router-dom';
import {AccountMultiplePlusOutlineIcon, AccountPlusOutlineIcon, OpenInNewIcon} from '@mattermost/compass-icons/components';
import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';

import Tooltip from 'src/components/widgets/tooltip';
import {RHSParticipant, Rest} from 'src/components/rhs/rhs_participant';

interface Props {
    userIds: string[];
    onParticipate?: () => void;
    setShowParticipants: React.Dispatch<React.SetStateAction<boolean>>
}

const RHSParticipants = (props: Props) => {
    const {formatMessage} = useIntl();
    const openMembersModal = useOpenMembersModalIfPresent();

    const showParticipants = () => {
        props.setShowParticipants(true);
    };

    const becomeParticipant = (
        <Tooltip
            id={'rhs-participate'}
            content={formatMessage({defaultMessage: 'Become a participant'})}
        >
            <IconWrapper
                onClick={props.onParticipate}
                data-testid={'rhs-participate-icon'}
                $format={props.userIds.length === 0 ? 'icontext' : 'icon'}
            >
                <AccountPlusOutlineIcon size={16}/>
                {props.userIds.length === 0 ? formatMessage({defaultMessage: 'Participate'}) : null}
            </IconWrapper>
        </Tooltip>
    );

    if (props.userIds.length === 0) {
        return (
            <Container>
                <NoParticipants>
                    <FormattedMessage defaultMessage='Nobody yet.'/>
                    {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
                    {' '}
                    {props.onParticipate ? null : (
                        <LinkAddParticipants
                            to={'#'}
                            onClick={showParticipants}
                        >
                            {formatMessage({defaultMessage: 'Add participant'})}
                            <OpenInNewIcon size={11}/>
                        </LinkAddParticipants>
                    )}
                </NoParticipants>
                {props.onParticipate ? becomeParticipant : null}
            </Container>
        );
    }

    const height = 28;

    return (
        <Container>
            <UserRow
                tabIndex={0}
                role={'button'}
                onClick={showParticipants}
                onKeyDown={(e) => {
                    // Handle Enter and Space as clicking on the button
                    if (e.keyCode === 13 || e.keyCode === 32) {
                        openMembersModal();
                    }
                }}
            >
                <UserList
                    userIds={props.userIds}
                    sizeInPx={height}
                />
            </UserRow>
            {props.onParticipate ? becomeParticipant : (
                <Tooltip
                    id={'rhs-add-participant'}
                    content={formatMessage({defaultMessage: 'Add participant'})}
                >
                    <AddParticipantIconButton
                        onClick={showParticipants}
                        data-testid={'rhs-add-participant-icon'}
                        $format={'icon'}
                    >
                        <AccountMultiplePlusOutlineIcon size={20}/>
                    </AddParticipantIconButton>
                </Tooltip>
            )}
        </Container>
    );
};

export const UserList = ({userIds, sizeInPx}: {userIds: string[], sizeInPx: number}) => {
    return (
        <>
            {userIds.slice(0, 6).map((userId: string) => (
                <RHSParticipant
                    key={userId}
                    userId={userId}
                    sizeInPx={sizeInPx}
                />
            ))}
            {userIds.length > 6 &&
            // eslint-disable-next-line formatjs/no-literal-string-in-jsx
            <Rest $sizeInPx={sizeInPx}>{'+' + (userIds.length - 6)}</Rest>
            }
        </>
    );
};

const useOpenMembersModalIfPresent = () => {
    const dispatch = useDispatch();
    const channel = useSelector(getCurrentChannel);

    // @ts-ignore
    if (!window.WebappUtils?.modals?.openModal || !window.WebappUtils?.modals?.ModalIdentifiers?.CHANNEL_MEMBERS || !window.Components?.ChannelMembersModal) {
        return () => {/* do nothing */};
    }

    // @ts-ignore
    const {openModal, ModalIdentifiers} = window.WebappUtils.modals;

    // @ts-ignore
    const ChannelMembersModal = window.Components.ChannelMembersModal;

    return () => {
        dispatch(openModal({
            modalId: ModalIdentifiers.CHANNEL_MEMBERS,
            dialogType: ChannelMembersModal,
            dialogProps: {channel},
        }));
    };
};

const NoParticipants = styled.div`
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-size: 11px;
    line-height: 16px;
    white-space: nowrap;
`;

const Container = styled.div`
    display: flex;
    min-height: 40px;
    flex-direction: row;
    align-items: center;
    margin-top: 2px;
`;

const UserRow = styled.div`
    display: flex;
    width: max-content;
    flex-direction: row;
    border: 6px solid transparent;
    border-radius: 44px;
    margin-right: 2px;
    margin-left: -4px;

    &:hover {
        border-color: rgba(var(--center-channel-color-rgb), 0.08);
        background-clip: padding-box;
        background-color: rgba(var(--center-channel-color-rgb), 0.08);
    }
`;

export default RHSParticipants;

const IconWrapper = styled.div<{$format: 'icon' | 'icontext'}>`
    display: flex;
    width: ${(props) => (props.$format === 'icontext' ? 'auto' : '28px')};
    height: 28px;
    align-items: center;
    justify-content: center;
    padding: 0 ${(props) => (props.$format === 'icontext' ? '8px' : '0')};
    border: 1px dashed rgba(var(--center-channel-color-rgb), 0.56);
    border-radius: ${(props) => (props.$format === 'icontext' ? '15px' : '50%')};
    margin-left: 2px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    cursor: pointer;
    font-size: 12px;

    &:hover {
        border: 1px dashed rgba(var(--center-channel-color-rgb), 0.72);
        background: rgba(var(--center-channel-color-rgb), 0.04);
        color: rgba(var(--center-channel-color-rgb), 0.72);

    }

    svg {
        margin-right: ${(props) => (props.$format === 'icontext' ? '4px' : '0')};
    }
`;

const AddParticipantIconButton = styled(IconWrapper)`
    width: 32px;
    height: 32px;
    border: 0;
    border-radius: 4px;

    &:hover {
        border: 0;
        background: rgba(var(--center-channel-color-rgb), 0.08);
    }
`;

const LinkAddParticipants = styled(Link)`
    display: inline-flex;
    align-items: center;

    svg {
        margin-left: 2px;
    }
`;
