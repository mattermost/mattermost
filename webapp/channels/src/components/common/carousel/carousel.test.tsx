// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Carousel from 'components/common/carousel/carousel';

import {renderWithContext, userEvent, waitFor} from 'tests/react_testing_utils';

import {BtnStyle} from './carousel_button';

describe('/components/common/Carousel', () => {
    const texts = ['First Slide', 'Second Slide', 'Third Slide'];
    const baseProps = {
        id: 'test-string',
        infiniteSlide: true,
        dataSlides: [
            (
                <p
                    className='slide'
                    key={1}
                >
                    {texts[0]}
                </p>),
            (
                <p
                    className='slide'
                    key={2}
                >
                    {texts[1]}
                </p>
            ),
            (
                <p
                    className='slide'
                    key={3}
                >
                    {texts[2]}
                </p>
            ),
        ],
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(<Carousel {...baseProps}/>);
        expect(container).toMatchSnapshot();
    });

    test('test carouse slides lenght is as expected', () => {
        const {container} = renderWithContext(<Carousel {...baseProps}/>);
        const slides = container.querySelectorAll('p.slide');

        expect(slides.length).toBe(3);
    });

    test('test carousel shows next and previous button', () => {
        const {container} = renderWithContext(<Carousel {...baseProps}/>);
        const buttonNext = container.querySelector('a.next');
        const buttonPrev = container.querySelector('a.prev');

        expect(buttonNext).toBeInTheDocument();
        expect(buttonPrev).toBeInTheDocument();
    });

    test('test carousel shows next and previous chevrons when this option is sent', () => {
        const {container} = renderWithContext(
            <Carousel
                {...baseProps}
                btnsStyle={BtnStyle.CHEVRON}
            />,
        );
        const nextButton = container.querySelector('.chevron-right');
        const prevButton = container.querySelector('.chevron-left');

        expect(nextButton).toBeInTheDocument();
        expect(prevButton).toBeInTheDocument();
    });

    test('test carousel shows first slide as active', () => {
        const {container} = renderWithContext(<Carousel {...baseProps}/>);
        const activeSlide = container.querySelector('div.active-anim');

        const slideText = activeSlide!.querySelector('p.slide')!.textContent;
        expect(slideText).toEqual('First Slide');
    });

    test('test carousel moves slides when clicking buttons', async () => {
        const {container} = renderWithContext(<Carousel {...baseProps}/>);
        const activeSlide = container.querySelector('div.active-anim');

        const slide1Text = activeSlide!.querySelector('p.slide')!.textContent;
        expect(slide1Text).toEqual('First Slide');

        const buttonNext = container.querySelector('a.next') as HTMLElement;

        await userEvent.click(buttonNext);

        await waitFor(() => {
            const activeSlideAfterClick = container.querySelector('div.active-anim');
            const slideText = activeSlideAfterClick!.querySelector('p.slide')!.textContent;
            expect(slideText).toEqual('Second Slide');
        });
    });

    test('test carousel executes custom next and prev btn callback functions', async () => {
        const onPrevSlideClick = jest.fn();
        const onNextSlideClick = jest.fn();
        const props = {
            ...baseProps,
            onPrevSlideClick,
            onNextSlideClick};

        const {container} = renderWithContext(<Carousel {...props}/>);
        const buttonNext = container.querySelector('a.next') as HTMLElement;
        const buttonPrev = container.querySelector('a.prev') as HTMLElement;

        await userEvent.click(buttonNext);
        await userEvent.click(buttonPrev);

        expect(onNextSlideClick).toHaveBeenCalledWith(2);
        expect(onPrevSlideClick).toHaveBeenCalledWith(1);
    });
});
