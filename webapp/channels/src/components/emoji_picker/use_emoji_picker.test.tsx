// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import useEmojiPicker from './use_emoji_picker';

jest.mock('./emoji_picker_tabs', () => () => <div className='emoji-picker'>{'picker'}</div>);

function Harness({open, placement}: {open: boolean; placement?: 'top' | 'top-start'}) {
    const {emojiPicker, setReference} = useEmojiPicker({
        showEmojiPicker: open,
        setShowEmojiPicker: jest.fn(),
        onEmojiClick: jest.fn(),
        placement,
    });

    return (
        <>
            <button ref={setReference}>{'Emoji'}</button>
            {emojiPicker}
        </>
    );
}

describe('useEmojiPicker', () => {
    it('renders the picker in a PopoverMenu surface', () => {
        renderWithContext(<Harness open={true}/>);

        const surface = document.querySelector('.emoji-picker-surface');
        expect(surface).toBeInTheDocument();
        expect(surface).toHaveClass('emoji-picker-surface--origin-bottom');
        expect(surface).toContainElement(screen.getByText('picker'));
    });

    it('pins the scale origin to the reference edge when placement is top-start', () => {
        renderWithContext(
            <Harness
                open={true}
                placement='top-start'
            />,
        );

        expect(document.querySelector('.emoji-picker-surface')).toHaveClass('emoji-picker-surface--origin-bottom-left');
    });
});
