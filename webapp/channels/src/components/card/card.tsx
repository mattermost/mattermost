// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {Children, isValidElement, cloneElement} from 'react';

import CardBody from './card_body';
import type {CardChildProps} from './card_body';
import CardHeader from './card_header';

import './card.scss';

type Props = CardChildProps & {
    className?: string;
    children?: React.ReactNode;
};

export default class Card extends React.PureComponent<Props> {
    public static Header = CardHeader;
    public static Body = CardBody;

    render() {
        const {expanded, disableExpandAnimation, children} = this.props;

        const childrenWithProps = Children.map(children, (child) => {
            // Only Header and Body understand these; forwarding them to any other
            // child leaks them onto a host element as unknown DOM attributes.
            if (isValidElement<CardChildProps>(child) && (child.type === CardHeader || child.type === CardBody)) {
                return cloneElement(child, {expanded, disableExpandAnimation});
            }
            return child;
        });

        return (
            <div
                className={classNames('Card', this.props.className, {
                    expanded,
                })}
            >
                {childrenWithProps}
            </div>
        );
    }
}
