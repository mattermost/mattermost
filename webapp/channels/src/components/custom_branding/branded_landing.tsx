// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';
import styled from 'styled-components';

import {Client4} from 'mattermost-redux/client';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

const hexToRgb = (hex: string): string => {
    var result = (/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i).exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '';
};

type BrandedLandingProps = {
    background: string;
    buttonBg: string;
    buttonText: string;
    color: string;
    linkColor: string;
    backgroundImage: string | null;
}

const BrandedLandingStyled = styled.div<BrandedLandingProps>`
    &&& {
        background: ${(props) => props.background};
        color: ${(props) => props.color};
        background-image: ${(props) => (props.backgroundImage ? `url(${props.backgroundImage})` : null)};
        background-position: center;
        background-repeat: no-repeat;
        background-size: cover;
    }

    &&&&& .get-app__alternative span, &&&& .get-app__preference span, &&&& .get-app__download-link span {
        color: ${(props) => props.color};
    }

    &&&& .get-app__download-link a {
        color: ${(props) => props.linkColor};
        font-weight: 600;
    }

    &&&& .get-app__download {
        background: ${(props) => props.buttonBg};
        color: ${(props) => props.buttonText};
    }

    &&&& .btn-tertiary {
        background: ${(props) => `rgba(${hexToRgb(props.buttonText)}, 1)`};
        color: ${(props) => `rgba(${hexToRgb(props.buttonBg)}, 1)`};
    }
`;

type Props = {
    className?: string;
    children: React.ReactNode;
}

const BrandedLanding = (props: Props) => {
    const {
        CustomBrandColorText,
        CustomBrandColorBackground,
        CustomBrandColorButtonBackground,
        CustomBrandColorButtonText,
        CustomBrandHasBackground,
        EnableCustomBrand,
    } = useSelector(getConfig);

    if (EnableCustomBrand === 'true') {
        return (
            <BrandedLandingStyled
                className={props.className || ''}
                background={CustomBrandColorBackground || ''}
                buttonBg={CustomBrandColorButtonBackground || ''}
                buttonText={CustomBrandColorButtonText || ''}
                color={CustomBrandColorText || ''}
                linkColor={CustomBrandColorButtonBackground || ''}
                backgroundImage={CustomBrandHasBackground === 'true' ? Client4.getCustomBackgroundUrl('0') : null}
            >
                {props.children}
            </BrandedLandingStyled>
        );
    }
    return (<div className={props.className}>{props.children}</div>);
};

export default BrandedLanding;
