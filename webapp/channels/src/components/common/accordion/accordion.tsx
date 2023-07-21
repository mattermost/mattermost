// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {RefObject, useState} from 'react';

import AccordionCard from './accordion_card';

import './accordion.scss';

export type AccordionItemType = {
    title: string;
    description?: string;
    extraContent?: React.ReactNode;
    icon?: React.ReactNode;
    items: React.ReactNode[];
    id?: string;
};

type AccordionProps = {
    accordionItemsData: AccordionItemType[];
    expandMultiple?: boolean;
    openFirstElement?: boolean;
    onHeaderClick?: <T>(ref: RefObject<HTMLLIElement>) => T | void;
    className?: string;
    onItemOpened?: (index: number) => void;
};

const Accordion = ({
    accordionItemsData,
    expandMultiple,
    openFirstElement,
    onHeaderClick,
    onItemOpened,
    className,
}: AccordionProps): JSX.Element => {
    const [currentIndexes, setCurrentIndexes] = useState<number[]>(openFirstElement ? [0] : []);

    const onButtonClick = (index: number) => {
        if (currentIndexes.includes(index)) {
            const newIndexes = currentIndexes.filter((_index: number) => {
                return index !== _index;
            });
            setCurrentIndexes(newIndexes);
        } else {
            if (onItemOpened) {
                onItemOpened(index);
            }
            setCurrentIndexes(expandMultiple ? [...currentIndexes, index] : [index]);
        }
    };

    return (
        <ul className={classNames('Accordion', className)}>
            {accordionItemsData.map((accordionItem, index) => {
                return (
                    <AccordionCard
                        key={index.toString()}
                        data={accordionItem}
                        isExpanded={Boolean(currentIndexes.includes(index))}
                        onButtonClick={() => onButtonClick(index)}
                        onHeaderClick={onHeaderClick}
                    />
                );
            })}
        </ul>
    );
};

export default Accordion;
