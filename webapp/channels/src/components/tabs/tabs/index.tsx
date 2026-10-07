// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Tabs as CompassTabs} from '@mattermost/compass-ui/components/tabs';
import type {TabItem} from '@mattermost/compass-ui/components/tabs';
import classNames from 'classnames';
import React, {Children, isValidElement, useMemo} from 'react';
import type {SelectCallback} from 'react-bootstrap';

import Tab from 'components/tabs/tab';
import type {TabProps} from 'components/tabs/tab';

import './style.scss';

type Props = {
    children?: React.ReactNode;
    id?: string;
    activeKey?: string | number;
    defaultActiveKey?: string | number;
    mountOnEnter?: boolean;
    unmountOnExit?: boolean;
    onSelect?: SelectCallback;
    className?: string;
};

function isTabElement(child: React.ReactNode): child is React.ReactElement<TabProps> {
    return isValidElement(child) && child.type === Tab;
}

export default function Tabs({
    children,
    id,
    activeKey,
    defaultActiveKey,
    unmountOnExit,
    onSelect,
    className,
    mountOnEnter,
}: Props) {
    const tabChildren = useMemo(() => Children.toArray(children).filter(isTabElement), [children]);

    const tabs: TabItem[] = useMemo(() => {
        return tabChildren.map((tab) => {
            const key = String(tab.props.eventKey ?? '');
            const buttonClassName = tab.props.tabClassName;

            return {
                key,
                label: tab.props.title ?? key,
                id: `tab-${key}`,
                panelId: `tabpanel-${key}`,
                buttonProps: {
                    className: buttonClassName,
                    tabIndex: tab.props.tabIndex,
                },
            };
        });
    }, [tabChildren]);

    const resolvedActiveKey = String(
        activeKey ??
        defaultActiveKey ??
        tabChildren[0]?.props.eventKey ??
        '',
    );

    const handleChange = (key: string) => {
        onSelect?.(key, null);
    };

    return (
        <div
            id={id}
            className={classNames('tabs', className)}
        >
            <CompassTabs
                tabs={tabs}
                activeKey={resolvedActiveKey}
                onChange={handleChange}
            />
            <div className='tab-content'>
                {tabChildren.map((tab) => {
                    const key = String(tab.props.eventKey ?? '');
                    const isActive = key === resolvedActiveKey;

                    if (unmountOnExit && !isActive) {
                        return null;
                    }

                    if (mountOnEnter && !isActive) {
                        return null;
                    }

                    return (
                        <div
                            key={key}
                            id={`tabpanel-${key}`}
                            role='tabpanel'
                            aria-labelledby={`tab-${key}`}
                            hidden={!isActive}
                        >
                            {tab.props.children}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
