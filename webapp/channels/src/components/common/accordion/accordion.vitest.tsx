// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, fireEvent} from 'tests/vitest_react_testing_utils';

import Accordion from './accordion';

describe('/components/common/Accordion', () => {
    const texts = ['First List Item', 'Second List Item', 'Third List Item'];
    const baseProps = {
        onHeaderClick: vi.fn(),
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
        const accordionCards = container.querySelectorAll('.accordion-card');

        expect(accordionCards).toHaveLength(2);
    });

    test('test accordion opens first accordion item when clicked', () => {
        const {container} = renderWithContext(<Accordion {...baseProps}/>);

        const firstHeader = container.querySelector('.accordion-card-header');
        fireEvent.click(firstHeader!);

        // Check if content is visible
        expect(screen.getByText('First List Item')).toBeInTheDocument();
    });

    test('test accordion opens ONLY one accordion item at a time if NO openMultiple prop is set or set to FALSE', () => {
        const {container} = renderWithContext(<Accordion {...baseProps}/>);

        const headers = container.querySelectorAll('.accordion-card-header');
        const firstCard = container.querySelectorAll('.accordion-card')[0];
        const secondCard = container.querySelectorAll('.accordion-card')[1];

        // Click first header
        fireEvent.click(headers[0]);
        expect(firstCard).toHaveClass('active');
        expect(secondCard).not.toHaveClass('active');

        // Click second header - should close first and open second
        fireEvent.click(headers[1]);
        expect(firstCard).not.toHaveClass('active');
        expect(secondCard).toHaveClass('active');
    });

    test('test accordion opens MORE THAN one accordion item at a time if openMultiple prop IS set to TRUE', () => {
        const {container} = renderWithContext(
            <Accordion
                {...baseProps}
                expandMultiple={true}
            />,
        );

        const headers = container.querySelectorAll('.accordion-card-header');
        const firstCard = container.querySelectorAll('.accordion-card')[0];
        const secondCard = container.querySelectorAll('.accordion-card')[1];

        // Click first header
        fireEvent.click(headers[0]);
        expect(firstCard).toHaveClass('active');
        expect(secondCard).not.toHaveClass('active');

        // Click second header - both should be open
        fireEvent.click(headers[1]);
        expect(firstCard).toHaveClass('active');
        expect(secondCard).toHaveClass('active');
    });
});
