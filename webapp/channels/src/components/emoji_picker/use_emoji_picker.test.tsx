// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import useEmojiPicker from './use_emoji_picker';

jest.mock('./emoji_picker_tabs', () => () => <div className='emoji-picker'>{'picker'}</div>);

function Harness({open}: {open: boolean}) {
    const {emojiPicker, setReference} = useEmojiPicker({
        showEmojiPicker: open,
        setShowEmojiPicker: jest.fn(),
        onEmojiClick: jest.fn(),
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
});
