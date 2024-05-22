// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';
import styled from 'styled-components';
import tinycolor from 'tinycolor2';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

type BrandedInputStyledProps = {
    background: string;
    linkColor: string;
    textColor: string;
}

const BrandedInputStyled = styled.div<BrandedInputStyledProps>`
    flex-grow: 1;

    &&&&& input {
        background: ${(props) => props.background};
        color: ${(props) => props.textColor};
    }
    &&&&& input::placeholder {
        color: ${(props) => props.textColor};
    }
    &&&&& legend {
        color: ${(props) => props.textColor};
        background: ${(props) => props.background};
    }
    &&&&& fieldset {
        border-color: ${(props) => tinycolor(props.textColor).setAlpha(0.16).toRgbString()};
        background-color: ${(props) => props.background};
    }
    &&&&& fieldset:hover {
        border-color: ${(props) => tinycolor(props.textColor).setAlpha(0.24).toRgbString()};
    }
    &&&&& fieldset:focus-within {
        border-color: ${(props) => props.linkColor};
        color: ${(props) => props.linkColor};
        box-shadow: inset 0 0 0 1px ${(props) => props.linkColor};
    }


`;

const BrandedInput = (props: {className?: string; children: React.ReactNode}) => {
    const {
        CustomBrandColorLoginContainer,
        CustomBrandColorLoginContainerText,
        CustomBrandColorButtonBackground,
        EnableCustomBrand,
    } = useSelector(getConfig);

    if (EnableCustomBrand === 'true') {
        return (
            <BrandedInputStyled
                background={CustomBrandColorLoginContainer || ''}
                textColor={CustomBrandColorLoginContainerText || ''}
                linkColor={CustomBrandColorButtonBackground || ''}
                className={props.className || ''}
            >
                {props.children}
            </BrandedInputStyled>
        );
    }
    return (<div className={props.className}>{props.children}</div>);
};

export default BrandedInput;

