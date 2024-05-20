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

type BrandedInputStyledProps = {
    background: string;
    linkColor: string;
    textColor: string;
}

const BrandedInputStyled = styled.div<BrandedInputStyledProps>`
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
        border-color: ${(props) => `rgba(${hexToRgb(props.textColor)}, 0.16)`};
        background-color: ${(props) => props.background};
    }
    &&&&& fieldset:hover {
        border-color: ${(props) => `rgba(${hexToRgb(props.textColor)}, 0.24)`};
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

