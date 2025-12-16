// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

type Props = {
    title: string;
    onNewPage: () => void;
    onCollapse: () => void;
    isCreating?: boolean;
};

const PagesHeader = ({title, onNewPage, onCollapse, isCreating}: Props) => {
    const {formatMessage} = useIntl();

    return (
        <div
            className='PagesHierarchyPanel__header'
            data-testid='pages-hierarchy-header'
        >
            <div className='PagesHierarchyPanel__title-container'>
                <button
                    className='PagesHierarchyPanel__collapseButton btn btn-icon btn-sm'
                    onClick={onCollapse}
                    aria-label={formatMessage({id: 'pages_panel.collapse', defaultMessage: 'Collapse pages panel'})}
                    data-testid='pages-panel-collapse-button'
                >
                    <i className='icon icon-menu-variant'/>
                </button>
                <span
                    className='PagesHierarchyPanel__title'
                    data-testid='pages-panel-title'
                >
                    {title}
                </span>
            </div>
            <button
                className='PagesHierarchyPanel__newPage btn btn-icon btn-sm'
                onClick={onNewPage}
                aria-label={formatMessage({id: 'pages_panel.create_new_page', defaultMessage: 'Create new page'})}
                disabled={isCreating}
                data-testid='new-page-button'
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
