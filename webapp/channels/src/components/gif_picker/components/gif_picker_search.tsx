// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ChangeEvent, memo} from 'react';
import {useIntl} from 'react-intl';

interface Props {
    value: string;
    onChange: (value: string) => void;
}

function GifPickerSearch(props: Props) {
    const {formatMessage} = useIntl();

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        event.preventDefault();

        // remove trailing and leading colons
        const value = event.target?.value?.trim()?.toLowerCase()?.replace(/^:|:$/g, '') ?? '';
        props.onChange(value);
    };

    return (
        <div className='emoji-picker__search-container'>
            <div className='emoji-picker__text-container'>
                <span className='icon-magnify icon emoji-picker__search-icon'/>
                <input
                    id='emojiPickerSearch'
                    className='emoji-picker__search'
                    aria-label={formatMessage({id: 'gif_picker.input.label', defaultMessage: 'Search for GIFs'})}
                    placeholder={formatMessage({id: 'gif_picker.input.placeholder', defaultMessage: 'Search GIPHY'})}
                    type='text'
                    autoFocus={true}
                    autoComplete='off'
                    onChange={handleChange}
                    value={props.value}
                />
            </div>
        </div>
    );
}

export default memo(GifPickerSearch);
