// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {Children, isValidElement, cloneElement} from 'react';

import CardBody from './card_body';
import CardHeader from './card_header';

import './card.scss';

type Props = {
    expanded?: boolean;
    className?: string;
    children?: React.ReactNode;
}

export default class Card extends React.PureComponent<Props> {
    public static Header = CardHeader;
    public static Body = CardBody;

    render() {
        const {expanded, children} = this.props;

        const childrenWithProps = Children.map(children, (child) => {
            // Checking isValidElement is the safe way and avoids a TS error too.
            if (isValidElement(child)) {
                return cloneElement(child, {expanded});
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
