// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';
import styled from 'styled-components';
import tinycolor from 'tinycolor2';

import {Client4} from 'mattermost-redux/client';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

type BrandedHeaderFooterRouteProps = {
    background: string;
    color: string;
    linkColor: string;
    backgroundImage: string | null;
}

const BrandedHeaderFooterRouteStyled = styled.div<BrandedHeaderFooterRouteProps>`
    &&& {
        background: ${(props) => props.background};
        color: ${(props) => props.color};
        background-image: ${(props) => (props.backgroundImage ? `url(${props.backgroundImage})` : null)};
        background-position: center;
        background-repeat: no-repeat;
        background-size: cover;
    }

    &&&& .hfroute-footer .footer-copyright,
    &&&& .hfroute-footer .footer-link {
        color: ${(props) => tinycolor(props.color).setAlpha(0.64).toRgbString()};

    }

    &&&&& .AccessProblem__description {
        color: ${(props) => tinycolor(props.color).setAlpha(0.72).toRgbString()};
    }

    &&&&& .signup-team__container p {
        color: ${(props) => tinycolor(props.color).setAlpha(0.72).toRgbString()};
        margin-bottom: 24px;
    }

    &&&&& .alternate-link__link {
        color: ${(props) => props.linkColor};
    }

    &&&&& .signup-team__container input {
        background: ${(props) => props.background};
        color: ${(props) => props.color};
    }
    &&&&& .signup-team__container input::placeholder {
        color: ${(props) => props.color};
    }
    &&&&&&& .signup-team__container legend {
        color: ${(props) => props.color};
        background: ${(props) => props.background};
    }
    &&&&& .signup-team__container fieldset {
        color: ${(props) => tinycolor(props.color).setAlpha(0.16).toRgbString()};
        background-color: ${(props) => props.background};
    }
    &&&&& .signup-team__container fieldset:hover {
        color: ${(props) => tinycolor(props.color).setAlpha(0.24).toRgbString()};
    }
    &&&&& .signup-team__container fieldset:focus-within {
        border-color: ${(props) => props.linkColor};
        color: ${(props) => props.linkColor};
        box-shadow: inset 0 0 0 1px ${(props) => props.linkColor};
    }

`;

type Props = {
    className?: string;
    children: React.ReactNode;
}

const BrandedHeaderFooterRoute = (props: Props) => {
    const {
        CustomBrandColorText,
        CustomBrandColorBackground,
        CustomBrandColorButtonBackground,
        CustomBrandHasBackground,
        EnableCustomBrand,
    } = useSelector(getConfig);

    if (EnableCustomBrand === 'true') {
        return (
            <BrandedHeaderFooterRouteStyled
                className={props.className || ''}
                background={CustomBrandColorBackground || ''}
                color={CustomBrandColorText || ''}
                linkColor={CustomBrandColorButtonBackground || ''}
                backgroundImage={CustomBrandHasBackground === 'true' ? Client4.getCustomBackgroundUrl('0') : null}
            >
                {props.children}
            </BrandedHeaderFooterRouteStyled>
        );
    }
    return (<div className={props.className}>{props.children}</div>);
};

export default BrandedHeaderFooterRoute;
