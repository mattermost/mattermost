// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {HTMLAttributes, useState} from 'react';
import styled, {css} from 'styled-components';
import {useIntl} from 'react-intl';

import {copyToClipboard} from 'src/utils';

import {OVERLAY_DELAY} from 'src/constants';
import Tooltip from 'src/components/widgets/tooltip';

type Props = {
    id: string;
    to: string;
} & ({
    name: string;
    tooltipMessage?: never
} | {
    name?: never;
    tooltipMessage: string;
});

type Attrs = HTMLAttributes<HTMLElement>;

const CopyLink = ({
    id,
    to,
    name,
    tooltipMessage,
    ...attrs
}: Props & Attrs) => {
    const {formatMessage} = useIntl();
    const [wasCopied, setWasCopied] = useState(false);

    const copyLink = (e: React.MouseEvent) => {
        e.stopPropagation();
        copyToClipboard(to);
        setWasCopied(true);
    };

    return (
        <Tooltip
            id={id}
            placement='bottom'
            delay={OVERLAY_DELAY}
            onExited={() => setWasCopied(false)}
            shouldUpdatePosition={true}
            content={wasCopied ? formatMessage({defaultMessage: 'Copied!'}) : (tooltipMessage ?? formatMessage({defaultMessage: "Copy link to ''{name}''"}, {name}))}
        >
            <AutoSizeCopyIcon
                onClick={copyLink}
                clicked={wasCopied}
                {...attrs}
                className={'icon-link-variant ' + attrs.className}
            />
        </Tooltip>
    );
};

const CopyIcon = styled.button<{clicked: boolean}>`
    display: inline-block;

    border-radius: 4px;
    padding: 0;
    width: 1.25em;
    height: 1.25em;

    :before {
        margin: 0;
        vertical-align: baseline;
    }

    border: none;
    background: transparent;
    color: rgba(var(--center-channel-color-rgb), 0.56);


    ${({clicked}) => !clicked && css`
        &:hover {
            background: var(--center-channel-color-08);
            color: var(--center-channel-color-72);
        }
    `}

    ${({clicked}) => clicked && css`
        background: var(--button-bg-08);
        color: var(--button-bg);
    `}
`;

const AutoSizeCopyIcon = styled(CopyIcon)`
    font-size: inherit;
`;

export default styled(CopyLink)``;
