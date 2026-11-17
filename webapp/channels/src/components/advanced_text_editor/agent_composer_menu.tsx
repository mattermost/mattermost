// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useContext, type Ref} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {EmoticonHappyOutlineIcon, FormatLetterCaseIcon, PaperclipIcon, PlusIcon} from '@mattermost/compass-icons/components';
import {Icon} from '@mattermost/compass-ui/components/icon';

import {closeModal} from 'actions/views/modals';

import * as Menu from 'components/menu';
import type {FirstMenuItemProps} from 'components/menu';
import {MenuContext} from 'components/menu/menu_context';

const AGENT_COMPOSER_MENU_ID = 'agent-composer-menu';

const AgentComposerMenuTrigger = Menu.createMenuIconButtonTrigger({size: 'small'});

type Props = {
    canAttach: boolean;
    attachDisabled: boolean;
    onAttach: () => void;
    enableEmojiPicker: boolean;
    emojiDisabled: boolean;
    onEmoji: () => void;
    showAttributes: boolean;
    formattingDisabled: boolean;
    onToggleFormatting: () => void;
    emojiAnchorRef?: Ref<HTMLSpanElement>;
};

const attachLabel = (
    <FormattedMessage
        id='textbox.agent_menu.attach'
        defaultMessage='Attach files'
        description='Menu item in the agent composer that opens the file picker. Noun phrase.'
    />
);

const emojiLabel = (
    <FormattedMessage
        id='textbox.agent_menu.emoji'
        defaultMessage='Emoji'
        description='Menu item in the agent composer that opens the emoji picker.'
    />
);

const formattingLabel = (
    <FormattedMessage
        id='textbox.agent_menu.formatting'
        defaultMessage='Formatting'
        description='Menu item in the agent composer that shows the formatting bar for this message box only.'
    />
);

const attributesLabel = (
    <FormattedMessage
        id='post_attributes.composer.add'
        defaultMessage='Add attributes'
        description='Tooltip and accessible label of the button in the message composer formatting bar that opens the modal for adding attributes to the message being written. Plural noun after a verb.'
    />
);

type AttachFilesItemProps = FirstMenuItemProps & {
    disabled: boolean;
    onAttach: () => void;
};

/**
 * Opens the file dialog in this click. Other menu items run onClick after the
 * close animation, and Safari rejects a file dialog that is no longer part of
 * the original gesture. The menu still closes: here on desktop, and by
 * dismissing the modal on mobile, where the item stops the click from bubbling.
 */
const AttachFilesItem = ({disabled, onAttach, ...otherProps}: AttachFilesItemProps) => {
    const menu = useContext(MenuContext);
    const dispatch = useDispatch();

    const handleClick = () => {
        onAttach();
        if (menu.close) {
            menu.close();
        } else {
            dispatch(closeModal(AGENT_COMPOSER_MENU_ID));
        }
    };

    return (
        <Menu.Item
            {...otherProps}
            labels={attachLabel}
            leadingElement={<PaperclipIcon size={18}/>}
            onClick={handleClick}
            disabled={disabled}
            disableCloseOnSelect={true}
        />
    );
};

/**
 * The one + control on an agent composer. Attach, emoji, and formatting open
 * the controls the channel composer shows as their own buttons. Add attributes
 * stays disabled until messages can carry attributes.
 */
const AgentComposerMenu = ({
    canAttach,
    attachDisabled,
    onAttach,
    enableEmojiPicker,
    emojiDisabled,
    onEmoji,
    showAttributes,
    formattingDisabled,
    onToggleFormatting,
    emojiAnchorRef,
}: Props) => {
    const {formatMessage} = useIntl();
    const label = formatMessage({
        id: 'textbox.agent_menu',
        defaultMessage: 'Message options',
        description: 'Accessible name of the + button on the agent composer. Opens a menu of attach, emoji, attributes, and formatting.',
    });

    return (
        <span ref={emojiAnchorRef}>
            <Menu.Container
                menuButton={{
                    id: 'agentComposerMenuButton',
                    dataTestId: 'agent-composer-menu-button',
                    as: AgentComposerMenuTrigger,
                    'aria-label': label,
                    children: <Icon glyph={<PlusIcon/>}/>,
                }}
                menuButtonTooltip={{text: label}}
                menu={{
                    id: AGENT_COMPOSER_MENU_ID,
                    'aria-label': label,
                }}
                anchorOrigin={{vertical: 'top', horizontal: 'left'}}
                transformOrigin={{vertical: 'bottom', horizontal: 'left'}}
            >
                {canAttach && (
                    <AttachFilesItem
                        disabled={attachDisabled}
                        onAttach={onAttach}
                    />
                )}
                {enableEmojiPicker && (
                    <Menu.Item
                        labels={emojiLabel}
                        leadingElement={<EmoticonHappyOutlineIcon size={18}/>}
                        onClick={onEmoji}
                        disabled={emojiDisabled}
                    />
                )}
                {showAttributes && (
                    <Menu.Item
                        labels={attributesLabel}
                        disabled={true}
                    />
                )}
                <Menu.Item
                    labels={formattingLabel}
                    leadingElement={<FormatLetterCaseIcon size={18}/>}
                    onClick={onToggleFormatting}
                    disabled={formattingDisabled}
                />
            </Menu.Container>
        </span>
    );
};

export default memo(AgentComposerMenu);
