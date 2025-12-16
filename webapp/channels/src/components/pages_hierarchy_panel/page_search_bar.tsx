// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

type Props = {
    value: string;
    placeholder?: string;
    onChange: (value: string) => void;
};

const PageSearchBar = ({value, placeholder, onChange}: Props) => {
    const {formatMessage} = useIntl();
    const defaultPlaceholder = formatMessage({id: 'pages_panel.search_placeholder', defaultMessage: 'Find pages...'});

    return (
        <div
            className='PagesHierarchyPanel__search'
            data-testid='pages-search-bar'
        >
            <i className='icon-magnify'/>
            <input
                type='text'
                placeholder={placeholder || defaultPlaceholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                data-testid='pages-search-input'
            />
            {value && (
                <button
                    className='PagesHierarchyPanel__clearSearch'
                    onClick={() => onChange('')}
                    aria-label={formatMessage({id: 'pages_panel.clear_search', defaultMessage: 'Clear search'})}
                    data-testid='pages-search-clear'
                >
                    <i className='icon icon-close-circle'/>
                </button>
            )}
        </div>
    );
};

export default PageSearchBar;
