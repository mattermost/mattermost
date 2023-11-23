// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import Accordion from 'components/common/accordion/accordion';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';

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
        const wrapper = shallow(<Accordion {...baseProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('test accordion items length is 2 as specified in items property in baseProps', () => {
        const wrapper = shallow(<Accordion {...baseProps}/>);
        const accordionItems = wrapper.find('AccordionCard');

        expect(accordionItems.length).toBe(2);
    });

    test('test accordion opens first accordion item when clicked', () => {
        const wrapper = mountWithIntl(<Accordion {...baseProps}/>);
        const firstAccordionCard = wrapper.find('ul AccordionCard:first-child');
        const header = firstAccordionCard.find('div.accordion-card-header');
        header.simulate('click');

        const firstChildItem = firstAccordionCard.find('div.accordion-card-container p.accordion-item-content-el:first-child');
        const slide1Text = firstChildItem.text();
        expect(slide1Text).toEqual('First List Item');
    });

    test('test accordion opens ONLY one accordion item at a time if NO openMultiple prop is set or set to FALSE', () => {
        const wrapper = mountWithIntl(<Accordion {...baseProps}/>);
        const firstAccordionCard = wrapper.find('ul AccordionCard:first-child');
        const secondAccordionCard = wrapper.find('ul AccordionCard:last-child');

        const header1 = firstAccordionCard.find('div.accordion-card-header');
        const header2 = secondAccordionCard.find('div.accordion-card-header');

        header1.simulate('click');

        // refind the element after making changes so those gets reflected
        const firstAccordionCardAfterEvent = wrapper.find('ul AccordionCard:first-child');
        const secondAccordionCardAfterEvent = wrapper.find('ul AccordionCard:last-child');

        // clicking first list element should only apply the active class to the first one and not to the last
        expect(firstAccordionCardAfterEvent.find('li.accordion-card').hasClass('active')).toEqual(true);
        expect(secondAccordionCardAfterEvent.find('li.accordion-card').hasClass('active')).toEqual(false);

        header2.simulate('click');

        // refind the element after making changes so those gets reflected
        const firstAccordionCardAfterEvent1 = wrapper.find('ul AccordionCard:first-child');
        const secondAccordionCardAfterEvent1 = wrapper.find('ul AccordionCard:last-child');

        // clicking last list element should only apply the active class to the last one and not to the first
        expect(firstAccordionCardAfterEvent1.find('li.accordion-card').hasClass('active')).toEqual(false);
        expect(secondAccordionCardAfterEvent1.find('li.accordion-card').hasClass('active')).toEqual(true);
    });

    test('test accordion opens MORE THAN one accordion item at a time if openMultiple prop IS set to TRUE', () => {
        const wrapper = mountWithIntl(
            <Accordion
                {...baseProps}
                expandMultiple={true}
            />);
        const firstAccordionCard = wrapper.find('ul AccordionCard:first-child');
        const secondAccordionCard = wrapper.find('ul AccordionCard:last-child');

        const header1 = firstAccordionCard.find('div.accordion-card-header');
        const header2 = secondAccordionCard.find('div.accordion-card-header');

        header1.simulate('click');

        // refind the element after making changes so those gets reflected
        const firstAccordionCardAfterEvent = wrapper.find('ul AccordionCard:first-child');
        const secondAccordionCardAfterEvent = wrapper.find('ul AccordionCard:last-child');

        // clicking first list element should only apply the active class to the first one and not to the last
        expect(firstAccordionCardAfterEvent.find('li.accordion-card').hasClass('active')).toEqual(true);
        expect(secondAccordionCardAfterEvent.find('li.accordion-card').hasClass('active')).toEqual(false);

        header2.simulate('click');

        // refind the element after making changes so those gets reflected
        const firstAccordionCardAfterEvent1 = wrapper.find('ul AccordionCard:first-child');
        const secondAccordionCardAfterEvent1 = wrapper.find('ul AccordionCard:last-child');

        // clicking last list element should apply active class to both
        expect(firstAccordionCardAfterEvent1.find('li.accordion-card').hasClass('active')).toEqual(true);
        expect(secondAccordionCardAfterEvent1.find('li.accordion-card').hasClass('active')).toEqual(true);
    });
});
