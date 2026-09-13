// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import styled, {css} from 'styled-components';
import {FormattedMessage, useIntl} from 'react-intl';
import {ControlProps, components} from 'react-select';
import {UserProfile} from '@mattermost/types/users';
import {OverlayTrigger, Tooltip} from 'react-bootstrap';

import {Placement} from '@floating-ui/react';

import {OVERLAY_DELAY} from 'src/constants';

import ProfileSelector, {Option} from 'src/components/profile/profile_selector';
import {useProfilesInTeam} from 'src/hooks';
import {ChecklistHoverMenuButton} from 'src/components/rhs/rhs_shared';

interface AssignedToProps {
    assignee_id: string;
    participantUserIds: string[];
    editable: boolean;
    inHoverMenu?: boolean;
    placement?: Placement;
    onSelectedChange?: (user?: UserProfile) => void;
    onOpenChange?: (isOpen: boolean) => void;
    isEditing?: boolean;
}

const AssignTo = (props: AssignedToProps) => {
    const {formatMessage} = useIntl();
    const profilesInTeam = useProfilesInTeam();
    const [profileSelectorToggle, setProfileSelectorToggle] = useState(false);

    const resetAssignee = () => {
        props.onSelectedChange?.();
        setProfileSelectorToggle(!profileSelectorToggle);
    };

    if (props.inHoverMenu) {
        return (
            <ProfileSelector
                selectedUserId={props.assignee_id}
                onlyPlaceholder={true}
                placeholder={
                    <ChecklistHoverMenuButton
                        title={formatMessage({defaultMessage: 'Assign'})}
                        className={'icon-account-plus-outline icon-12 btn-icon'}
                    />
                }
                enableEdit={true}
                userGroups={{
                    subsetUserIds: props.participantUserIds,
                    defaultLabel: formatMessage({defaultMessage: 'NOT PARTICIPATING'}),
                    subsetLabel: formatMessage({defaultMessage: 'PARTICIPANTS'}),
                }}
                getAllUsers={async () => {
                    return profilesInTeam;
                }}
                onSelectedChange={props.onSelectedChange}
                selfIsFirstOption={true}
                customControl={ControlComponent}
                customControlProps={{
                    showCustomReset: Boolean(props.assignee_id),
                    onCustomReset: resetAssignee,
                }}
                controlledOpenToggle={profileSelectorToggle}
                placement={props.placement}
                onOpenChange={props.onOpenChange}
            />
        );
    }

    const dropdownArrow = (
        <DropdownArrow className={'icon-chevron-down icon--small ml-1'}/>
    );

    let assignToButton = (
        <AssignToContainer>
            <StyledProfileSelector
                testId={'assignee-profile-selector'}
                selectedUserId={props.assignee_id}
                userGroups={{
                    subsetUserIds: props.participantUserIds,
                    defaultLabel: formatMessage({defaultMessage: 'NOT PARTICIPATING'}),
                    subsetLabel: formatMessage({defaultMessage: 'PARTICIPANTS'}),
                }}
                placeholder={
                    <PlaceholderDiv>
                        <AssignToIcon
                            className={'icon-account-plus-outline icon-12'}
                        />
                        {!props.isEditing && (
                            <AssignToTextContainer
                                isPlaceholder={!props.assignee_id}
                                enableEdit={props.editable}
                            >
                                {formatMessage({defaultMessage: 'Assignee...'})}
                            </AssignToTextContainer>
                        )}
                    </PlaceholderDiv>
                }
                placeholderButtonClass={'NoAssignee-button'}
                profileButtonClass={'Assigned-button'}
                enableEdit={props.editable}
                getAllUsers={async () => {
                    return profilesInTeam;
                }}
                onSelectedChange={props.onSelectedChange}
                selfIsFirstOption={true}
                customControl={ControlComponent}
                customControlProps={{
                    showCustomReset: Boolean(props.assignee_id),
                    onCustomReset: resetAssignee,
                }}
                customDropdownArrow={dropdownArrow}
                placement={props.placement}
                onOpenChange={props.onOpenChange}
            />
        </AssignToContainer>
    );

    if (props.isEditing && !props.assignee_id) {
        assignToButton = (
            <OverlayTrigger
                placement='top'
                delay={OVERLAY_DELAY}
                overlay={(
                    <Tooltip id='assignee-tooltip'>
                        {formatMessage({defaultMessage: 'Assignee'})}
                    </Tooltip>
                )}
            >
                {assignToButton}
            </OverlayTrigger>
        );
    }

    return assignToButton;
};

export default AssignTo;

const ControlComponent = (ownProps: ControlProps<Option, boolean>) => (
    <div>
        <components.Control {...ownProps}/>
        {ownProps.selectProps.showCustomReset && (
            <ControlComponentAnchor onClick={ownProps.selectProps.onCustomReset}>
                <FormattedMessage defaultMessage='No Assignee'/>
            </ControlComponentAnchor>
        )}
    </div>
);

const StyledProfileSelector = styled(ProfileSelector)`
    .Assigned-button, .NoAssignee-button, .NoName-Assigned-button {
        display: flex;
        align-items: center;
        max-width: 100%;
        height: 24px;
        padding: 2px 6px 2px 2px;
        margin-top: 0;
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: var(--center-channel-color);
        border-radius: 100px;
        border: none;
        font-weight: 400;
        font-size: 12px;
        line-height: 10px;

        ${({enableEdit}) => enableEdit && css`
            &:hover {
                background: rgba(var(--center-channel-color-rgb), 0.16);
            }
        `}

        .image {
            width: 20px;
            height: 20px;
        }

        .icon-chevron-down{
            display: flex;
            align-items: center;
            font-size: 14.4px;
            font-weight: 400;
            line-height: 14px;
            text-align: center;
        }
    }

    .NoName-Assigned-button {
        padding: 0 6px 0 0;

        .image {
            margin: 2px;
            background: rgba(var(--center-channel-color-rgb), 0.08);
        }
    }

    .NoAssignee-button {
        background-color: transparent;
        border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
        color: rgba(var(--center-channel-color-rgb), 0.64);
        padding: 2px;

        ${({enableEdit}) => enableEdit && css`
            &:hover {
                color: var(--center-channel-color);
            }
        `}
    }
`;

const PlaceholderDiv = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
`;

const AssignToTextContainer = styled.div<{isPlaceholder: boolean, enableEdit: boolean}>`
    color: ${({isPlaceholder}) => (isPlaceholder ? 'rgba(var(--center-channel-color-rgb), 0.64)' : 'var(--center-channel-color)')};
     ${({enableEdit}) => enableEdit && css`
        &:hover {
            color: var(--center-channel-color);
        }
    `}
    font-weight: 400;
    font-size: 12px;
    line-height: 15px;
    margin-left: 5px;
`;

const AssignToIcon = styled.i`
    display: flex;
    width: 20px;
    height: 20px;
    align-items: center;
    color: rgba(var(--center-channel-color-rgb),0.56);
    text-align: center;
`;

export const AssignToContainer = styled.div`
    display: flex;
`;

const ControlComponentAnchor = styled.a`
    position: relative;
    top: -4px;
    display: inline-block;
    margin: 0 0 8px 12px;
    font-size: 12px;
    font-weight: 600;
`;

export const DropdownArrow = styled.i`
    color: var(--center-channel-color-32);
`;
