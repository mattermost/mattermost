// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import './accordion.scss';

type Props = {
    title: string;
    description: string;
    severity: 'info' | 'warning' | 'error';
}

const MessageItem = ({title, description}: Props): JSX.Element | null => {
    return (
        <div className='message-item'>
            <h2 className='message-item-title'>
                <button className='message-item-btn'>{title}</button>
            </h2>
            <div className='message-item-container'>
                <div className='message-item-description'>{description}</div>
            </div>
        </div>
    );
};

export default MessageItem;
