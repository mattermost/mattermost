// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import ShowFormat from 'components/advanced_text_editor/show_formatting/show_formatting';
import Textbox from 'components/textbox';
import type {TextboxElement} from 'components/textbox';
import type TextboxClass from 'components/textbox/textbox';

type SettingsTextboxProps = {
    id: string;
    value: string;
    channelId: string;
    onChange: (e: React.ChangeEvent<TextboxElement>) => void;
    createMessage: string;
    characterLimit: number;
    preview: boolean;
    togglePreview: () => void;
    textboxRef?: React.RefObject<TextboxClass>;
    useChannelMentions?: boolean;
    descriptionMessageId: string;
    descriptionMessageDefault: string;
    descriptionMessageValues?: Record<string, React.ReactNode>;
};

const SettingsTextbox = ({
    id,
    value,
    channelId,
    onChange,
    createMessage,
    characterLimit,
    preview,
    togglePreview,
    textboxRef,
    useChannelMentions = false,
    descriptionMessageId,
    descriptionMessageDefault,
    descriptionMessageValues,
}: SettingsTextboxProps) => {
    return (
        <div className='textarea-wrapper'>
            <Textbox
                value={value}
                onChange={onChange}
                onKeyPress={() => {
                    // No specific key press handling needed for the settings modal
                }}
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
            <p
                data-testid='mm-modal-generic-section-item__description'
                className='mm-modal-generic-section-item__description'
            >
                <FormattedMessage
                    id={descriptionMessageId}
                    defaultMessage={descriptionMessageDefault}
                    values={descriptionMessageValues}
                />
            </p>
        </div>
    );
};

export default SettingsTextbox;
