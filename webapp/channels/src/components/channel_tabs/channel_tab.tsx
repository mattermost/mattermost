// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {TabType} from './channel_tabs';

import './channel_tab.scss';

interface Props {
    id: TabType;
    label: string;
    icon?: string;
    isActive: boolean;
    onClick: (tabId: TabType) => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    tabRef: (ref: HTMLButtonElement | null) => void;
}

function Tab({
    id,
    label,
    icon,
    isActive,
    onClick,
    onKeyDown,
    tabRef,
}: Props) {
    const handleClick = () => {
        onClick(id);
    };

    return (
        <button
            type='button'
            role='tab'
            id={`channel-tab-${id}`}
            aria-selected={isActive}
            aria-controls={`channel-tab-panel-${id}`}
            tabIndex={isActive ? 0 : -1}
            className={`channel-tab ${isActive ? 'channel-tab--active' : ''}`}
            onClick={handleClick}
            onKeyDown={onKeyDown}
            ref={tabRef}
        >
            <div className='channel-tab__content'>
                {icon && (
                    <span className='channel-tab__icon'>
                        <i className={icon}/>
                    </span>
                )}
                <span className='channel-tab__text'>{label}</span>
            </div>
        </button>
    );
}

export default Tab;
