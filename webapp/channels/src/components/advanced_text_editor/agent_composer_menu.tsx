// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback, useContext, useState, type ReactNode, type Ref} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {CheckIcon, EmoticonHappyOutlineIcon, FireIcon, FormatLetterCaseIcon, PaperclipIcon, PlusIcon} from '@mattermost/compass-icons/components';
import {Icon} from '@mattermost/compass-ui/components/icon';

import {closeModal} from 'actions/views/modals';

import * as Menu from 'components/menu';
import type {FirstMenuItemProps} from 'components/menu';
import {MenuContext} from 'components/menu/menu_context';

import AIActionsMenu from './ai_actions_menu';
import {COMPOSER_PLUS_MENU_ID, ComposerSubmenuHoverProvider, useComposerSubmenuHover} from './composer_submenu_hover';

const AgentComposerMenuTrigger = Menu.createMenuIconButtonTrigger({
    size: 'small',
    className: 'agent-composer-menu-button',
});

type Props = {
    canAttach: boolean;
    attachDisabled: boolean;
    onAttach: () => void;
    enableEmojiPicker: boolean;
    emojiDisabled: boolean;
    onEmoji: () => void;
    showAttributes: boolean;
    formattingOpen: boolean;
    formattingDisabled: boolean;
    onToggleFormatting: () => void;
    emojiAnchorRef?: Ref<HTMLSpanElement>;
    priorityItem?: ReactNode;
    burnOnRead?: {
        on: boolean;
        disabled: boolean;
        onToggle: () => void;
    } | null;
    aiActions?: Omit<React.ComponentProps<typeof AIActionsMenu>, 'embedded' | 'parentOpen'> | null;
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

const burnOnReadLabel = (
    <FormattedMessage
        id='burn_on_read.button.tooltip.title'
        defaultMessage='Burn-on-read'
    />
);

const showFormattingLabel = (
    <FormattedMessage
        id='textbox.agent_menu.show_formatting'
        defaultMessage='Show formatting'
        description='Menu item in the composer + menu that opens the formatting bar.'
    />
);

const hideFormattingLabel = (
    <FormattedMessage
        id='textbox.agent_menu.hide_formatting'
        defaultMessage='Hide formatting'
        description='Menu item in the composer + menu that closes the formatting bar.'
    />
);

const attributesLabel = (
    <FormattedMessage
        id='post_attributes.composer.add'
        defaultMessage='Add attributes'
        description='Tooltip and accessible label of the button in the message composer formatting bar that opens the modal for adding attributes to the message being written. Plural noun after a verb.'
    />
);

// compass-icons has no tag glyph. This is the same 24px outline the other
// items use, so Add attributes lines up with Attach, Emoji, and formatting.
const TagOutlineIcon = ({size, color}: {size?: number | string; color?: string}) => (
    <svg
        xmlns='http://www.w3.org/2000/svg'
        width={size || '1em'}
        height={size || '1em'}
        fill={color || 'currentColor'}
        viewBox='0 0 24 24'
        aria-hidden={true}
    >
        <path d='M21.41 11.58L12.41 2.58A2 2 0 0 0 11 2H4A2 2 0 0 0 2 4V11A2 2 0 0 0 2.59 12.42L11.59 21.42A2 2 0 0 0 13 22A2 2 0 0 0 14.41 21.41L21.41 14.41A2 2 0 0 0 22 13A2 2 0 0 0 21.41 11.58M13 20L4 11V4H11L20 13M6.5 5A1.5 1.5 0 1 1 5 6.5A1.5 1.5 0 0 1 6.5 5Z'/>
    </svg>
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
            dispatch(closeModal(COMPOSER_PLUS_MENU_ID));
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
 * The one + on the host composer. It sits on the left. Attach, emoji,
 * attributes, priority, burn-on-read, skills, rewrite, and formatting are
 * items in this menu.
 */
const AgentComposerMenu = (props: Props) => {
    return (
        <ComposerSubmenuHoverProvider>
            <AgentComposerMenuContents {...props}/>
        </ComposerSubmenuHoverProvider>
    );
};

const AgentComposerMenuContents = ({
    canAttach,
    attachDisabled,
    onAttach,
    enableEmojiPicker,
    emojiDisabled,
    onEmoji,
    showAttributes,
    formattingOpen,
    formattingDisabled,
    onToggleFormatting,
    emojiAnchorRef,
    priorityItem,
    burnOnRead,
    aiActions,
}: Props) => {
    const {formatMessage} = useIntl();
    const {claimRow} = useComposerSubmenuHover();
    const [menuOpen, setMenuOpen] = useState(false);
    const label = formatMessage({
        id: 'textbox.agent_menu',
        defaultMessage: 'Message options',
        description: 'Accessible name of the + button on the composer. Opens a menu of attach, emoji, attributes, priority, burn-on-read, skills, rewrite, and formatting.',
    });
    const claim = useCallback((id: string) => () => {
        claimRow(id);
    }, [claimRow]);
    const handleToggle = useCallback((open: boolean) => {
        setMenuOpen(open);
        if (!open) {
            claimRow(null);
        }
    }, [claimRow]);

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
                    id: COMPOSER_PLUS_MENU_ID,
                    'aria-label': label,
                    onToggle: handleToggle,
                    compass: true,
                }}
                anchorOrigin={{vertical: 'top', horizontal: 'left'}}
                transformOrigin={{vertical: 'bottom', horizontal: 'left'}}
            >
                {canAttach && (
                    <AttachFilesItem
                        disabled={attachDisabled}
                        onAttach={onAttach}
                        onMouseEnter={claim('attach')}
                    />
                )}
                {enableEmojiPicker && (
                    <Menu.Item
                        labels={emojiLabel}
                        leadingElement={<EmoticonHappyOutlineIcon size={18}/>}
                        onClick={onEmoji}
                        onMouseEnter={claim('emoji')}
                        disabled={emojiDisabled}
                    />
                )}
                {showAttributes && (
                    <Menu.Item
                        labels={attributesLabel}
                        leadingElement={<TagOutlineIcon size={18}/>}
                        onMouseEnter={claim('attributes')}
                        disabled={true}
                    />
                )}
                {priorityItem}
                {burnOnRead && (
                    <Menu.Item
                        labels={burnOnReadLabel}
                        leadingElement={<FireIcon size={18}/>}
                        trailingElements={burnOnRead.on ? <CheckIcon size={18}/> : undefined}
                        disabled={burnOnRead.disabled}
                        onClick={burnOnRead.onToggle}
                        onMouseEnter={claim('burn-on-read')}
                    />
                )}
                {aiActions && (
                    <AIActionsMenu
                        {...aiActions}
                        embedded={true}
                        parentOpen={menuOpen}
                    />
                )}
                <Menu.Item
                    labels={formattingOpen ? hideFormattingLabel : showFormattingLabel}
                    leadingElement={<FormatLetterCaseIcon size={18}/>}
                    onClick={onToggleFormatting}
                    onMouseEnter={claim('formatting')}
                    disabled={formattingDisabled}
                />
            </Menu.Container>
        </span>
    );
};

export default memo(AgentComposerMenu);
