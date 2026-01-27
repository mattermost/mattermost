// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Accordion from 'components/common/accordion/accordion';

import {renderWithContext, userEvent} from 'tests/react_testing_utils';

describe('/components/common/Accordion', () => {
    const texts = ['First List Item', 'Second List Item', 'Third List Item'];
    const baseProps = {
        onHeaderClick: jest.fn(),
        openMultiple: false,
        accordionItemsData: [
            {
                title: 'First Accordion Item',
                description: 'First accordion Item Description',
                items: [
                    (
                        <p
                            className='accordion-item-content-el'
                            key={1}
                        >
                            {texts[0]}
                        </p>
                    ),
                    (
                        <p
                            className='accordion-item-content-el'
                            key={2}
                        >
                            {texts[1]}
                        </p>
                    ),
                ],
            },
            {
                title: 'Second Accordion Item',
                description: 'Second accordion Item Description',
                items: [
                    (
                        <p
                            className='accordion-item-content-el'
                            key={1}
                        >
                            {texts[2]}
                        </p>
                    ),
                ],
            },
        ],
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(<Accordion {...baseProps}/>);
        expect(container).toMatchSnapshot();
    });

    test('test accordion items length is 2 as specified in items property in baseProps', () => {
        const {container} = renderWithContext(<Accordion {...baseProps}/>);
        const accordionItems = container.querySelectorAll('.accordion-card');

        expect(accordionItems.length).toBe(2);
    });

    test('test accordion opens first accordion item when clicked', async () => {
        const {container} = renderWithContext(<Accordion {...baseProps}/>);
        const firstAccordionCard = container.querySelector('ul li.accordion-card');
        const header = firstAccordionCard!.querySelector('.accordion-card-header') as HTMLElement;
        await userEvent.click(header);

        const firstChildItem = container.querySelector('.accordion-card.active .accordion-card-container .accordion-item-content-el');
        const slide1Text = firstChildItem!.textContent;
        expect(slide1Text).toEqual('First List Item');
    });

    test('test accordion opens ONLY one accordion item at a time if NO openMultiple prop is set or set to FALSE', async () => {
        const {container} = renderWithContext(<Accordion {...baseProps}/>);
        const accordionCards = container.querySelectorAll('ul li.accordion-card');
        const firstAccordionCard = accordionCards[0];
        const secondAccordionCard = accordionCards[1];

        const header1 = firstAccordionCard.querySelector('.accordion-card-header') as HTMLElement;
        const header2 = secondAccordionCard.querySelector('.accordion-card-header') as HTMLElement;

        await userEvent.click(header1);

        // clicking first list element should only apply the active class to the first one and not to the last
        expect(firstAccordionCard.classList.contains('active')).toEqual(true);
        expect(secondAccordionCard.classList.contains('active')).toEqual(false);

        await userEvent.click(header2);

        // clicking last list element should only apply the active class to the last one and not to the first
        expect(firstAccordionCard.classList.contains('active')).toEqual(false);
        expect(secondAccordionCard.classList.contains('active')).toEqual(true);
    });

    test('test accordion opens MORE THAN one accordion item at a time if openMultiple prop IS set to TRUE', async () => {
        const {container} = renderWithContext(
            <Accordion
                {...baseProps}
                expandMultiple={true}
            />);
        const accordionCards = container.querySelectorAll('ul li.accordion-card');
        const firstAccordionCard = accordionCards[0];
        const secondAccordionCard = accordionCards[1];

        const header1 = firstAccordionCard.querySelector('.accordion-card-header') as HTMLElement;
        const header2 = secondAccordionCard.querySelector('.accordion-card-header') as HTMLElement;

        await userEvent.click(header1);

        // clicking first list element should only apply the active class to the first one and not to the last
        expect(firstAccordionCard.classList.contains('active')).toEqual(true);
        expect(secondAccordionCard.classList.contains('active')).toEqual(false);

        await userEvent.click(header2);

        // clicking last list element should apply active class to both
        expect(firstAccordionCard.classList.contains('active')).toEqual(true);
        expect(secondAccordionCard.classList.contains('active')).toEqual(true);
    });
});
