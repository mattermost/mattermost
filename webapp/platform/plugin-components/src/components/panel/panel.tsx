// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import './style.scss';

import Icon from 'components/icon/icon';

export type Props = {
    title: string;
    subTitle?: string;
    children: React.ReactNode;
    className?: string;
    collapsible?: boolean;
    toggleFromHeader?: boolean;
    bannerComponent?: React.ReactNode;
}

export default function Panel({title, subTitle, children, className, collapsible, toggleFromHeader, bannerComponent}: Props) {
    const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
    const [height, setHeight] = useState<number>();

    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!collapsible || !contentRef.current) {
            return;
        }

        if (isCollapsed) {
            setHeight(0);
        } else {
            setHeight(contentRef.current.scrollHeight);
        }
    }, [isCollapsed, children, collapsible]);

    const handleToggleFromHeader = useCallback(() => {
        if (!collapsible || toggleFromHeader === false) {
            return;
        }

        setIsCollapsed((collapsed) => !collapsed);
    }, [collapsible, toggleFromHeader]);

    const handleToggleFromButton = useCallback(() => {
        if (!collapsible || toggleFromHeader !== true) {
            return;
        }

        setIsCollapsed((collapsed) => !collapsed);
    }, [collapsible, toggleFromHeader]);

    const banner = useMemo(() => {
        if (bannerComponent) {
            return bannerComponent;
        }

        return (
            <React.Fragment>
                <h5>{title}</h5>
                {
                    subTitle &&
                    <span>{subTitle}</span>
                }
            </React.Fragment>
        );
    }, [bannerComponent, subTitle, title]);

    return (
        <div className={classNames('Panel', className)}>
            <div
                className={classNames('panelHeader', 'horizontal', {pointer: collapsible && toggleFromHeader !== false})}
                onClick={handleToggleFromHeader}
            >
                <div className='left vertical'>
                    {banner}
                </div>
                {
                    collapsible &&
                    <div
                        className='right'
                    >
                        <div
                            className={classNames('toggleCollapseButton', {pointer: toggleFromHeader === false})}
                            onClick={handleToggleFromButton}
                        >
                            <Icon icon={isCollapsed ? 'chevron-down' : 'chevron-up'}/>
                        </div>
                    </div>
                }
            </div>

            <div
                className={classNames('panelBody', 'vertical', {isCollapsed})}
                ref={contentRef}
                style={{height}}
            >
                {children}
            </div>
        </div>
    );
}
