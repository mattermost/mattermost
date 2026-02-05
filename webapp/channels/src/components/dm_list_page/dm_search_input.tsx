// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import './dm_search_input.scss';

type Props = {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
};

const DmSearchInput = ({value, onChange, placeholder}: Props) => {
    const intl = useIntl();

    const handleClear = () => {
        onChange('');
    };

    return (
        <div className='dm-search-input-container'>
            <div className='dm-search-input'>
                <i className='icon icon-magnify dm-search-input__icon'/>
                <input
                    className='dm-search-input__field'
                    type='text'
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder || intl.formatMessage({id: 'guilded_layout.dm_list.search', defaultMessage: 'Search Direct Messages'})}
                />
                {value && (
                    <button
                        className='dm-search-input__clear'
                        onClick={handleClear}
                        aria-label='Clear search'
                    >
                        <i className='icon icon-close'/>
                    </button>
                )}
            </div>
        </div>
    );
};

export default DmSearchInput;
