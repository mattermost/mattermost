// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';
import styled from 'styled-components';
import tinycolor from 'tinycolor2';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

type LoginSignupBlockProps = {
    background: string;
    linkColor: string;
    textColor: string;
}

const LoginSignupBlockStyled = styled.div<LoginSignupBlockProps>`
    &&&&& {
        border-radius: 8px;
        background: ${(props) => props.background};
        border-color: ${(props) => props.textColor + '14'};
        color: ${(props) => props.textColor};
    }

    &&&&& > div:first-child > p:first-child {
        color: ${(props) => props.textColor};
    }

    &&&&& p {
        color: ${(props) => tinycolor(props.textColor).setAlpha(0.75).toRgbString()};
    }

    &&&&& > div {
        border-radius: 8px;
        background: ${(props) => props.background};
        color: ${(props) => props.textColor};
    }
    &&&&& input {
        background: ${(props) => props.background};
        color: ${(props) => props.textColor};
    }
    &&&&& input::placeholder {
        color: ${(props) => props.textColor};
    }

    &&&&& #password_toggle {
        color: ${(props) => props.textColor};
        background: ${(props) => props.background};
    }
    &&&&& legend {
        color: ${(props) => props.textColor};
        background: ${(props) => props.background};
    }

    &&&&& fieldset {
        color: ${(props) => props.textColor};
        border-color: ${(props) => tinycolor(props.textColor).setAlpha(0.16).toRgbString()};
        background: ${(props) => props.background};
    }

    &&&&& fieldset:hover {
        border-color: ${(props) => tinycolor(props.textColor).setAlpha(0.24).toRgbString()};
    }

    &&&&& fieldset:focus-within {
        border-color: ${(props) => props.linkColor};
        color: ${(props) => props.linkColor};
        box-shadow: inset 0 0 0 1px ${(props) => props.linkColor};
    }
    &&&&& span {
        color: ${(props) => props.textColor};
    }
    &&&&&&&&&& a {
        color: ${(props) => props.linkColor};
    }
    &&&&& i {
        color: ${(props) => props.textColor + '8F'};
    }
`;

type Props = {
    tabIndex?: number;
    className?: string;
    children: React.ReactNode;
}

const LoginSignupBlock = (props: Props) => {
    const {
        CustomBrandColorLoginContainer,
        CustomBrandColorLoginContainerText,
        CustomBrandColorButtonBackground,
        EnableCustomBrand,
    } = useSelector(getConfig);

    if (EnableCustomBrand === 'true') {
        return (
            <LoginSignupBlockStyled
                background={CustomBrandColorLoginContainer || ''}
                textColor={CustomBrandColorLoginContainerText || ''}
                linkColor={CustomBrandColorButtonBackground || ''}
                className={props.className || ''}
            >
                {props.children}
            </LoginSignupBlockStyled>
        );
    }
    return (<div className={props.className}>{props.children}</div>);
};

export default LoginSignupBlock;
