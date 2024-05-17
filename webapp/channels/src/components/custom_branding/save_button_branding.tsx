// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';
import styled from 'styled-components';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

const hexToRgb = (hex: string): string => {
    var result = (/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i).exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '';
};

type SaveButtonBrandingStyledProps = {
    background: string;
    textColor: string;
}

const SaveButtonBrandingStyled = styled.div<SaveButtonBrandingStyledProps>`
    &&&&&&&&&& > button {
        background: ${(props) => props.background};
        color: ${(props) => props.textColor} !important;
    }
    &&&&&&&&&& > button > span{
        color: ${(props) => props.textColor} !important;
    }
    &&&&&&&&&& > button:disabled {
        background: ${(props) => `rgba(${hexToRgb(props.background)}, 0.08)`};
        color: ${(props) => `rgba(${hexToRgb(props.textColor)}, 0.32) !important`};
    }
    &&&&&&&&&& > button:disabled > span {
        color: ${(props) => `rgba(${hexToRgb(props.textColor)}, 0.32) !important`};
    }
`;

const SaveButtonBranding = (props: {className?: string; children: React.ReactNode}) => {
    const {
        CustomBrandColorButtonBgColor,
        CustomBrandColorButtonTextColor,
        EnableCustomBrand,
    } = useSelector(getConfig);

    if (EnableCustomBrand === 'true') {
        return (
            <SaveButtonBrandingStyled
                background={CustomBrandColorButtonBgColor || ''}
                textColor={CustomBrandColorButtonTextColor || ''}
                className={props.className || ''}
            >
                {props.children}
            </SaveButtonBrandingStyled>
        );
    }
    return (<div className={props.className}>{props.children}</div>);
};

export default SaveButtonBranding;
