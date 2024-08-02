// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import MultiSelectCard from './multi_select_card';
import type {Props as CardProps} from './multi_select_card';
import './index.scss';

type Props = {
    next?: () => void;
    cards: CardProps[];
    size?: 'regular' | 'small';
}

export default function MultiSelectCards(props: Props) {
    const size = props.size || 'regular';

    return (
        <div
            className='MultiSelectCards'
        >
            {props.cards.map((card) => (
                <MultiSelectCard
                    size={size}
                    key={card.id}
                    {...card}
                />
            ))}
        </div>
    );
}
