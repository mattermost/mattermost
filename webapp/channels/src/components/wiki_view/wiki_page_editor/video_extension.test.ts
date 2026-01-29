// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Editor} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

import Video from './video_extension';

describe('Video Extension', () => {
    let editor: Editor;

    beforeEach(() => {
        editor = new Editor({
            extensions: [StarterKit, Video],
            content: '<p>Test content</p>',
        });
    });

    afterEach(() => {
        editor.destroy();
    });

    describe('node configuration', () => {
        it('is configured as a block node', () => {
            const videoType = editor.schema.nodes.video;
            expect(videoType).toBeDefined();
            expect(videoType.spec.group).toBe('block');
        });

        it('is configured as an atom (non-editable content)', () => {
            const videoType = editor.schema.nodes.video;
            expect(videoType.spec.atom).toBe(true);
        });

        it('is draggable', () => {
            const videoType = editor.schema.nodes.video;
            expect(videoType.spec.draggable).toBe(true);
        });
    });

    describe('setVideo command', () => {
        it('inserts video with src attribute', () => {
            editor.commands.setVideo({src: 'https://example.com/video.mp4'});

            const json = editor.getJSON();
            const videoNode = json.content?.find((node) => node.type === 'video');
            expect(videoNode).toBeDefined();
            expect(videoNode?.attrs?.src).toBe('https://example.com/video.mp4');
        });

        it('inserts video with all attributes', () => {
            editor.commands.setVideo({
                src: 'https://example.com/video.mp4',
                title: 'My Video',
                width: 640,
                height: 480,
            });

            const json = editor.getJSON();
            const videoNode = json.content?.find((node) => node.type === 'video');
            expect(videoNode?.attrs?.src).toBe('https://example.com/video.mp4');
            expect(videoNode?.attrs?.title).toBe('My Video');
            expect(videoNode?.attrs?.width).toBe(640);
            expect(videoNode?.attrs?.height).toBe(480);
        });

        it('inserts video with only required src attribute', () => {
            editor.commands.setVideo({src: 'https://example.com/video.webm'});

            const json = editor.getJSON();
            const videoNode = json.content?.find((node) => node.type === 'video');
            expect(videoNode?.attrs?.src).toBe('https://example.com/video.webm');
            expect(videoNode?.attrs?.title).toBeNull();
            expect(videoNode?.attrs?.width).toBeNull();
            expect(videoNode?.attrs?.height).toBeNull();
        });
    });

    describe('HTML parsing', () => {
        it('parses video element with src', () => {
            const html = '<video src="https://example.com/video.mp4"></video>';
            editor.commands.setContent(html);

            const json = editor.getJSON();
            expect(json.content?.[0].type).toBe('video');
            expect(json.content?.[0].attrs?.src).toBe('https://example.com/video.mp4');
        });

        it('parses video element with all attributes', () => {
            const html = '<video src="https://example.com/video.mp4" title="Test Video" width="800" height="600"></video>';
            editor.commands.setContent(html);

            const json = editor.getJSON();
            expect(json.content?.[0].attrs?.src).toBe('https://example.com/video.mp4');
            expect(json.content?.[0].attrs?.title).toBe('Test Video');
            expect(json.content?.[0].attrs?.width).toBe('800');
            expect(json.content?.[0].attrs?.height).toBe('600');
        });

        it('parses video element with controls attribute (ignored in schema)', () => {
            const html = '<video src="https://example.com/video.mp4" controls></video>';
            editor.commands.setContent(html);

            const json = editor.getJSON();
            expect(json.content?.[0].type).toBe('video');
            expect(json.content?.[0].attrs?.src).toBe('https://example.com/video.mp4');
        });
    });

    describe('HTML rendering', () => {
        it('renders with wiki-video class', () => {
            editor.commands.setVideo({src: 'https://example.com/video.mp4'});

            const html = editor.getHTML();
            expect(html).toContain('class="wiki-video"');
        });

        it('renders with controls attribute', () => {
            editor.commands.setVideo({src: 'https://example.com/video.mp4'});

            const html = editor.getHTML();
            expect(html).toContain('controls');
        });

        it('renders with preload="metadata"', () => {
            editor.commands.setVideo({src: 'https://example.com/video.mp4'});

            const html = editor.getHTML();
            expect(html).toContain('preload="metadata"');
        });

        it('renders with src attribute', () => {
            editor.commands.setVideo({src: 'https://example.com/video.mp4'});

            const html = editor.getHTML();
            expect(html).toContain('src="https://example.com/video.mp4"');
        });

        it('renders with title attribute when provided', () => {
            editor.commands.setVideo({src: 'https://example.com/video.mp4', title: 'My Video'});

            const html = editor.getHTML();
            expect(html).toContain('title="My Video"');
        });

        it('renders with dimensions when provided', () => {
            editor.commands.setVideo({
                src: 'https://example.com/video.mp4',
                width: 640,
                height: 480,
            });

            const html = editor.getHTML();
            expect(html).toContain('width="640"');
            expect(html).toContain('height="480"');
        });

        it('does not render null attributes', () => {
            editor.commands.setVideo({src: 'https://example.com/video.mp4'});

            const html = editor.getHTML();
            expect(html).not.toContain('title=""');
            expect(html).not.toContain('width=""');
            expect(html).not.toContain('height=""');
        });
    });

    describe('content handling', () => {
        it('video node has no editable content (atom)', () => {
            editor.commands.setVideo({src: 'https://example.com/video.mp4'});

            const json = editor.getJSON();
            const videoNode = json.content?.find((node) => node.type === 'video');
            expect(videoNode?.content).toBeUndefined();
        });

        it('multiple videos can be inserted', () => {
            editor.commands.setVideo({src: 'https://example.com/video1.mp4'});
            editor.commands.setVideo({src: 'https://example.com/video2.mp4'});

            const json = editor.getJSON();
            const videoNodes = json.content?.filter((node) => node.type === 'video');
            expect(videoNodes?.length).toBe(2);
        });
    });
});
