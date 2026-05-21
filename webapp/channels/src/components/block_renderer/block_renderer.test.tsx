// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {openModal} from 'actions/views/modals';

import ExternalImage from 'components/external_image';
import SizeAwareImage from 'components/size_aware_image';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';

import {BlockRenderer} from './block_renderer';

jest.mock('actions/views/modals', () => ({
    openModal: jest.fn(),
}));

jest.mock('components/markdown', () => ({
    __esModule: true,
    default: jest.fn((props: {message: string}) => (
        <div data-testid='markdown-mock'>{props.message}</div>
    )),
}));

jest.mock('components/external_image', () => ({
    __esModule: true,
    default: jest.fn((props: {
        src: string;
        imageMetadata?: {format?: string; height?: number; width?: number};
        children: (safeSrc: string) => React.ReactNode;
    }) => (
        <div
            data-testid='external-image-mock'
            data-image-format={props.imageMetadata?.format}
        >
            {props.children(props.src)}
        </div>
    )),
}));

jest.mock('components/size_aware_image', () => ({
    __esModule: true,
    default: jest.fn((props: {
        src: string;
        dimensions?: {format?: string; height?: number; width?: number};
        onClick?: (e: React.MouseEvent) => void;
    }) => (
        <img
            data-testid='size-aware-image'
            src={props.src}
            data-dimensions-format={props.dimensions?.format}
            onClick={props.onClick}
        />
    )),
}));

jest.mock('components/file_preview_modal', () => ({
    __esModule: true,
    default: () => null,
}));

describe('BlockRenderer', () => {
    const onAction = jest.fn();

    beforeEach(() => {
        onAction.mockClear();
        jest.mocked(openModal).mockReturnValue({type: 'MODAL_OPEN'} as ReturnType<typeof openModal>);
    });

    it('renders root mm-blocks group wrapping translated blocks', () => {
        renderWithContext(
            <BlockRenderer
                blocks={[
                    {type: 'text', text: 'Line one'},
                    {type: 'button', text: 'Act', action_id: 'act-1'},
                ]}
                postId='post-root'
                onAction={onAction}
            />,
        );

        expect(screen.getByRole('group')).toHaveClass('mm-blocks');
        expect(screen.getByText('Line one')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Act'})).toBeInTheDocument();
    });

    it('passes imagesMetadata to image blocks via context', async () => {
        const imageUrl = 'https://example.com/a.png';
        const imagesMetadata = {
            [imageUrl]: {format: 'png', height: 10, width: 10, frameCount: 1},
        };

        const user = userEvent.setup();
        renderWithContext(
            <BlockRenderer
                blocks={[{type: 'image', url: imageUrl, alt_text: 'A'}]}
                postId='post-img'
                onAction={onAction}
                imagesMetadata={imagesMetadata}
            />,
        );

        expect(jest.mocked(ExternalImage)).toHaveBeenCalledWith(
            expect.objectContaining({
                src: imageUrl,
                imageMetadata: imagesMetadata[imageUrl],
            }),
            expect.anything(),
        );

        expect(jest.mocked(SizeAwareImage)).toHaveBeenCalledWith(
            expect.objectContaining({
                src: imageUrl,
                dimensions: imagesMetadata[imageUrl],
            }),
            expect.anything(),
        );

        expect(screen.getByTestId('external-image-mock')).toHaveAttribute('data-image-format', 'png');
        expect(screen.getByTestId('size-aware-image')).toHaveAttribute('data-dimensions-format', 'png');

        await user.click(screen.getByTestId('size-aware-image'));
        expect(openModal).toHaveBeenCalledWith(expect.objectContaining({
            modalId: ModalIdentifiers.FILE_PREVIEW_MODAL,
            dialogProps: expect.objectContaining({
                fileInfos: [expect.objectContaining({
                    link: imageUrl,
                    extension: 'png',
                })],
            }),
        }));
    });

    it('forwards button actions from nested blocks', async () => {
        const user = userEvent.setup();
        renderWithContext(
            <BlockRenderer
                blocks={[
                    {
                        type: 'container',
                        flow: 'horizontal',
                        content: [
                            {type: 'button', text: 'Nested', action_id: 'nested', cookie: 'c'},
                        ],
                    },
                ]}
                postId='post-action'
                onAction={onAction}
            />,
        );

        await user.click(screen.getByRole('button', {name: 'Nested'}));
        expect(onAction).toHaveBeenCalledWith('nested', undefined, undefined, 'c');
    });
});
