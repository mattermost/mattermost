// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useRef, useState} from 'react';
import {Tooltip} from 'react-bootstrap';
import {FormattedMessage, defineMessages, useIntl} from 'react-intl';

import OverlayTrigger from 'components/overlay_trigger';

import Constants from 'utils/constants';
import {copyToClipboard} from 'utils/utils';

type Props = {
    content: string;
    isForText?: boolean;
    placement?: string;
    className?: string;
};

const CopyButton: React.FC<Props> = (props: Props) => {
    const intl = useIntl();

    const [isCopied, setIsCopied] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const copyText = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>): void => {
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

    const tooltip = (
        <Tooltip id='copyButton'>
            <FormattedMessage {...tooltipMessage}/>
        </Tooltip>
    );

    const spanClassName = classNames('post-code__clipboard', props.className);

    return (
        <OverlayTrigger
            shouldUpdatePosition={true}
            delayShow={Constants.OVERLAY_TIME_DELAY}
            placement={props.placement ?? 'top'}
            overlay={tooltip}
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
        </OverlayTrigger>
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
