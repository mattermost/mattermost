// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';
import styled from 'styled-components';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

type BrandedLinkStyledProps = {
    textColor: string;
}

const BrandedLinkStyled = styled.div<BrandedLinkStyledProps>`
    &&&&&&&&&& a {
        color: ${(props) => props.textColor};
    }

    &&& alternate-link__link {
        color: ${(props) => props.textColor};
    }
`;

const BrandedLink = (props: {className?: string; children: React.ReactNode}) => {
    const {
        CustomBrandColorButtonBackground,
        EnableCustomBrand,
    } = useSelector(getConfig);

    if (EnableCustomBrand === 'true') {
        return (
            <BrandedLinkStyled
                textColor={CustomBrandColorButtonBackground || ''}
                className={props.className || ''}
            >
                {props.children}
            </BrandedLinkStyled>
        );
    }
    return (<div className={props.className}>{props.children}</div>);
};

export default BrandedLink;
