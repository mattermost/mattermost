// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import type {AccessControlPolicy} from '@mattermost/types/access_control';

import type {ActionResult} from 'mattermost-redux/types/actions';

import PolicyList from 'components/admin_console/access_control/policies';

type Props = {
    show: boolean;
    onHide: () => void;
    onPolicySelected: (policy: AccessControlPolicy) => void;
    actions: {
        searchPolicies: (term: string, type: string, after: string, limit: number) => Promise<ActionResult>;
    };
};

export default function PolicySelectionModal(props: Props): JSX.Element {
    const {show, onHide, onPolicySelected, actions} = props;

    return (
        <GenericModal
            id='PolicySelectionModal'
            compassDesign={true}
            show={show}
            onHide={onHide}
            backdrop='static'
            modalHeaderText={(
                <FormattedMessage
                    id='admin.channel_settings.channel_detail.select_policy_title'
                    defaultMessage='Select an Access Control Policy'
                />
            )}
            modalSubheaderText={(
                <FormattedMessage
                    id='admin.channel_settings.channel_detail.select_policy_description'
                    defaultMessage='An access control policy will restrict channel membership based on user attributes.'
                />
            )}
        >
            <PolicyList
                simpleMode={true}
                onPolicySelected={onPolicySelected}
                actions={{
                    searchPolicies: actions.searchPolicies,
                    deletePolicy: () => Promise.resolve({data: {}}),
                }}
            />
        </GenericModal>
    );
}
