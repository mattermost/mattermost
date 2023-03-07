// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';

import CarouselButton, {BtnStyle} from './carousel_button';
import './carousel.scss';

type Props = {
    dataSlides: React.ReactNode[];
    id: string;
    infiniteSlide: boolean;
    onNextSlideClick?: (slideIndex: number) => void;
    onPrevSlideClick?: (slideIndex: number) => void;
    disableNextButton?: boolean;
    btnsStyle?: BtnStyle; // chevron or bottom buttons
    actionButton?: JSX.Element;
}
const Carousel = ({
    dataSlides,
    id,
    infiniteSlide,
    onNextSlideClick,
    onPrevSlideClick,
    disableNextButton,
    btnsStyle = BtnStyle.BUTTON,
    actionButton,
}: Props): JSX.Element | null => {
    const [slideIndex, setSlideIndex] = useState(1);
    const [prevButtonDisabled, setPrevButtonDisabled] = useState(!infiniteSlide);
    const [nextButtonDisabled, setNextButtonDisabled] = useState(false);

    const nextSlide = () => {
        setPrevButtonDisabled(false);

        const isLastIndex = slideIndex === dataSlides.length;
        const newSlideIndex = isLastIndex && infiniteSlide ? 1 : (!isLastIndex && slideIndex + 1) || undefined;

        if (newSlideIndex) {
            setSlideIndex(newSlideIndex);

            if (onNextSlideClick) {
                onNextSlideClick(newSlideIndex);
            }
        }
    };

    const prevSlide = () => {
        setNextButtonDisabled(false);

        const isFirstSlide = slideIndex === 1;
        const newSlideIndex = isFirstSlide && infiniteSlide ? dataSlides.length : (!isFirstSlide && slideIndex - 1) || undefined;

        if (newSlideIndex) {
            setSlideIndex(newSlideIndex);

            if (onPrevSlideClick) {
                onPrevSlideClick(newSlideIndex);
            }
        }
    };

    useEffect(() => {
        if (slideIndex === dataSlides.length) {
            if (!infiniteSlide) {
                setNextButtonDisabled(true);
            }
        } else if (slideIndex === 1) {
            if (!infiniteSlide) {
                setPrevButtonDisabled(true);
            }
        }
    }, [slideIndex]);

    const moveDot = (index: number) => {
        setSlideIndex(index);
    };

    return (
        <div
            className='container-slider'
            id={id}
        >
            {btnsStyle === BtnStyle.CHEVRON && <>
                <CarouselButton
                    moveSlide={prevSlide}
                    direction={'prev'}
                    disabled={prevButtonDisabled}
                    btnsStyle={BtnStyle.CHEVRON}
                />
                <CarouselButton
                    moveSlide={nextSlide}
                    direction={'next'}
                    disabled={nextButtonDisabled || disableNextButton}
                    btnsStyle={BtnStyle.CHEVRON}
                />
            </>}
            {dataSlides.map((obj: any, index: number) => {
                return (
                    <div
                        key={`${index.toString()}`}
                        className={slideIndex === index + 1 ? 'slide active-anim' : 'slide'}
                    >
                        {obj}
                    </div>
                );
            })}

            <div className='container-footer'>
                <div className='container-dots'>
                    {dataSlides.map((item, index) => (
                        <div
                            key={index.toString()}
                            onClick={() => moveDot(index + 1)}
                            className={slideIndex === index + 1 ? 'dot active' : 'dot'}
                        />
                    ))}
                </div>
                {btnsStyle === BtnStyle.BUTTON && <div className=' buttons container-buttons'>
                    <CarouselButton
                        moveSlide={prevSlide}
                        direction={'prev'}
                        disabled={prevButtonDisabled}
                    />
                    <CarouselButton
                        moveSlide={nextSlide}
                        direction={'next'}
                        disabled={nextButtonDisabled || disableNextButton}
                    />
                </div>}
                {actionButton && <div className=' buttons container-buttons'>
                    {actionButton}
                </div>}
            </div>
        </div>
    );
};

export default Carousel;
