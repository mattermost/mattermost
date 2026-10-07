// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {IconButton} from '@mattermost/compass-ui/components/icon-button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import './modal_header.scss';

type Props = {
    id: string;
    title: string;
    subtitle: string;
    handleClose?: (e: React.MouseEvent) => void;
};

function ModalHeader({id, title, subtitle, handleClose}: Props) {
    const intl = useIntl();
    return (
        <div className='mm-modal-header'>
            <h2
                id={`mm-modal-header-${id}`}
                className='mm-modal-header__title'
            >
                <span>{title}</span>
                <span className='mm-modal-header__vertical-divider'/>
                <span className='mm-modal-header__subtitle'>{subtitle}</span>
                {handleClose && <div className='mm-modal-header__ctr'>
                    <WithTooltip title={intl.formatMessage({id: 'modal.header_close', defaultMessage: 'Close'})}>
                        <IconButton
                            icon={<i className='icon icon-close' aria-hidden='true'/>}
                            size='medium'
                            onClick={handleClose}
                            aria-label={intl.formatMessage({id: 'modal.header_close', defaultMessage: 'Close'})}
                        />
                    </WithTooltip>
                </div>}
            </h2>
        </div>
    );
}
export default ModalHeader;
