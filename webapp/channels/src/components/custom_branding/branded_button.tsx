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

type BrandedButtonStyledProps = {
    background: string;
    textColor: string;
}

const BrandedButtonStyled = styled.div<BrandedButtonStyledProps>`
    &&&&&&&&&& a {
        color: ${(props) => props.background} !important;
    }
    &&&&&&&&&& > button {
        background: ${(props) => props.background};
        color: ${(props) => props.textColor} !important;
    }
    &&&&&&&&&& > button > span{
        color: ${(props) => props.textColor} !important;
    }
    &&&&&&&&&& > button:disabled {
        background: ${(props) => `rgba(${hexToRgb(props.background)}, 0.16)`};
        color: ${(props) => `rgba(${hexToRgb(props.textColor)}, 0.32) !important`};
    }
    &&&&&&&&&& > button:disabled > span {
        color: ${(props) => `rgba(${hexToRgb(props.textColor)}, 0.32) !important`};
    }
`;

const BrandedButton = (props: {className?: string; children: React.ReactNode}) => {
    const {
        CustomBrandColorButtonBackground,
        CustomBrandColorButtonText,
        EnableCustomBrand,
    } = useSelector(getConfig);

    if (EnableCustomBrand === 'true') {
        return (
            <BrandedButtonStyled
                background={CustomBrandColorButtonBackground || ''}
                textColor={CustomBrandColorButtonText || ''}
                className={props.className || ''}
            >
                {props.children}
            </BrandedButtonStyled>
        );
    }
    return (<div className={props.className}>{props.children}</div>);
};

export default BrandedButton;
