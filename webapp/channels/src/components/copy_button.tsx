// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Placement} from '@floating-ui/react';
import classNames from 'classnames';
import React, {useRef, useState} from 'react';
import {useIntl} from 'react-intl';

import useTooltip from 'components/common/hooks/useTooltip';

import {copyToClipboard} from 'utils/utils';

type Props = {
    content: string;
    beforeCopyText?: string;
    afterCopyText?: string;
    placement?: Placement;
    className?: string;
};

const CopyButton: React.FC<Props> = (props: Props) => {
    const [isCopied, setIsCopied] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const intl = useIntl();

    const getDefaultMessage = () => {
        if (isCopied) {
            return props.afterCopyText;
        }
        return props.beforeCopyText ?? 'Copy code';
    };

    const getId = () => {
        if (isCopied) {
            return 'copied.message';
        }
        return props.beforeCopyText ? 'copy.text.message' : 'copy.code.message';
    };

    const {
        setReference,
        getReferenceProps,
        tooltip,
    } = useTooltip({
        message: intl.formatMessage({
                    id: getId(),
                    defaultMessage: getDefaultMessage(),
                 }),
        placement: props.placement,
    });

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

    const spanClassName = classNames('post-code__clipboard', props.className);

    return (
        <>
            <span
                {...getReferenceProps({
                    className: spanClassName,
                    onClick: copyText,
                })}
                ref={setReference}
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
            {tooltip}
        </>
    );
};

CopyButton.defaultProps = {
    afterCopyText: 'Copied',
    placement: 'top',
};

export default CopyButton;
