// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';
import styled from 'styled-components';

import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {Client4} from 'mattermost-redux/client';

type BrandedHeaderFooterRouteProps = {
    background: string;
    color: string;
    backgroundImage: string | null;
}

const BrandedHeaderFooterRouteStyled = styled.div<BrandedHeaderFooterRouteProps>`
    &&& {
        background: ${(props) => props.background};
        color: ${(props) => props.color};
        background-image: ${(props) => `url(${props.backgroundImage})`};
        background-position: "center";
        background-repeat: "no-repeat";
        background-size: "cover";
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
        CustomBrandHasBackground,
        EnableCustomBrand,
    } = useSelector(getConfig);

    if (EnableCustomBrand === 'true') {
        return (
            <BrandedHeaderFooterRouteStyled
                className={props.className || ''}
                background={CustomBrandColorBackground || ''}
                color={CustomBrandColorText || ''}
                backgroundImage={CustomBrandHasBackground === 'true' ? Client4.getCustomBackgroundUrl('0') : null}
            >
                {props.children}
            </BrandedHeaderFooterRouteStyled>
        );
    }
    return (<div className={props.className}>{props.children}</div>);
};

export default BrandedHeaderFooterRoute;
