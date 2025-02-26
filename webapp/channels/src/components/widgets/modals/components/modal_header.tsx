// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import './modal_header.scss';

type Props = {
    id: string;
    title: string;
    subtitle: string;
    handleClose?: (e: React.MouseEvent) => void;
}

function ModalHeader({id, title, subtitle, handleClose}: Props) {
    const intl = useIntl();
    return (
        <header className='mm-modal-header'>
            <h1
                id={`mm-modal-header-${id}`}
                className='mm-modal-header__title'
            >
                {title}
            </h1>
            <div className='mm-modal-header__vertical-divider'/>
            <p className='mm-modal-header__subtitle'>{subtitle}</p>
            <div
                className='mm-modal-header__ctr'
                onClick={handleClose}
            >
                <button
                    className='btn btn-icon'
                    aria-label={intl.formatMessage({id: 'modal.header_close', defaultMessage: 'Close'})}
                >
                    <i className='icon icon-close'/>
                </button>
            </div>
        </header>
    );
}
export default ModalHeader;
