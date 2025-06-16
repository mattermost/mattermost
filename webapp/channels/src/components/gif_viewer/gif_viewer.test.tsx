// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act, fireEvent, render, waitFor} from '@testing-library/react';
import React, {createRef} from 'react';

import GifViewer from './gif_viewer';
import type {GifViewerHandle} from './gif_viewer';

describe('GifViewer', () => {
    const defaultProps = {
        src: 'test.gif',
        alt: 'Test GIF',
        className: 'test-class',
    };

    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should render the GIF viewer with proper structure', () => {
        const {container} = render(<GifViewer {...defaultProps}/>);

        const wrapper = container.querySelector('.test-class');
        expect(wrapper).toBeInTheDocument();

        const img = container.querySelector('img');
        expect(img).toBeInTheDocument();
        expect(img).toHaveAttribute('src', 'test.gif');
        expect(img).toHaveAttribute('alt', 'Test GIF');
    });

    it('should start playing automatically', () => {
        const {container} = render(<GifViewer {...defaultProps}/>);
        const img = container.querySelector('img') as HTMLImageElement;

        expect(img).toBeInTheDocument();
        expect(img).toHaveAttribute('src', 'test.gif');
    });

    it('should expose control methods via ref', () => {
        const ref = React.createRef<GifViewerHandle>();
        render(
            <GifViewer
                {...defaultProps}
                ref={ref}
            />,
        );

        expect(ref.current).toBeDefined();
        expect(ref.current?.togglePlayback).toBeInstanceOf(Function);
        expect(ref.current?.isPlaying).toBe(true);
        expect(ref.current?.hasTimedOut).toBe(false);
    });

    it('should pause/resume on click', async () => {
        const ref = React.createRef<GifViewerHandle>();
        const {container} = render(
            <GifViewer
                {...defaultProps}
                ref={ref}
            />,
        );
        const img = container.querySelector('img') as HTMLImageElement;

        // Initially playing - img should be visible
        expect(img).toBeInTheDocument();
        expect(ref.current?.isPlaying).toBe(true);

        // Simulate image load to enable canvas capture
        fireEvent.load(img);

        // Use ref to toggle playback
        act(() => {
            ref.current?.togglePlayback();
        });

        // After pause, check ref state
        expect(ref.current?.isPlaying).toBe(false);

        // Toggle again to resume
        act(() => {
            ref.current?.togglePlayback();
        });

        // After resume, check ref state
        expect(ref.current?.isPlaying).toBe(true);
    });

    it('should handle keyboard navigation', () => {
        const {container} = render(<GifViewer {...defaultProps}/>);
        const img = container.querySelector('img') as HTMLImageElement;

        // Simulate image load
        fireEvent.load(img);

        // Press Enter to pause
        fireEvent.keyDown(img, {key: 'Enter'});

        // After pause, canvas should be visible
        const canvas = container.querySelector('canvas');
        expect(canvas).toBeInTheDocument();
        expect(canvas).toHaveStyle('display: block');

        // Press Space to resume
        fireEvent.keyDown(canvas!, {key: ' '});

        // After resume, img should be visible
        const imgAfterResume = container.querySelector('img');
        expect(imgAfterResume).toBeInTheDocument();
        expect(imgAfterResume).toHaveStyle('display: block');

        // Other keys should not affect playback
        fireEvent.keyDown(imgAfterResume!, {key: 'a'});
        expect(container.querySelector('img')).toBeInTheDocument();
    });

    it('should stop after 10 seconds', async () => {
        const ref = React.createRef<GifViewerHandle>();
        const {container} = render(
            <GifViewer
                {...defaultProps}
                ref={ref}
            />,
        );
        const img = container.querySelector('img')!;

        // Trigger load event
        fireEvent.load(img);

        // Fast-forward 10 seconds
        act(() => {
            jest.advanceTimersByTime(10000);
        });

        // Should be stopped after 10 seconds
        await waitFor(() => {
            const canvas = container.querySelector('canvas');
            expect(canvas).toHaveStyle('display: block');
        });

        // Check that ref indicates timeout
        await waitFor(() => {
            expect(ref.current?.hasTimedOut).toBe(true);
            expect(ref.current?.isPlaying).toBe(false);
        });
    });

    it('should notify parent of playback state changes', () => {
        const onPlaybackChange = jest.fn();
        const {container} = render(
            <GifViewer
                {...defaultProps}
                onPlaybackChange={onPlaybackChange}
            />,
        );
        const img = container.querySelector('img') as HTMLImageElement;

        // Simulate image load first
        fireEvent.load(img);

        // Should be called with initial state after load
        expect(onPlaybackChange).toHaveBeenCalledWith(true, false);

        // Manually pause using keyboard to test state change
        fireEvent.keyDown(img, {key: 'Enter'});

        expect(onPlaybackChange).toHaveBeenLastCalledWith(false, false);
    });

    it('should restart from beginning when clicking refresh', async () => {
        const ref = React.createRef<GifViewerHandle>();
        const {container} = render(
            <GifViewer
                {...defaultProps}
                ref={ref}
            />,
        );
        const img = container.querySelector('img')!;

        // Trigger load first
        fireEvent.load(img);

        // Fast-forward 10 seconds to trigger timeout
        act(() => {
            jest.advanceTimersByTime(10000);
        });

        await waitFor(() => {
            expect(ref.current?.hasTimedOut).toBe(true);
        });

        // Call togglePlayback to restart
        act(() => {
            ref.current?.togglePlayback();
        });

        // Should be playing again from beginning
        await waitFor(() => {
            expect(ref.current?.isPlaying).toBe(true);
            expect(ref.current?.hasTimedOut).toBe(false);
        });
    });

    it('should start paused when autoplay is disabled', () => {
        const ref = createRef<GifViewerHandle>();
        render(
            <GifViewer
                src='test.gif'
                autoplayEnabled={false}
                ref={ref}
            />,
        );

        // Should start paused
        expect(ref.current?.isPlaying).toBe(false);
        expect(ref.current?.hasTimedOut).toBe(false);
    });

    it('should not set timer when autoplay is disabled', () => {
        const ref = createRef<GifViewerHandle>();
        const {container} = render(
            <GifViewer
                src='test.gif'
                autoplayEnabled={false}
                ref={ref}
            />,
        );
        const img = container.querySelector('img')!;

        // Trigger load
        fireEvent.load(img);

        // Start playing manually
        act(() => {
            ref.current?.togglePlayback();
        });

        expect(ref.current?.isPlaying).toBe(true);

        // Fast-forward 10 seconds - should still be playing since timer is disabled
        act(() => {
            jest.advanceTimersByTime(10000);
        });

        expect(ref.current?.isPlaying).toBe(true);
        expect(ref.current?.hasTimedOut).toBe(false);
    });

    it('should call onLoad when image loads', () => {
        const onLoad = jest.fn();
        const {container} = render(
            <GifViewer
                {...defaultProps}
                onLoad={onLoad}
            />,
        );
        const img = container.querySelector('img')!;

        fireEvent.load(img);
        expect(onLoad).toHaveBeenCalled();
    });

    it('should call onError when image fails to load', () => {
        const onError = jest.fn();
        const {container} = render(
            <GifViewer
                {...defaultProps}
                onError={onError}
            />,
        );
        const img = container.querySelector('img')!;

        fireEvent.error(img);
        expect(onError).toHaveBeenCalled();
    });

    it('should propagate custom onClick when provided', () => {
        const onClick = jest.fn();
        const {container} = render(
            <GifViewer
                {...defaultProps}
                onClick={onClick}
            />,
        );
        const img = container.querySelector('img')!;

        fireEvent.click(img);
        expect(onClick).toHaveBeenCalled();
    });

    it('should have proper accessibility attributes', () => {
        const {container} = render(<GifViewer {...defaultProps}/>);
        const img = container.querySelector('img')!;
        expect(img).toHaveAttribute('aria-label', 'GIF image: Test GIF. Playing');
        expect(img).toHaveAttribute('tabIndex', '0');
        expect(img).toHaveStyle('display: block');

        // Simulate load and pause to check canvas accessibility
        fireEvent.load(img);
        fireEvent.keyDown(img, {key: 'Enter'});

        const canvas = container.querySelector('canvas');
        expect(canvas).toBeInTheDocument();
        expect(canvas).toHaveStyle('display: block');
        expect(canvas).toHaveAttribute('aria-label', 'GIF image: Test GIF. Paused');
        expect(canvas).toHaveAttribute('tabIndex', '0');
        expect(canvas).toHaveAttribute('role', 'button');
    });
});
