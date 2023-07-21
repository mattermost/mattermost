// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {CardSize, CardSizes} from '@mattermost/types/insights';
import classNames from 'classnames';
import React, {memo} from 'react';
import {useIntl} from 'react-intl';

import Card from 'components/card/card';
import CardHeader from 'components/card/card_header';

import './card.scss';

type Props = {
    class: string;
    children: React.ReactNode;
    title: string;
    subTitle?: string;
    size: CardSize;
    onClick: () => void;
}

const InsightsCard = (props: Props) => {
    const {formatMessage} = useIntl();

    return (
        <Card
            className={classNames('insights-card expanded', props.class, {
                large: props.size === CardSizes.large,
                medium: props.size === CardSizes.medium,
                small: props.size === CardSizes.small,
            })}
        >
            <CardHeader
                onClick={props.onClick}
            >
                <div className='title-and-subtitle'>
                    <div className='text-top'>
                        <h2>
                            {props.title}
                        </h2>
                    </div>
                    <div className='text-bottom'>
                        {props.subTitle}
                    </div>
                </div>
                <button
                    className='icon'
                    onClick={(e) => {
                        e.stopPropagation();
                        props.onClick();
                    }}
                    aria-label={formatMessage(
                        {
                            id: 'insights.card.ariaLabel',
                            defaultMessage: 'Open modal for {title}',
                        },
                        {
                            title: props.title,
                        },
                    )}
                    aria-haspopup='dialog'
                >
                    <i className='icon icon-chevron-right'/>
                </button>
            </CardHeader>
            <div
                className='Card__body expanded'
            >
                {props.children}
            </div>
        </Card>
    );
};

export default memo(InsightsCard);
