// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import Logo from 'components/common/svg_images_components/logo_dark_blue_svg';

const ProductBrandingTeamEditionContainer = styled.span`
    display: flex;
    align-items: center;

    > * + * {
        margin-left: 8px;
    }
`;

const StyledLogo = styled(Logo)`
    path {
        fill: rgba(var(--sidebar-text-rgb), 0.75);
    }
`;

const Badge = styled.span`
    display: flex;
    align-self: center;
    padding: 2px 6px;
    border-radius: var(--radius-s);
    margin-left: 12px;
    background: rgba(var(--sidebar-text-rgb), 0.08);
    color: rgba(var(--sidebar-text-rgb), 0.75);
    font-family: 'Open Sans', sans-serif;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.025em;
    line-height: 16px;
`;

const ProductBrandingTeamEdition = (): JSX.Element => {
    return (
        <ProductBrandingTeamEditionContainer tabIndex={-1}>
            <StyledLogo
                width={116}
                height={20}
            />
            <Badge>{'FREE EDITION'}</Badge>
        </ProductBrandingTeamEditionContainer>
    );
};

export default ProductBrandingTeamEdition;
