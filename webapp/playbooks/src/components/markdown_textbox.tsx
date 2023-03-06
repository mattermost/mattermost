// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {
    ChangeEvent,
    ComponentProps,
    MouseEvent,
    useRef,
    useState,
} from 'react';
import {useIntl} from 'react-intl';

import {useSelector} from 'react-redux';

import classNames from 'classnames';
import styled from 'styled-components';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

import {useEffectOnce} from 'react-use';

import {Textbox} from 'src/webapp_globals';

const DEFAULT_CHAR_LIMIT = 4000;

type Props = {
    value: string;
    setValue: (val: string) => void;
    placeholder?: string;
    id: string;
    className?: string;
    disabled?: boolean;
    previewDisabled?: boolean;
    hideHelpText?: boolean;
    hideHelpBar?: boolean;
    previewByDefault?: boolean;
    autoFocus?: boolean;
} & ComponentProps<typeof Textbox>;

const MarkdownTextbox = ({
    value,
    setValue,
    className,
    placeholder = '',
    disabled,
    previewDisabled,
    hideHelpText,
    previewByDefault,
    autoFocus,
    hideHelpBar,
    ...textboxProps
}: Props) => {
    const [showPreview, setShowPreview] = useState(previewByDefault);
    const {MaxPostSize} = useSelector(getConfig);
    const textboxRef = useRef<{focus:() => void}>(null);

    const charLimit = parseInt(MaxPostSize || '', 10) || DEFAULT_CHAR_LIMIT;

    useEffectOnce(() => {
        if (autoFocus && textboxRef.current) {
            textboxRef.current?.focus();
        }
    });

    return (
        <Wrapper className={className}>
            <Textbox
                tabIndex={0}
                value={value}
                emojiEnabled={true}
                supportsCommands={false}
                suggestionListPosition='bottom'
                preview={showPreview}
                useChannelMentions={false}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setValue(e.target.value)}
                characterLimit={charLimit}
                ref={textboxRef}
                createMessage={placeholder}
                onKeyPress={() => true}
                openWhenEmpty={true}
                channelId={''}
                disabled={disabled}
                {...textboxProps}
            />
            {!hideHelpBar && (
                <StyledTextboxLinks
                    disabled={disabled}
                    previewDisabled={previewDisabled}
                    characterLimit={charLimit}
                    showPreview={showPreview}
                    updatePreview={setShowPreview}
                    message={value}
                    hideHelpText={hideHelpText}
                />)}
        </Wrapper>
    );
};

const Wrapper = styled.div`
    .textarea-wrapper {
        margin-bottom: 6px;
    }

    && {
        .custom-textarea.custom-textarea {
            background-color: var(--center-channel-bg);;

            &.textbox-preview-area {
                background-color: rgba(var(--center-channel-color-rgb), 0.04);
            }

            height: unset;
            min-height: 104px;
            max-height: 324px;
            overflow: auto;
            padding: 12px 30px 12px 16px;

            transition: box-shadow ease-in-out .15s;
            box-shadow: 0 0 0 1px rgba(var(--center-channel-color-rgb), 0.16);

            border: medium none;

            &:focus:not(.textbox-preview-area) {
                box-shadow: 0 0 0 2px var(--button-bg);
            }

            &:disabled {
                background: rgba(var(--center-channel-bg-rgb), 0.16);
            }
        }
    }
`;

type TextboxLinksProps = {
    showPreview?: boolean;
    characterLimit: number;
    updatePreview: (showPreview: boolean) => void;
    message: string;
    disabled?: boolean;
    previewDisabled?: boolean;
    className?: string;
    hideHelpText?: boolean;
};

function TextboxLinks({
    message = '',
    characterLimit,
    showPreview,
    className,
    updatePreview,
    disabled,
    previewDisabled,
    hideHelpText,
}: TextboxLinksProps) {
    const togglePreview = (e: MouseEvent) => {
        e.preventDefault();
        updatePreview(!showPreview);
    };

    const hasText = message?.length > 0;

    const {formatMessage} = useIntl();

    if (disabled) {
        return null;
    }

    return (
        <div
            className={classNames(className, {
                hidden: message?.length > characterLimit,
            })}
        >
            <div
                style={{visibility: hasText ? 'visible' : 'hidden', opacity: hasText ? '' : '0'}}
                className={'help__format-text'}
            >
                {!hideHelpText &&
                <HelpText>
                    {/* eslint-disable formatjs/no-literal-string-in-jsx */}
                    <b>{'**'}{formatMessage({defaultMessage: 'bold'})}{'**'}</b>
                    <i>{'*'}{formatMessage({defaultMessage: 'italic'})}{'*'}</i>
                    <span>{'~~'}<s>{formatMessage({defaultMessage: 'strike'})}</s>{'~~ '}</span>
                    <span>{'`'}{formatMessage({defaultMessage: 'inline code'})}{'`'}</span>
                    <span>{'```'}{formatMessage({defaultMessage: 'preformatted'})}{'```'}</span>
                    <span>{'>'}{formatMessage({defaultMessage: 'quote'})}</span>
                    {/* eslint-enable formatjs/no-literal-string-in-jsx */}
                </HelpText>
                }
            </div>
            <NoWrap>
                {!previewDisabled && (
                    <button
                        onClick={togglePreview}
                        className='style--none textbox-preview-link color--link'
                    >
                        {showPreview ? formatMessage({defaultMessage: 'Edit'}) : formatMessage({defaultMessage: 'Preview'})}
                    </button>
                )}
            </NoWrap>
        </div>
    );
}

const StyledTextboxLinks = styled(TextboxLinks)`
    display: inline-flex;
    align-items: baseline;
    justify-content: space-between;
    width: 100%;

    a,
    button {
        margin-left: 10px;
        font-size: 1em;
        line-height: 18px;
    }

    .help__format-text {
        transition: opacity, 0.3s, ease-in, 0.3s;
        font-size: 0.85em;
        vertical-align: bottom;
        white-space: nowrap;
        opacity: 1;

        .modal & {
            white-space: normal;
        }
    }
`;

const HelpText = styled.span`
    opacity: 0.45;

    && {
        position: unset;
        top: unset;
        margin: unset;
    }

    b,
    i,
    span {
        position: relative;
        top: -1px;
        margin: 0 2px;
    }

    b {
        opacity: 0.9;
    }

    code {
        padding: 0;
        background: transparent;
    }
`;

const NoWrap = styled.div`
    white-space: nowrap;
`;

export default MarkdownTextbox;
