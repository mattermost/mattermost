// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

type Props = {
    title: string;
    onNewPage: () => void;
    onCollapse: () => void;
    isCreating?: boolean;
};

const PagesHeader = ({title, onNewPage, onCollapse, isCreating}: Props) => {
    return (
        <div className='PagesHierarchyPanel__header'>
            <div class="PagesHierarchyPanel__title-container">
                <button
                    className='PagesHierarchyPanel__collapseButton btn btn-icon btn-sm'
                    onClick={onCollapse}
                    aria-label='Collapse pages panel'
                >
                    <i className='icon icon-menu-variant'/>
                </button>
                <span className='PagesHierarchyPanel__title'>{title}</span>
            </div>
            <button
                className='PagesHierarchyPanel__newPage btn btn-icon btn-sm'
                onClick={onNewPage}
                aria-label='Create new page'
                disabled={isCreating}
            >
                {isCreating ? (
                    <i className='icon icon-loading icon-spin'/>
                ) : (
                    <i className='icon icon-plus'/>
                )}
            </button>
        </div>
    );
};

export default PagesHeader;
