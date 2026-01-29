// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {forwardRef, useEffect, useImperativeHandle, useRef, useState} from 'react';

import type {FormattingAction} from './formatting_actions';

import './slash_command_menu.scss';

export interface SlashCommandMenuProps {
    items: FormattingAction[];
    command: (item: FormattingAction) => void;
}

export interface SlashCommandMenuRef {
    onKeyDown: (event: KeyboardEvent) => boolean;
}

const SlashCommandMenu = forwardRef<SlashCommandMenuRef, SlashCommandMenuProps>((props, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const selectedItemRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        setSelectedIndex(0);
    }, [props.items]);

    useEffect(() => {
        if (selectedItemRef.current) {
            selectedItemRef.current.scrollIntoView({
                block: 'nearest',
                behavior: 'smooth',
            });
        }
    }, [selectedIndex]);

    const selectItem = (index: number) => {
        const item = props.items[index];
        if (item) {
            props.command(item);
        }
    };

    const upHandler = () => {
        setSelectedIndex(((selectedIndex + props.items.length) - 1) % props.items.length);
    };

    const downHandler = () => {
        setSelectedIndex((selectedIndex + 1) % props.items.length);
    };

    const enterHandler = () => {
        selectItem(selectedIndex);
    };

    useImperativeHandle(ref, () => ({
        onKeyDown: (event: KeyboardEvent) => {
            if (event.key === 'ArrowUp') {
                upHandler();
                return true;
            }

            if (event.key === 'ArrowDown') {
                downHandler();
                return true;
            }

            if (event.key === 'Enter') {
                enterHandler();
                return true;
            }

            return false;
        },
    }));

    if (props.items.length === 0) {
        return (
            <div className='slash-command-menu'>
                <div className='slash-command-empty'>
                    {'No results found'}
                </div>
            </div>
        );
    }

    return (
        <div className='slash-command-menu'>
            {props.items.map((item, index) => (
                <button
                    key={item.id}
                    ref={index === selectedIndex ? selectedItemRef : null}
                    className={`slash-command-item ${index === selectedIndex ? 'selected' : ''}`}
                    onClick={() => selectItem(index)}
                    type='button'
                >
                    <i className={`icon ${item.icon} slash-command-icon`}/>
                    <div className='slash-command-content'>
                        <div className='slash-command-title'>{item.title}</div>
                    </div>
                </button>
            ))}
        </div>
    );
});

SlashCommandMenu.displayName = 'SlashCommandMenu';

export default SlashCommandMenu;
