// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License for license information.

import React from 'react';
import styled from 'styled-components';

interface Props {
    id?: string;
}

const Icon = styled.i`
	font-size: 22px;
`;

const PlaybooksProductIcon = React.forwardRef<HTMLElement, Props>((props: Props, forwardedRef) => (
    <Icon
        id={props?.id}
        ref={forwardedRef}
        className={'CompassIcon icon-product-playbooks LogoIcon'}
    />
));

export default PlaybooksProductIcon;
