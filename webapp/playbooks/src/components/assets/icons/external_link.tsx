// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License for license information.

import React from 'react';
import styled from 'styled-components';

import Icon from 'src/components/assets/svg';

const Svg = styled(Icon)`
    width: 14px;
    height: 14px;
`;

const ExternalLink = (props : {className?: string}) => (
    <Svg
        width='14'
        height='14'
        viewBox='0 0 14 14'
        fill='none'
        xmlns='http://www.w3.org/2000/svg'
        className={props.className}
    >
        <path
            d='M8.494 0.250048V1.74405H11.194L3.814 9.12405L4.876 10.186L12.256 2.80605V5.50605H13.75V0.250048H8.494ZM12.256 12.256H1.744V1.74405H7V0.250048H1.744C1.336 0.250048 0.982 0.394048 0.682 0.682048C0.394 0.970048 0.25 1.32405 0.25 1.74405V12.256C0.25 12.664 0.394 13.012 0.682 13.3C0.982 13.6 1.336 13.75 1.744 13.75H12.256C12.664 13.75 13.012 13.6 13.3 13.3C13.6 13.012 13.75 12.664 13.75 12.256V7.00005H12.256V12.256Z'
            fill='currentColor'
            fillOpacity='0.48'
        />
    </Svg>
);

export default ExternalLink;

