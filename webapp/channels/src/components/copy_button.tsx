// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState} from 'react';
import {Tooltip} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import OverlayTrigger from 'components/overlay_trigger';

import Constants from 'utils/constants';
import {t} from 'utils/i18n';
import {copyToClipboard} from 'utils/utils';

type Props = {
    content: string;
    beforeCopyText?: string;
    afterCopyText?: string;
    placement?: string;
    className?: string;
};

const CopyButton: React.FC<Props> = (props: Props) => {
    const [isCopied, setIsCopied] = useState(false);

    const copyText = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>): void => {
        e.preventDefault();
        setIsCopied(true);

        setTimeout(() => {
            setIsCopied(false);
        }, 2000);

        copyToClipboard(props.content);
    };

    const getId = () => {
        if (isCopied) {
            return t('copied.message');
        }
        return props.beforeCopyText ? t('copy.text.message') : t('copy.code.message');
    };

    const getDefaultMessage = () => {
        if (isCopied) {
            return props.afterCopyText;
        }
        return props.beforeCopyText ?? 'Copy code';
    };

    const tooltip = (
        <Tooltip id='copyButton'>
            <FormattedMessage
                id={getId()}
                defaultMessage={getDefaultMessage()}
            />
        </Tooltip>
    );

    const spanClassName = classNames('post-code__clipboard', props.className);

    return (
        <OverlayTrigger
            shouldUpdatePosition={true}
            delayShow={Constants.OVERLAY_TIME_DELAY}
            placement={props.placement}
            overlay={tooltip}
        >
            <span
                className={spanClassName}
                onClick={copyText}
            >
                {!isCopied &&
                    <i
                        role='button'
                        className='icon icon-content-copy'
                    />
                }
                {isCopied &&
                    <i
                        role='button'
                        className='icon icon-check'
                    />
                }
            </span>
        </OverlayTrigger>
    );
};

CopyButton.defaultProps = {
    afterCopyText: 'Copied',
    placement: 'top',
};

export default CopyButton;
