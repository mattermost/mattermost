// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';
import styled from 'styled-components';
import tinycolor from 'tinycolor2';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

type BrandedBodyProps = {
    linkColor: string;
    textColor: string;
}

const BrandedBodyStyled = styled.div<BrandedBodyProps>`
    &&&&&, &&&&& h1 {
        color: ${(props) => props.textColor};
    }
    &&&&& p {
        color: ${(props) => tinycolor(props.textColor).setAlpha(0.75).toRgbString()};
    }
    &&&&& a {
        color: ${(props) => props.linkColor};
    }

    @media screen and (max-width: 1199px){
        &&&&& .login-body-action,
        &&&&& .signup-body-action {
            padding: 16px;
        }
    }
`;

type Props = {
    tabIndex?: number;
    className?: string;
    children: React.ReactNode;
}

const BrandedBody = (props: Props) => {
    const {
        CustomBrandColorText,
        CustomBrandColorButtonBackground,
        EnableCustomBrand,
    } = useSelector(getConfig);

    if (EnableCustomBrand === 'true') {
        return (
            <BrandedBodyStyled
                textColor={CustomBrandColorText || ''}
                linkColor={CustomBrandColorButtonBackground || ''}
                className={props.className || ''}
            >
                {props.children}
            </BrandedBodyStyled>
        );
    }
    return (<div className={props.className}>{props.children}</div>);
};

export default BrandedBody;
