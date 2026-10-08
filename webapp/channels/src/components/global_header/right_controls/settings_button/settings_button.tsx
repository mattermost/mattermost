// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {type JSX} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {IconButton} from '@mattermost/compass-ui/components/icon-button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import UserSettingsModal from 'components/user_settings/modal';

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
            forcedPlacement='bottom'
        >
            <IconButton
                style='inverted'
                size='small'
                padding='compact'
                icon={
                    <i
                        className='icon icon-settings-outline'
                        aria-hidden='true'
                    />
                }
                onClick={(): void => {
                    props.actions.openModal({modalId: ModalIdentifiers.USER_SETTINGS, dialogType: UserSettingsModal, dialogProps: {isContentProductSettings: true, focusOriginElement: 'settings_button'}});
                }}
                aria-haspopup='dialog'
                aria-label={formatMessage({id: 'global_header.productSettings', defaultMessage: 'Settings'})}
            />
        </WithTooltip>
    );
};

export default SettingsButton;
