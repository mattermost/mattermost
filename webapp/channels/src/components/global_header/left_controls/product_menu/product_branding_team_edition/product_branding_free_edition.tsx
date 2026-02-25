// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Techzen: Replaced Mattermost logo with Techzen horizontal logo

import React from 'react';
import styled from 'styled-components';

import TechzenLogoHorizontal from 'components/common/svg_images_components/techzen_logo_horizontal';

const ProductBrandingFreeEditionContainer = styled.span`
    display: flex;
    align-items: center;

    > * + * {
        margin-left: 8px;
    }
`;

const StyledLogo = styled(TechzenLogoHorizontal)`
    color: #ffffff;
`;

const ProductBrandingFreeEdition = (): JSX.Element => {
    return (
        <ProductBrandingFreeEditionContainer tabIndex={-1}>
            <StyledLogo
                width={130}
                height={32}
            />
        </ProductBrandingFreeEditionContainer>
    );
};

export default ProductBrandingFreeEdition;
