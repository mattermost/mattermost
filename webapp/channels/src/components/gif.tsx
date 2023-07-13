// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import classNames from 'classnames';
import './gif.scss';
import {PlayIcon} from '@mattermost/compass-icons/components';

const preload = (src: string, callback: (value: HTMLImageElement) => void) => {
    const img = new Image();
    if (typeof callback === 'function') {
        img.onload = () => callback(img);
        img.setAttribute('crossOrigin', 'anonymous');
    }
    img.src = src;
};

const firstGifFrameUrl = (img: HTMLImageElement) => {
    const canvas = document.createElement('canvas');
    if (typeof canvas.getContext !== 'function') {
        return null;
    }

    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx && ctx.drawImage(img, 0, 0);
    return canvas.toDataURL();
};

const calcDurationGif = (file: any) => {
    return new Promise((resolve, reject) => {
        try {
            const arr = new Uint8Array(file);
            let duration = 0;
            for (let i = 0; i < arr.length; i++) {
                if (arr[i] === 0x21 &&
                arr[i + 1] === 0xF9 &&
                arr[i + 2] === 0x04 &&
                arr[i + 7] === 0x00) {
                    const delay = (arr[i + 5] << 8) | (arr[i + 4] & 0xFF);
                    duration += delay < 2 ? 10 : delay;
                }
            }
            resolve(duration / 100);
        } catch (e) {
            reject(e);
        }
    });
};

type Props = {
    src: string;
    autoplay: boolean;
    handleLoad: () => void;
    handleError: () => void;
    onClick: () => void;
    onKeyDown: () => void;
}

const GifPlayerContainer = (props: Props) => {
    const {autoplay, src, handleLoad, handleError, onClick, onKeyDown} = props;

    const [playing, setPlaying] = useState(autoplay);
    const [providedGif] = useState(src);
    const [actualGif] = useState(src);
    const [actualStill, setActualStill] = useState('');
    const [gifLoopCount, setGifLoopCount] = useState(1);
    const intervalId = useRef<any>();
    const gif = document.getElementById('gif') as HTMLImageElement;
    let updateId = -1;

    useEffect(() => {
        const updateImages = () => {
            if (providedGif) {
                const updatedId = ++updateId;
                preload(providedGif, (img: HTMLImageElement) => {
                    if (updateId === updatedId) {
                        const still = firstGifFrameUrl(img);
                        if (still) {
                            setActualStill(still);
                        }
                    }
                });
            }
        };

        updateImages();
    }, [providedGif, updateId]);

    useEffect(() => {
        if (gifLoopCount === 6) {
            setPlaying(false);
            setGifLoopCount(0);
            clearInterval(intervalId.current);
        }
    }, [gifLoopCount]);

    useEffect(() => {
        const countGifAnimation = () => {
            gif && gifLoopCounterInit(gif.src);
        };

        countGifAnimation();
    }, [gif]);

    const gifLoopCounterInit = useCallback((fileSrc: string) => {
        const request = new XMLHttpRequest();
        request.open('GET', fileSrc, true);
        request.responseType = 'arraybuffer';
        request.addEventListener('load', async () => {
            calcDurationGif(request.response).then((duration: any) => {
                let newCount = gifLoopCount;
                intervalId.current = setInterval(() => {
                    newCount++;
                    setGifLoopCount(newCount);
                }, duration * 1000);
            });
        });
        request.send();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [playing]);

    const toggle = (state: boolean) => {
        setPlaying(!state);
        setGifLoopCount(0);
        if (state) {
            clearInterval(intervalId.current);
        }
        if (!state) {
            gif && gifLoopCounterInit(gif.src);
        }
    };

    return (
        <div className='gif-container'>
            {!playing && (
                <button
                    className='gif-play_button'
                    onClick={() => toggle(playing)}
                >
                    <PlayIcon
                        className={'gif-play_button-svg'}
                        size={20}
                    />
                    <span>{'GIF'}</span>
                </button>
            )}
            <img
                {...props}
                className={classNames('gif', {
                    'show-gif': playing,
                })}
                id='gif'
                src={actualGif}
                onLoad={() => handleLoad()}
                onError={() => handleError()}
                onClick={onClick}
                onKeyDown={onKeyDown}
            />
            <img
                {...props}
                className={classNames('still-gif', {
                    'show-still-gif': !playing,
                })}
                src={actualStill}
                onLoad={() => handleLoad()}
                onError={() => handleError()}
                onClick={onClick}
                onKeyDown={onKeyDown}
            />
        </div>
    );
};

export default GifPlayerContainer;
