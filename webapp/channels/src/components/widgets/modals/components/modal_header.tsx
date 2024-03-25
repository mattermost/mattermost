// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import './modal_header.scss';

type Props = {
    id: string;
    title: string;
    subtitle: string;
    handleClose?: (e: React.MouseEvent) => void;
}

function ModalHeader({id, title, subtitle, handleClose}: Props) {
    return (
        <header className='mm-modal-header'>
            <h1
                id={`mm-modal-header-${id}`}
                className='mm-modal-header__title'
                tabIndex={0}
            >
                {title}
            </h1>
            <div className='mm-modal-header__vertical-divider'/>
            <p className='mm-modal-header__subtitle'>{subtitle}</p>
            <div
                className='mm-modal-header__ctr'
                onClick={handleClose}
            >
                <button className='btn btn-icon'>
                    <i className='icon icon-close'/>
                </button>
            </div>
        </header>
    );
}
export default ModalHeader;
