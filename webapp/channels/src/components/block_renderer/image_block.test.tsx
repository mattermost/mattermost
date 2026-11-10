// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {MmImageBlock} from '@mattermost/types/mm_blocks';

import {openModal} from 'actions/views/modals';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';

import {MmBlocksImagesMetadataContext} from './context';
import {ImageBlock} from './image_block';

const mockOpenModal = jest.fn();

jest.mock('actions/views/modals', () => ({
    openModal: jest.fn(),
}));

jest.mock('components/external_image', () => ({
    __esModule: true,
    default: jest.fn((props: {children: (src: string) => React.ReactNode; src: string}) => (
        <>{props.children(props.src)}</>
    )),
}));

jest.mock('components/size_aware_image', () => ({
    __esModule: true,
    default: jest.fn((props: {src: string; alt?: string; className?: string; onClick?: (e: React.MouseEvent) => void}) => (
        <img
            data-testid='size-aware-image'
            src={props.src}
            alt={props.alt}
            className={props.className}
            onClick={props.onClick}
        />
    )),
}));

jest.mock('components/file_preview_modal', () => ({
    __esModule: true,
    default: () => null,
}));

describe('ImageBlock', () => {
    beforeEach(() => {
        jest.mocked(openModal).mockImplementation((args) => {
            mockOpenModal(args);
            return {type: 'MODAL_OPEN'} as ReturnType<typeof openModal>;
        });
        mockOpenModal.mockClear();
    });

    it('returns null when url is empty', () => {
        const {container} = renderWithContext(
            <ImageBlock
                block={{type: 'image', url: '   '} as MmImageBlock}
                postId='post-1'
            />,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('renders image with alignment and person style class', () => {
        const {container} = renderWithContext(
            <MmBlocksImagesMetadataContext.Provider value={undefined}>
                <ImageBlock
                    block={{
                        type: 'image',
                        url: 'https://example.com/photo.png',
                        alt_text: 'Photo',
                        horizontal_alignment: 'center',
                        image_style: 'person',
                    }}
                    postId='post-1'
                />
            </MmBlocksImagesMetadataContext.Provider>,
        );

        const wrapper = container.querySelector('.mm-blocks-image') as HTMLElement;
        expect(wrapper).toHaveStyle({justifyContent: 'center'});
        expect(screen.getByTestId('size-aware-image')).toHaveAttribute('src', 'https://example.com/photo.png');
        expect(screen.getByTestId('size-aware-image')).toHaveClass('mm-blocks-image__img--person');
    });

    it('infers extension from pathname when url has query params', async () => {
        const user = userEvent.setup();
        renderWithContext(
            <MmBlocksImagesMetadataContext.Provider value={undefined}>
                <ImageBlock
                    block={{
                        type: 'image',
                        url: 'https://example.com/photo.png?sig=abc123',
                        alt_text: 'Signed photo',
                    }}
                    postId='post-42'
                />
            </MmBlocksImagesMetadataContext.Provider>,
        );

        await user.click(screen.getByTestId('size-aware-image'));
        expect(openModal).toHaveBeenCalledWith(expect.objectContaining({
            dialogProps: expect.objectContaining({
                fileInfos: [expect.objectContaining({
                    link: 'https://example.com/photo.png?sig=abc123',
                    extension: 'png',
                })],
            }),
        }));
    });

    it('opens file preview modal when image is clicked', async () => {
        const user = userEvent.setup();
        renderWithContext(
            <MmBlocksImagesMetadataContext.Provider
                value={{
                    'https://example.com/photo.png': {format: 'png', height: 100, width: 100, frameCount: 1},
                }}
            >
                <ImageBlock
                    block={{
                        type: 'image',
                        url: 'https://example.com/photo.png',
                        alt_text: 'Alt label',
                    }}
                    postId='post-42'
                />
            </MmBlocksImagesMetadataContext.Provider>,
        );

        await user.click(screen.getByTestId('size-aware-image'));
        expect(openModal).toHaveBeenCalledWith(expect.objectContaining({
            modalId: ModalIdentifiers.FILE_PREVIEW_MODAL,
            dialogProps: expect.objectContaining({
                postId: 'post-42',
                fileInfos: [expect.objectContaining({
                    link: 'https://example.com/photo.png',
                    extension: 'png',
                    name: 'Alt label',
                })],
            }),
        }));
    });
});
