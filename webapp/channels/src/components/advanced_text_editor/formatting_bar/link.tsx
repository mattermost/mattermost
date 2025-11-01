// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import styled from 'styled-components';

import {getTheme} from 'mattermost-redux/selectors/entities/preferences';

import CompassDesignProvider from 'components/compass_design_provider';
import * as Menu from 'components/menu';

import Constants from 'utils/constants';
import * as Keyboard from 'utils/keyboard';

import FormattingIcon from './formatting_icon';

import {Footer, Header} from '../../post_priority/post_priority_picker_item';

import './link.scss';

export const LinkModal = styled.div`
    width: 324px;
    padding: 10px 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;`;

export const LinkModalRow = styled.div`
    display: flex;
    gap: 8px;
    align-items: center;`;

type Props = {
    onApply: (props: { text: string; link: string }) => void;
    onToggle: (isOpen: boolean) => void;
    isMenuOpen: boolean;
    selectionText: string;
}

function Link({
    onApply,
    onToggle,
    isMenuOpen,
    selectionText,
}: Props) {
    const {formatMessage} = useIntl();
    const [text, setText] = useState('');
    const [link, setLink] = useState('https://');

    const theme = useSelector(getTheme);
    const tooltipText = formatMessage({id: 'accessibility.button.link', defaultMessage: 'link'});

    useEffect(() => {
        if (isMenuOpen) {
            setText(selectionText);
            setLink('https://');
        }
    }, [isMenuOpen, selectionText]);

    const handleClose = useCallback(() => {
        onToggle(false);
    }, [onToggle]);

    const handleApply = useCallback(() => {
        onApply({
            text, link,
        });
        handleClose();
    }, [onApply, handleClose, text, link]);

    const handleFooterButtonAction = useCallback((e: React.KeyboardEvent<HTMLButtonElement>, actionFn: () => void) => {
        if (Keyboard.isKeyPressed(e, Constants.KeyCodes.ENTER)) {
            e.preventDefault();
            actionFn();
        }
    }, []);

    const footer = useMemo(() =>
        (<div>
            <Footer key='footer'>
                <button
                    type='submit'
                    className='LinkModal__cancel'
                    onClick={handleClose}
                    onKeyDown={(e) => handleFooterButtonAction(e, handleClose)}
                >
                    <FormattedMessage
                        id='post_priority.picker.cancel'
                        defaultMessage='Cancel'
                    />
                </button>
                <button
                    type='submit'
                    className='LinkModal__apply'
                    onClick={handleApply}
                    onKeyDown={(e) => handleFooterButtonAction(e, handleApply)}
                >
                    <FormattedMessage
                        id='post_priority.picker.apply'
                        defaultMessage='Apply'
                    />
                </button>
            </Footer>
        </div>), [handleApply, handleClose, handleFooterButtonAction]);

    return (<CompassDesignProvider theme={theme}>
        <Menu.Container
            menuButton={{
                id: 'messagePriority',
                as: 'div',
                children: (
                    <FormattingIcon
                        mode='link'
                        className='control'
                        disabled={false}
                    />
                ),
            }}
            menu={{
                id: 'post.priority.dropdown',
                width: 'max-content',
                onToggle,
                isMenuOpen,
            }}
            menuButtonTooltip={{
                text: tooltipText,
            }}

            menuHeader={
                <div>
                    <Header className='modal-title'>
                        {formatMessage({
                            id: 'link.modal.header',
                            defaultMessage: 'Add link',
                        })}
                    </Header>
                    <Menu.Separator/>
                </div>
            }
            anchorOrigin={{
                vertical: 'top',
                horizontal: 'left',
            }}
            transformOrigin={{
                vertical: 'bottom',
                horizontal: 'left',
            }}

            menuFooter={footer}
            closeMenuOnTab={false}
        >
            <LinkModal>
                <LinkModalRow>
                    {/* eslint-disable-next-line react/jsx-no-literals */}
                    <label htmlFor='text-input-id'>Text</label>
                    <input
                        id='text-input-id'
                        value={text}
                        onChange={(e) => {
                            setText(e.currentTarget.value);
                        }}
                    />
                </LinkModalRow>
                <LinkModalRow>
                    {/* eslint-disable-next-line react/jsx-no-literals */}
                    <label htmlFor='link-input-id'>Link</label>
                    <input
                        id='link-input-id'
                        value={link}
                        onChange={(e) => {
                            setLink(e.currentTarget.value);
                        }}
                    />
                </LinkModalRow>
            </LinkModal>
            <div/>
        </Menu.Container>
    </CompassDesignProvider>);
}

export default Link;
