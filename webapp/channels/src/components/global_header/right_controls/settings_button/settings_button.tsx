// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import IconButton from '@mattermost/compass-components/components/icon-button'; // eslint-disable-line no-restricted-imports

import UserSettingsModal from 'components/user_settings/modal';
import WithTooltip from 'components/with_tooltip';

import {ModalIdentifiers} from 'utils/constants';

import type {ModalData} from 'types/actions';

type Props = {
    actions: {
        openModal: <P>(modalData: ModalData<P>) => void;
    };
};

const SettingsButton = (props: Props): JSX.Element | null => {
    const {formatMessage} = useIntl();

    return (
        <WithTooltip
            title={
                <FormattedMessage
                    id='global_header.productSettings'
                    defaultMessage='Settings'
                />
            }
        >
            <IconButton
                size={'sm'}
                icon={'settings-outline'}
                onClick={(): void => {
                    props.actions.openModal({modalId: ModalIdentifiers.USER_SETTINGS, dialogType: UserSettingsModal, dialogProps: {isContentProductSettings: true}});
                }}
                inverted={true}
                compact={true}
                aria-haspopup='dialog'
                aria-label={formatMessage({id: 'global_header.productSettings', defaultMessage: 'Settings'})}
            />
        </WithTooltip>
    );
};

export default SettingsButton;
