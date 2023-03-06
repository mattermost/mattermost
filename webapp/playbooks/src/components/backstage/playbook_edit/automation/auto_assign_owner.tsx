// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {ActionFunc} from 'mattermost-redux/types/actions';

import {FormattedMessage} from 'react-intl';

import {AutomationHeader, AutomationTitle, SelectorWrapper} from 'src/components/backstage/playbook_edit/automation/styles';
import AssignOwnerSelector from 'src/components/backstage/playbook_edit/automation/assign_owner_selector';
import {Toggle} from 'src/components/backstage/playbook_edit/automation/toggle';

interface Props {
    enabled: boolean;
    disabled?: boolean;
    onToggle: () => void;
    searchProfiles: (term: string) => ActionFunc;
    getProfiles: () => ActionFunc;
    ownerID: string;
    onAssignOwner: (userId: string | undefined) => void;
}

export const AutoAssignOwner = (props: Props) => {
    return (
        <AutomationHeader>
            <AutomationTitle>
                <Toggle
                    isChecked={props.enabled}
                    onChange={props.onToggle}
                    disabled={props.disabled}
                >
                    <FormattedMessage defaultMessage='Assign the owner role'/>
                </Toggle>
            </AutomationTitle>
            <SelectorWrapper>
                <AssignOwnerSelector
                    ownerID={props.ownerID}
                    onAddUser={props.onAssignOwner}
                    searchProfiles={props.searchProfiles}
                    getProfiles={props.getProfiles}
                    isDisabled={props.disabled || !props.enabled}
                />
            </SelectorWrapper>
        </AutomationHeader>
    );
};
