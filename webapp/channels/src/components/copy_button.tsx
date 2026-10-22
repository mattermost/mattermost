// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useRef, useState} from 'react';
import {FormattedMessage, defineMessages, useIntl} from 'react-intl';

import CheckIcon from '@mattermost/compass-icons/components/check';
import ContentCopyIcon from '@mattermost/compass-icons/components/content-copy';
import {Icon} from '@mattermost/compass-ui/components/icon';
import {IconButton} from '@mattermost/compass-ui/components/icon-button';
import type {IconButtonProps} from '@mattermost/compass-ui/components/icon-button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import {copyToClipboard} from 'utils/utils';

type Props = {
    content: string;
    isForText?: boolean;
    className?: string;

    // Render as a Compass IconButton instead of the inline code block control
    iconButtonProps?: Pick<IconButtonProps, 'size' | 'style' | 'padding'>;
};

const CopyButton: React.FC<Props> = (props: Props) => {
    const intl = useIntl();

    const [isCopied, setIsCopied] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const copyText = (e: React.MouseEvent<HTMLElement, MouseEvent>): void => {
        e.preventDefault();
        setIsCopied(true);

        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        timerRef.current = setTimeout(() => {
            setIsCopied(false);
        }, 2000);

        copyToClipboard(props.content);
    };

    let tooltipMessage;
    if (isCopied) {
        tooltipMessage = messages.copied;
    } else if (props.isForText) {
        tooltipMessage = messages.copyText;
    } else {
        tooltipMessage = messages.copyCode;
    }

    const tooltipText = (
        <FormattedMessage {...tooltipMessage}/>
    );

    if (props.iconButtonProps) {
        return (
            <WithTooltip
                title={tooltipText}
            >
                <IconButton
                    {...props.iconButtonProps}
                    className={props.className}
                    icon={<Icon glyph={isCopied ? <CheckIcon/> : <ContentCopyIcon/>}/>}
                    onClick={copyText}
                    aria-label={intl.formatMessage(tooltipMessage)}
                />
            </WithTooltip>
        );
    }

    const spanClassName = classNames('post-code__clipboard', props.className);

    return (
        <WithTooltip
            title={tooltipText}
        >
            <span
                className={spanClassName}
                onClick={copyText}
                aria-label={intl.formatMessage(tooltipMessage)}
                role='button'
            >
                {!isCopied &&
                    <i
                        className='icon icon-content-copy'
                    />
                }
                {isCopied &&
                    <i
                        className='icon icon-check'
                    />
                }
            </span>
        </WithTooltip>
    );
};

const messages = defineMessages({
    copied: {
        id: 'copied.message',
        defaultMessage: 'Copied',
    },
    copyCode: {
        id: 'copy.code.message',
        defaultMessage: 'Copy code',
    },
    copyText: {
        id: 'copy.text.message',
        defaultMessage: 'Copy text',
    },
});

export default CopyButton;
