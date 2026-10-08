// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import type {HealthFinding} from '@mattermost/types/health';

type Props = {
    finding: HealthFinding;
    onConfirm: (fingerprint: string) => void;
    onExited: () => void;
};

const noop = () => {};

const MuteConfirmModal = ({finding, onConfirm, onExited}: Props) => {
    const {formatMessage} = useIntl();
    const title = <strong>{finding.title || finding.code}</strong>;
    const node = <strong>{finding.scope}</strong>;

    return (
        <GenericModal
            compassDesign={true}
            dataTestId='healthMuteConfirmModal'
            modalHeaderText={formatMessage({id: 'admin.health_dashboard.mute.confirm.title', defaultMessage: 'Mute this finding permanently?'})}
            confirmButtonText={formatMessage({id: 'admin.health_dashboard.mute.confirm.button', defaultMessage: 'Mute permanently'})}
            handleConfirm={() => onConfirm(finding.fingerprint)}
            handleCancel={noop}
            onExited={onExited}
        >
            <p>
                {finding.scope ? (
                    <FormattedMessage
                        id='admin.health_dashboard.mute.confirm.body_on_node'
                        defaultMessage='{title} on {node} will be muted permanently and hidden from the open list for every admin. It stays muted until someone unmutes it from Muted findings.'
                        values={{title, node}}
                    />
                ) : (
                    <FormattedMessage
                        id='admin.health_dashboard.mute.confirm.body'
                        defaultMessage='{title} will be muted permanently and hidden from the open list for every admin. It stays muted until someone unmutes it from Muted findings.'
                        values={{title}}
                    />
                )}
            </p>
            <p>
                {finding.scope ? (
                    <FormattedMessage
                        id='admin.health_dashboard.mute.confirm.scope_on_node'
                        defaultMessage='Only {node} is muted. The same check on other nodes is still reported, and so is a different problem with this setting.'
                        values={{node}}
                    />
                ) : (
                    <FormattedMessage
                        id='admin.health_dashboard.mute.confirm.scope'
                        defaultMessage='Only this exact finding is muted. A different problem with the same setting is still reported.'
                    />
                )}
            </p>
        </GenericModal>
    );
};

export default MuteConfirmModal;
