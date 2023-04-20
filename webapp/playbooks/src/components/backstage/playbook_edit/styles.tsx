// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';
import {mdiClockOutline, mdiCurrencyUsd, mdiPound} from '@mdi/js';
import Icon from '@mdi/react';
import React from 'react';

export const Section = styled.div`
    margin: 32px 0;
`;

export const SectionTitle = styled.div`
    font-weight: 600;
    margin: 0 0 32px 0;
`;

export const SidebarBlock = styled.div`
    margin: 0 0 40px;
`;

export const ClockOutline = ({sizePx, color}: {sizePx: number, color?: string}) => (
    <Icon
        path={mdiClockOutline}
        size={`${sizePx}px`}
        color={color}
    />
);

export const DollarSign = ({sizePx, color}: {sizePx: number, color?: string}) => (
    <Icon
        path={mdiCurrencyUsd}
        size={`${sizePx}px`}
        color={color}
    />
);

export const PoundSign = ({sizePx, color}: {sizePx: number, color?: string}) => (
    <Icon
        path={mdiPound}
        size={`${sizePx}px`}
        color={color}
    />
);
