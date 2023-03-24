import React, {useState} from 'react';
import styled, {css} from 'styled-components';
import {FormattedMessage, useIntl} from 'react-intl';
import {ControlProps, components} from 'react-select';
import {UserProfile} from '@mattermost/types/users';

import {Placement} from '@floating-ui/react-dom-interactions';

import ProfileSelector, {Option} from 'src/components/profile/profile_selector';
import {useProfilesInTeam} from 'src/hooks';
import {ChecklistHoverMenuButton} from 'src/components/rhs/rhs_shared';

interface AssignedToProps {
    assignee_id: string;
    participantUserIds: string[];
    editable: boolean;
    withoutName?: boolean;
    inHoverMenu?: boolean;
    placement?: Placement;
    onSelectedChange?: (user?: UserProfile) => void;
    onOpenChange?: (isOpen: boolean) => void;
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
                    subsetLabel: formatMessage({defaultMessage: 'RUN PARTICIPANTS'}),
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

    return (
        <AssignToContainer>
            <StyledProfileSelector
                testId={'assignee-profile-selector'}
                selectedUserId={props.assignee_id}
                userGroups={{
                    subsetUserIds: props.participantUserIds,
                    defaultLabel: formatMessage({defaultMessage: 'NOT PARTICIPATING'}),
                    subsetLabel: formatMessage({defaultMessage: 'RUN PARTICIPANTS'}),
                }}
                placeholder={
                    <PlaceholderDiv>
                        <AssignToIcon
                            title={formatMessage({defaultMessage: 'Assignee...'})}
                            className={'icon-account-plus-outline icon-12'}
                        />
                        <AssignToTextContainer
                            isPlaceholder={!props.assignee_id}
                            enableEdit={props.editable}
                        >
                            {formatMessage({defaultMessage: 'Assignee...'})}
                        </AssignToTextContainer>
                    </PlaceholderDiv>
                }
                placeholderButtonClass={'NoAssignee-button'}
                profileButtonClass={props.withoutName ? 'NoName-Assigned-button' : 'Assigned-button'}
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
                selectWithoutName={props.withoutName}
                customDropdownArrow={dropdownArrow}
                placement={props.placement}
                onOpenChange={props.onOpenChange}
            />
        </AssignToContainer>
    );
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
            :hover {
                background: rgba(var(--center-channel-color-rgb), 0.16);
            }
        `}

        .image {
            width: 20px;
            height: 20px;
        }

        .icon-chevron-down{
            font-weight: 400;
            font-size: 14.4px;
            line-height: 14px;
            display: flex;
            align-items: center;
            text-align: center;
        }
    }

    .NoName-Assigned-button {
        padding: 0 6px 0 0;

        .image {
            background: rgba(var(--center-channel-color-rgb),0.08);
            margin: 2px;
        }
    }

    .NoAssignee-button {
        background-color: transparent;
        border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
        color: rgba(var(--center-channel-color-rgb), 0.64);

        ${({enableEdit}) => enableEdit && css`
            :hover {
                color: var(--center-channel-color);
            }
        `}
    }
`;

const PlaceholderDiv = styled.div`
    display: flex;
    align-items: center;
    flex-direction: row;
`;

const AssignToTextContainer = styled.div<{isPlaceholder: boolean, enableEdit: boolean}>`
    color: ${({isPlaceholder}) => (isPlaceholder ? 'rgba(var(--center-channel-color-rgb), 0.64)' : 'var(--center-channel-color)')};

     ${({enableEdit}) => enableEdit && css`
        :hover {
            color: var(--center-channel-color);
        }
    `}
    font-weight: 400;
    font-size: 12px;
    line-height: 15px;
`;

const AssignToIcon = styled.i`
    width: 20px;
    height: 20px;
    margin-right: 5px;
    display: flex;
    align-items: center;
    text-align: center;
    flex: table;
    color: rgba(var(--center-channel-color-rgb),0.56);
`;

export const AssignToContainer = styled.div`
    :not(:first-child) {
        margin-left: 36px;
    }
    max-width: calc(100% - 210px);
    display: flex;
`;

const ControlComponentAnchor = styled.a`
    display: inline-block;
    margin: 0 0 8px 12px;
    font-weight: 600;
    font-size: 12px;
    position: relative;
    top: -4px;
`;

export const DropdownArrow = styled.i`
    color: var(--center-channel-color-32);
`;
