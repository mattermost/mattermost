// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import type {AccessControlPolicy} from '@mattermost/types/access_control';

import type {ActionResult} from 'mattermost-redux/types/actions';

import './policy_selection_modal.scss';
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
        <Modal
            dialogClassName='policy-selection-modal'
            show={show}
            onHide={onHide}
            backdrop='static'
        >
            <Modal.Header closeButton={true}>
                <Modal.Title>
                    <FormattedMessage
                        id='admin.channel_settings.channel_detail.select_policy_title'
                        defaultMessage='Select an Access Control Policy'
                    />
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div className='policy-selection-info'>
                    <FormattedMessage
                        id='admin.channel_settings.channel_detail.select_policy_description'
                        defaultMessage='An access control policy will restrict channel membership based on user attributes.'
                    />
                </div>
                <PolicyList
                    simpleMode={true}
                    onPolicySelected={onPolicySelected}
                    actions={{
                        searchPolicies: actions.searchPolicies,
                        deletePolicy: () => Promise.resolve({data: {}}),
                    }}
                />
            </Modal.Body>
            <Modal.Footer>
                <button
                    type='button'
                    className='btn btn-tertiary'
                    onClick={onHide}
                >
                    <FormattedMessage
                        id='generic_btn.cancel'
                        defaultMessage='Cancel'
                    />
                </button>
            </Modal.Footer>
        </Modal>
    );
}
