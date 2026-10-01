// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import type {FileInfo} from '@mattermost/types/files';

import {renderWithContext} from 'tests/react_testing_utils';

import {ArchiveFileError, ArchiveTooLargeError, buildFileArchive} from './file_archive';
import MediaGallery, {nextNarrowState} from './media_gallery';

jest.mock('./file_archive', () => ({
    ...jest.requireActual('./file_archive'),
    buildFileArchive: jest.fn(),
}));

const mockBuildFileArchive = buildFileArchive as jest.MockedFunction<typeof buildFileArchive>;

function fileInfo(overrides: Partial<FileInfo>): FileInfo {
    return {
        id: 'file1',
        user_id: 'u1',
        channel_id: 'c1',
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        name: 'image.png',
        extension: 'png',
        size: 1024,
        mime_type: 'image/png',
        width: 800,
        height: 600,
        has_preview_image: true,
        clientId: '',
        archived: false,
        ...overrides,
    };
}

describe('nextNarrowState', () => {
    const SCROLLBAR_WIDTH = 15;

    it('switches to compact rows below the enter threshold', () => {
        expect(nextNarrowState(false, 479)).toBe(true);
        expect(nextNarrowState(false, 480)).toBe(false);
    });

    it('stays compact until well past the enter threshold so a vanishing scrollbar cannot flip it back', () => {
        expect(nextNarrowState(true, 479 + SCROLLBAR_WIDTH)).toBe(true);
        expect(nextNarrowState(true, 511)).toBe(true);
        expect(nextNarrowState(true, 512)).toBe(false);
    });

    it('settles at every width in the worst case, where tall rows scroll and compact rows do not', () => {
        for (let unscrolledWidth = 400; unscrolledWidth <= 600; unscrolledWidth++) {
            const scrolledWidth = unscrolledWidth - SCROLLBAR_WIDTH;

            // Going compact hides the scrollbar, which widens the container back out.
            if (nextNarrowState(false, scrolledWidth)) {
                expect(nextNarrowState(true, unscrolledWidth)).toBe(true);
            }

            // Going tall shows the scrollbar, which narrows the container again.
            if (!nextNarrowState(true, unscrolledWidth)) {
                expect(nextNarrowState(false, scrolledWidth)).toBe(false);
            }
        }
    });
});

describe('MediaGallery', () => {
    const baseState = {
        entities: {
            general: {
                config: {EnablePublicLink: 'true'},
            },
        },
    };

    it('renders nothing when there are no image or video files', () => {
        const onClick = jest.fn();
        const {container} = renderWithContext(
            <MediaGallery
                fileInfos={[fileInfo({extension: 'pdf', mime_type: 'application/pdf'})]}
                postId='p1'
                onItemClick={onClick}
            />,
            baseState,
        );
        expect(container.firstChild).toBeNull();
    });

    it('renders an image tile and forwards the original fileInfos index on click', async () => {
        const onClick = jest.fn();
        const files = [
            fileInfo({id: 'a', extension: 'pdf', mime_type: 'application/pdf'}),
            fileInfo({id: 'b', name: 'pic.png'}),
        ];

        renderWithContext(
            <MediaGallery
                fileInfos={files}
                postId='p1'
                onItemClick={onClick}
            />,
            baseState,
        );

        const tile = await screen.findByTestId('media-gallery-tile');
        const image = tile.querySelector('img');
        await userEvent.click(image!);

        expect(onClick).toHaveBeenCalledWith(1);
    });

    it('renders a video tile for mp4 files', () => {
        const onClick = jest.fn();
        renderWithContext(
            <MediaGallery
                fileInfos={[fileInfo({id: 'v', name: 'clip.mp4', extension: 'mp4', mime_type: 'video/mp4'})]}
                postId='p1'
                onItemClick={onClick}
            />,
            baseState,
        );
        expect(screen.getByTestId('media-gallery-tile')).toBeInTheDocument();
    });

    it('renders a collapse toggle header for multi-image galleries when a toggle handler is provided', async () => {
        const onClick = jest.fn();
        const onToggle = jest.fn();
        renderWithContext(
            <MediaGallery
                fileInfos={[
                    fileInfo({id: 'a', name: 'a.png'}),
                    fileInfo({id: 'b', name: 'b.png'}),
                ]}
                postId='p1'
                onItemClick={onClick}
                onToggleCollapse={onToggle}
            />,
            baseState,
        );

        const toggle = screen.getByRole('button', {name: /toggle media gallery/i});
        await userEvent.click(toggle);
        expect(onToggle).toHaveBeenCalledWith('p1');
    });

    it('uses compact rows in a narrow container', () => {
        const rectSpy = jest.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
            width: 400,
            height: 144,
        } as DOMRect);

        try {
            const {container} = renderWithContext(
                <MediaGallery
                    fileInfos={[fileInfo({id: 'v', name: 'clip.mp4', extension: 'mp4', mime_type: 'video/mp4'})]}
                    postId='p1'
                    onItemClick={jest.fn()}
                />,
                baseState,
            );

            const row = container.querySelector<HTMLElement>('.MediaGallery__row');
            expect(row).not.toBeNull();
            expect(row!.style.height).toBe('144px');
        } finally {
            rectSpy.mockRestore();
        }
    });

    it('marks the tile container as hidden when isEmbedVisible is false', () => {
        const {container} = renderWithContext(
            <MediaGallery
                fileInfos={[
                    fileInfo({id: 'a', name: 'a.png'}),
                    fileInfo({id: 'b', name: 'b.png'}),
                ]}
                postId='p1'
                isEmbedVisible={false}
                onItemClick={jest.fn()}
                onToggleCollapse={jest.fn()}
            />,
            baseState,
        );

        const rows = container.querySelector('.MediaGallery__rows');
        expect(rows).not.toBeNull();
        expect(rows).toHaveClass('MediaGallery__rows--collapsed');
        expect(rows).toHaveAttribute('aria-hidden', 'true');
    });

    it('renders a collapse toggle for a collapsed single video', async () => {
        const onToggle = jest.fn();
        renderWithContext(
            <MediaGallery
                fileInfos={[fileInfo({id: 'v', name: 'clip.mp4', extension: 'mp4', mime_type: 'video/mp4'})]}
                postId='p1'
                isEmbedVisible={false}
                onItemClick={jest.fn()}
                onToggleCollapse={onToggle}
            />,
            baseState,
        );

        const toggle = screen.getByRole('button', {name: /toggle media gallery/i});
        await userEvent.click(toggle);
        expect(onToggle).toHaveBeenCalledWith('p1');
    });

    describe('download all', () => {
        const originalCreateObjectURL = URL.createObjectURL;
        const originalRevokeObjectURL = URL.revokeObjectURL;
        let anchorClick: jest.SpyInstance;
        let downloadedAs: string[];

        // jsdom does not implement the object URL APIs.
        beforeEach(() => {
            URL.createObjectURL = jest.fn().mockReturnValue('blob:archive');
            URL.revokeObjectURL = jest.fn();
            downloadedAs = [];
            anchorClick = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function(this: HTMLAnchorElement) {
                downloadedAs.push(this.download);
            });
        });

        afterEach(() => {
            anchorClick.mockRestore();
            URL.createObjectURL = originalCreateObjectURL;
            URL.revokeObjectURL = originalRevokeObjectURL;
            mockBuildFileArchive.mockReset();
        });

        const state = {
            entities: {
                ...baseState.entities,
                channels: {channels: {c1: {id: 'c1', display_name: 'Town Square'}}},
                posts: {posts: {p1: {id: 'p1', create_at: new Date(2026, 8, 29, 12).getTime()}}},
            },
        };

        const renderGallery = () => renderWithContext(
            <MediaGallery
                fileInfos={[
                    fileInfo({id: 'a', name: 'a.png'}),
                    fileInfo({id: 'b', name: 'b.png'}),
                ]}
                postId='p1'
                onItemClick={jest.fn()}
                onToggleCollapse={jest.fn()}
            />,
            state,
        );

        it('downloads one archive named after the channel and post date, showing progress while it is prepared', async () => {
            const blob = new Blob(['zip']);
            let finish: (value: Blob) => void = () => {};
            let reportProgress: (done: number) => void = () => {};
            mockBuildFileArchive.mockImplementation((_files, options) => {
                reportProgress = options?.onProgress ?? reportProgress;
                return new Promise((resolve) => {
                    finish = resolve;
                });
            });

            renderGallery();
            const button = screen.getByRole('button', {name: /download all/i});
            const click = userEvent.click(button);

            await waitFor(() => expect(button).toBeDisabled());
            expect(button).toHaveAttribute('aria-busy', 'true');
            expect(button).toHaveTextContent('Preparing 0 of 2...');
            expect(within(button).getByTestId('loadingSpinner')).toBeInTheDocument();
            expect(mockBuildFileArchive.mock.calls[0][0].map((f) => f.id)).toEqual(['a', 'b']);

            act(() => reportProgress(1));
            expect(button).toHaveTextContent('Preparing 1 of 2...');

            finish(blob);
            await click;

            await waitFor(() => expect(button).toBeEnabled());
            expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
            expect(downloadedAs).toEqual(['Town-Square-2026-09-29.zip']);
            expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:archive');
        });

        it('shows the server error inline, then clears it on a successful retry', async () => {
            mockBuildFileArchive.mockRejectedValueOnce(new ArchiveFileError('You do not have the appropriate permissions.'));

            renderGallery();
            const button = screen.getByRole('button', {name: /download all/i});
            await userEvent.click(button);

            await waitFor(() => expect(button).toBeEnabled());
            expect(screen.getByRole('alert')).toHaveTextContent('You do not have the appropriate permissions.');
            expect(anchorClick).not.toHaveBeenCalled();

            mockBuildFileArchive.mockResolvedValueOnce(new Blob());
            await userEvent.click(button);

            await waitFor(() => expect(anchorClick).toHaveBeenCalled());
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });

        it('explains when the files are too large to download together', async () => {
            mockBuildFileArchive.mockRejectedValueOnce(new ArchiveTooLargeError());

            renderGallery();
            await userEvent.click(screen.getByRole('button', {name: /download all/i}));

            expect(await screen.findByRole('alert')).toHaveTextContent('These files are too large to download together.');
        });
    });
});

