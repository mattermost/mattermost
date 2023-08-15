// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ChangeEvent, memo, useEffect, useState} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import tinycolor from 'tinycolor2';

import {getTheme} from 'mattermost-redux/selectors/entities/preferences';

import {calculateContrastRatio} from 'utils/colors';

import giphyWhiteImage from 'images/gif_picker/powered-by-giphy-white.png';
import giphyBlackImage from 'images/gif_picker/powered-by-giphy-black.png';

interface Props {
    value: string;
    onChange: (value: string) => void;
}

function GifPickerSearch(props: Props) {
    const theme = useSelector(getTheme);

    const [useDarkLogo, setDarkLogo] = useState(false);

    const {formatMessage} = useIntl();

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        event.preventDefault();

        // remove trailing and leading colons
        const value = event.target?.value?.trim()?.toLowerCase()?.replace(/^:|:$/g, '') ?? '';
        props.onChange(value);
    };

    useEffect(() => {
        const WHITE_RGB = [255, 255, 255];
        const BLACK_RGB = [0, 0, 0];

        const backgroundColorRGB = tinycolor(theme.centerChannelBg).toRgb();
        const backgroundColor = [backgroundColorRGB.r, backgroundColorRGB.g, backgroundColorRGB.b];

        const contrastRatioForBlack = calculateContrastRatio(backgroundColor, BLACK_RGB);
        const contrastRatioForWhite = calculateContrastRatio(backgroundColor, WHITE_RGB);

        if (contrastRatioForBlack > contrastRatioForWhite) {
            setDarkLogo(true);
        } else {
            setDarkLogo(false);
        }
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
                    src={useDarkLogo ? giphyBlackImage : giphyWhiteImage}
                    alt={formatMessage({id: 'gif_picker.attribution.alt', defaultMessage: 'Powered by GIPHY'})}
                />
            </div>
        </div>
    );
}

export default memo(GifPickerSearch);
