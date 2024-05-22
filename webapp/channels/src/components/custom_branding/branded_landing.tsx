// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';
import styled from 'styled-components';
import tinycolor from 'tinycolor2';

import {Client4} from 'mattermost-redux/client';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

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
        background: ${(props) => tinycolor(props.buttonBg).setAlpha(0.08).toRgbString()};
        color: ${(props) => props.buttonBg};
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
