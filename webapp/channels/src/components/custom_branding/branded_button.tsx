// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';
import styled from 'styled-components';
import tinycolor from 'tinycolor2';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

type BrandedButtonStyledProps = {
    background: string;
    textColor: string;
}

const BrandedButtonStyled = styled.div<BrandedButtonStyledProps>`
    &&&&&&&&&& a {
        color: ${(props) => props.background} !important;
    }
    &&&&&&&&&& > button {
        background: ${(props) => tinycolor(props.background).setAlpha(0.92).toRgbString()};
        color: ${(props) => props.textColor} !important;
    }

    &&&&&&&&&& > button:hover {
        background: ${(props) => tinycolor(props.background).setAlpha(1).toRgbString()};
    }

    &&&&&&&&&& > button > span{
        color: ${(props) => props.textColor} !important;
    }
    &&&&&&&&&& > button:disabled {
        background: ${(props) => tinycolor(props.background).setAlpha(0.16).toRgbString()};
        color: ${(props) => tinycolor(props.textColor).setAlpha(0.32).toRgbString() + ' !important'};
    }
    &&&&&&&&&& > button:disabled > span {
        color: ${(props) => tinycolor(props.textColor).setAlpha(0.32).toRgbString() + ' !important'};
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
