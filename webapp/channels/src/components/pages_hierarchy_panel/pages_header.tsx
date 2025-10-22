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
            <button
                className='PagesHierarchyPanel__collapseButton'
                onClick={onCollapse}
                aria-label='Collapse pages panel'
            >
                <i className='icon-chevron-left'/>
            </button>
            <h2 className='PagesHierarchyPanel__title'>{title}</h2>
            <button
                className='PagesHierarchyPanel__newPage'
                onClick={onNewPage}
                aria-label='Create new page'
                disabled={isCreating}
            >
                {isCreating ? (
                    <i className='icon-loading icon-spin'/>
                ) : (
                    <i className='icon-plus'/>
                )}
            </button>
        </div>
    );
};

export default PagesHeader;
