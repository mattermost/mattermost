// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef} from 'react';
import classNames from 'classnames';
import styled from 'styled-components';

import TextWithTooltipWhenEllipsis from 'src/components/widgets/text_with_tooltip_when_ellipsis';

interface Props {
    name: string;
    direction: string;
    active: boolean;
    onClick: () => void;
}

export function SortableColHeader({name, direction, active, onClick}: Props) {
    const nameRef = useRef(null);

    const chevron = classNames('icon--small', 'ml-2', {
        'icon-chevron-down': direction === 'desc',
        'icon-chevron-up': direction === 'asc',
    });

    return (
        <Header onClick={() => onClick()}>
            <Name ref={nameRef}>
                <TextWithTooltipWhenEllipsis
                    id={`col_${name}`}
                    text={name}
                    parentRef={nameRef}
                />
            </Name>
            {
                active &&
                <i className={chevron}/>
            }
        </Header>
    );
}

const Header = styled.div`
    display: flex;
    cursor: pointer;
`;

const Name = styled.div`
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;
