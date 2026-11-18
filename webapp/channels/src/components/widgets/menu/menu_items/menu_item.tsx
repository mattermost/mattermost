// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';

import './menu_item.scss';

/**
 * @deprecated Use the "webapp/channels/src/components/menu" instead.
 */
export default function menuItem(Component: React.ComponentType<any>) {
    type Props = {
        show: boolean;
        id?: string;

        /** The test id scope of the item: renders `<testId>--menuitem` on the item's own `li`. */
        testId?: string;

        /** The whole test id of the item's `li`, for an item whose contract ends in `--menuitem` such as a plugin's. */
        slotTestId?: string;
        icon?: React.ReactNode;
        text?: React.ReactNode;
    };
    class MenuItem extends React.PureComponent<Props & React.ComponentProps<typeof Component>> {
        public static defaultProps = {
            show: true,
        };

        public static displayName?: string;

        public render() {
            const {id, show, icon, text, testId, slotTestId, ...props} = this.props;
            if (!show) {
                return null;
            }

            let textProp: React.ReactNode = text;
            if (icon) {
                textProp = (
                    <>
                        <span className='icon'>{icon}</span>
                        <div className='text'>{text}</div>
                    </>
                );
            }

            return (
                <li
                    className={classNames('MenuItem', {
                        'MenuItem--with-icon': icon,
                    })}
                    role='menuitem'
                    id={id}
                    data-testid={slotTestId ?? (testId ? `${testId}--menuitem` : undefined)}
                >
                    <Component
                        text={textProp}
                        ariaLabel={text?.toString()}
                        id={id + '-button'}
                        scoped={Boolean(testId || slotTestId)}
                        {...props}
                    />
                </li>
            );
        }
    }
    return MenuItem;
}
