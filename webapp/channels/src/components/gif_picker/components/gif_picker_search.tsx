// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChangeEvent} from 'react';
import React, {memo, useCallback, useMemo} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import tinycolor from 'tinycolor2';

import {getTheme} from 'mattermost-redux/selectors/entities/preferences';

import giphyBlackImage from 'images/gif_picker/powered-by-giphy-black.png';
import giphyWhiteImage from 'images/gif_picker/powered-by-giphy-white.png';

interface Props {
    value: string;
    onChange: (value: string) => void;
}

function GifPickerSearch(props: Props) {
    const theme = useSelector(getTheme);

    const {formatMessage} = useIntl();

    const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        event.preventDefault();

        // remove trailing and leading colons
        const value = event.target?.value?.replace(/^:|:$/g, '') ?? '';
        props.onChange(value);
    }, [props.onChange]);

    const shouldUseWhiteLogo = useMemo(() => {
        const WHITE_COLOR = '#FFFFFF';
        const BLACK_COLOR = '#000000';

        const mostReadableColor = tinycolor.mostReadable(theme.centerChannelBg, [WHITE_COLOR, BLACK_COLOR], {includeFallbackColors: false});

        if (mostReadableColor.isLight()) {
            return true;
        }
        return false;
    }, [theme.centerChannelBg]);

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
            <div className='gif-attribution'>
                <img
                    src={shouldUseWhiteLogo ? giphyWhiteImage : giphyBlackImage}
                    alt={formatMessage({id: 'gif_picker.attribution.alt', defaultMessage: 'Powered by GIPHY'})}
                />
            </div>
        </div>
    );
}

export default memo(GifPickerSearch);
