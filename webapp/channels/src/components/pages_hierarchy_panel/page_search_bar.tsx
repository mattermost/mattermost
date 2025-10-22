// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

type Props = {
    value: string;
    placeholder?: string;
    onChange: (value: string) => void;
};

const PageSearchBar = ({value, placeholder = 'Find pages...', onChange}: Props) => {
    return (
        <div className='PagesHierarchyPanel__search'>
            <i className='icon-magnify'/>
            <input
                type='text'
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
            {value && (
                <button
                    className='PagesHierarchyPanel__clearSearch'
                    onClick={() => onChange('')}
                    aria-label='Clear search'
                >
                    <i className='icon-close'/>
                </button>
            )}
        </div>
    );
};

export default PageSearchBar;
