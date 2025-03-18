// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import ShowFormat from 'components/advanced_text_editor/show_formatting/show_formatting';
import Textbox from 'components/textbox';
import type {TextboxElement} from 'components/textbox';
import type TextboxClass from 'components/textbox/textbox';

type AdvancedTextboxProps = {
    id: string;
    value: string;
    channelId: string;
    onChange: (e: React.ChangeEvent<TextboxElement>) => void;
    onKeypress: (e: React.KeyboardEvent<TextboxElement>) => void;
    createMessage: string;
    characterLimit: number;
    preview: boolean;
    togglePreview: () => void;
    textboxRef?: React.RefObject<TextboxClass>;
    useChannelMentions?: boolean;
    descriptionMessage?: JSX.Element | string;
};

const AdvancedTextbox = ({
    id,
    value,
    channelId,
    onChange,
    onKeypress,
    createMessage,
    characterLimit,
    preview,
    togglePreview,
    textboxRef,
    useChannelMentions = false,
    descriptionMessage,
}: AdvancedTextboxProps) => {
    return (
        <div className='textarea-wrapper'>
            <Textbox
                value={value}
                onChange={onChange}
                onKeyPress={onKeypress}
                supportsCommands={false}
                suggestionListPosition='bottom'
                createMessage={createMessage}
                ref={textboxRef}
                channelId={channelId}
                id={id}
                characterLimit={characterLimit}
                preview={preview}
                useChannelMentions={useChannelMentions}
            />
            <ShowFormat
                onClick={togglePreview}
                active={preview}
            />
            {descriptionMessage && (
                <p
                    data-testid='mm-modal-generic-section-item__description'
                    className='mm-modal-generic-section-item__description'
                >
                    {descriptionMessage}
                </p>
            )}
        </div>
    );
};

export default AdvancedTextbox;
