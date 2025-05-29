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
            <h2
                id={`mm-modal-header-${id}`}
                className='mm-modal-header__title'
            >
                <span>{title}</span>
                <span className='mm-modal-header__vertical-divider'/>
                <span className='mm-modal-header__subtitle'>{subtitle}</span>
                {handleClose && <div className='mm-modal-header__ctr'>
                    <button
                        className='btn btn-icon'
                        onClick={handleClose}
                        aria-label={intl.formatMessage({id: 'modal.header_close', defaultMessage: 'Close'})}
                    >
                        <i className='icon icon-close'/>
                    </button>
                </div>}
            </h2>
        </header>
    );
}
export default ModalHeader;
