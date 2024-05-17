// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';
import styled from 'styled-components';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

type BrandedBodyProps = {
    linkColor: string;
    textColor: string;
}

const hexToRgb = (hex: string): string => {
    var result = (/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i).exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '';
};

const BrandedBodyStyled = styled.div<BrandedBodyProps>`
    &&&&&, &&&&& h1, &&&&& div {
        color: ${(props) => props.textColor};
    }
    &&&&& p {
        color: ${(props) => `rgba(${hexToRgb(props.textColor)}, 0.75)`};
    }
    &&&&& a {
        color: ${(props) => props.linkColor};
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
        CustomBrandColorButtonBgColor,
        EnableCustomBrand,
    } = useSelector(getConfig);

    if (EnableCustomBrand === 'true') {
        return (
            <BrandedBodyStyled
                textColor={CustomBrandColorText || ''}
                linkColor={CustomBrandColorButtonBgColor || ''}
                className={props.className || ''}
            >
                {props.children}
            </BrandedBodyStyled>
        );
    }
    return (<div className={props.className}>{props.children}</div>);
};

export default BrandedBody;
