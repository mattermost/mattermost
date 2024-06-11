// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import './modal_sidebar.scss';

export type Tab = {
    icon: JSX.Element;
    name: string;
    uiName: string;
}

export type Props = {
    activeTab?: string;
    tabs: Tab[];
    updateTab: (name: string) => void;
}

function ModalSidebar({tabs, activeTab, updateTab}: Props) {
    const handleClick = (tab: Tab, e: React.MouseEvent) => {
        e.preventDefault();
        updateTab(tab.name);
        (e.target as Element).closest('.settings-modal')?.classList.add('display--content');
    };

    const tabList = tabs.map((tab) => {
        const key = `${tab.name}_li`;
        let className = 'mm-modal-sidebar__item';
        if (activeTab === tab.name) {
            className += ' mm-modal-sidebar__item--active';
        }

        return (
            <li
                id={`${tab.name}Li`}
                key={key}
            >
                <button
                    id={`${tab.name}Button`}
                    className={className}
                    onClick={handleClick.bind(null, tab)}
                    aria-label={tab.uiName.toLowerCase()}
                >
                    {tab.icon}
                    {tab.uiName}
                </button>
            </li>
        );
    });

    return (
        <ul
            id='tabList'
            className='mm-modal-sidebar'
        >
            {tabList}
        </ul>
    );
}
export default ModalSidebar;
