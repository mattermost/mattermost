// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useEffect, useRef, useState} from 'react';
import type {RefObject} from 'react';

import type {AccordionItemType} from './accordion';

import './accordion.scss';

type Props = {
    data: AccordionItemType;
    isExpanded: boolean;
    onButtonClick: () => void;
    onHeaderClick?: <T>(ref: RefObject<HTMLLIElement>) => T | void;
}

const AccordionCard = ({
    data,
    isExpanded,
    onButtonClick,
    onHeaderClick,
}: Props): JSX.Element | null => {
    const contentRef = useRef<HTMLDivElement>(null);
    const itemRef = useRef<HTMLLIElement>(null);

    const [height, setHeight] = useState(0);
    const [open, setOpen] = useState(isExpanded);

    const toggle = () => {
        if (onButtonClick) {
            onButtonClick();
        }

        if (onHeaderClick) {
            onHeaderClick(itemRef);
        }
    };

    useEffect(() => {
        if (!contentRef?.current || data.items.length === 0) {
            return;
        }
        if (isExpanded) {
            const contentEl = contentRef.current;
            setHeight(contentEl.scrollHeight);
        } else {
            setHeight(0);
        }
        setOpen(isExpanded);
    }, [isExpanded]);

    const hasItems = data.items.length > 0;

    return (
        <li
            className={classNames('accordion-card', {active: open})}
            ref={itemRef}
        >
            <div
                className='accordion-card-header'
                onClick={hasItems ? toggle : undefined}
                role={hasItems ? 'button' : undefined}
            >
                {data.icon && (
                    <div className='accordion-card-header__icon'>
                        {data.icon}
                    </div>
                )}
                <div className='accordion-card-header__body'>
                    <div className='accordion-card-header__body__title'>
                        {data.title}
                    </div>
                    {data.description && (
                        <div className='accordion-card-header__body__description'>
                            {data.description}
                        </div>
                    )}
                </div>
                {data.extraContent && (
                    <div className='accordion-card-header__extraContent'>
                        {data.extraContent}
                    </div>
                )}
                {hasItems && (
                    <div className='accordion-card-header__chevron'>
                        <i className='icon-chevron-down'/>
                    </div>
                )}
            </div>
            {hasItems && (
                <div
                    className='accordion-card-container'
                    style={{height}}
                >
                    <div
                        ref={contentRef}
                        className='accordion-card-container__content'
                    >
                        {data.items}
                    </div>
                </div>
            )}
        </li>
    );
};

export default AccordionCard;
