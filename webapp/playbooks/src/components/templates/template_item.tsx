// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {HTMLAttributes} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import styled from 'styled-components';

import {KeyCodes, isKeyPressed} from 'src/utils';

import Tooltip from 'src/components/widgets/tooltip';

interface Props {
    label?: string;
    title: string;
    description: string;
    icon: React.ReactNode;
    color?: string;
    labelColor?: string;
    author?: React.ReactNode;
    onSelect: () => void;
}

const HoverPanel = styled.div`
    background: rgba(var(--button-bg-rgb), 0.32);
    color: rgba(var(--button-color-rgb), 1);
    position: absolute;
    top: 0;
    width: 100%;
    height: 50%;
    display: grid;
    place-items: center;
    border-radius: 8px 8px 0 0;
`;

const FakeBtn = styled.span`
    background: rgba(var(--button-bg-rgb), 1);
    box-shadow: 0px 2px 3px rgba(0, 0, 0, 0.08);
    border-radius: 4px;
    padding: 12px 20px;
    font-weight: 600;
    font-size: 14px;
    line-height: 14px;
`;

const Item = styled.div`
    position: relative;
    cursor: pointer;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    background: var(--center-channel-bg);
    border-radius: 8px;
    box-sizing: border-box;
    box-shadow: 0 2px 3px rgba(0, 0, 0, 0.08);
    max-width: 360px;
    height: 100%;
    &:not(:hover):not(:focus) {
        ${HoverPanel} {
            display: none;
        }
    }
`;

type ThumbnailProps = {$color?: string;}
const Thumbnail = styled.div<ThumbnailProps>`
    display: grid;
    place-items: center;
    padding: 15% 0;
    background: ${({$color}) => $color};
    height: 50%;
    border-radius: 8px 8px 0 0;
`;

type LabelProps = {$color?: string;}
const Label = styled.label<LabelProps>`
    font-weight: 600;
    font-size: 10px;
    line-height: 16px;
    position: absolute;
    top: 9px;
    left: 9px;
    text-transform: uppercase;
    background: ${({$color}) => $color?.split('-')[0]};
    padding: 0 4px;
    border-radius: 4px;
    color: ${({$color}) => $color?.split('-')[1]};
`;

const Author = styled.div`
    position: absolute;
    left: 20px;
    bottom: 15px;
`;

const Description = styled.p`
    font-size: 14px;
    line-height: 20px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
`;

const Detail = styled.div`
    padding: 20px 20px 60px;
    height: auto;
`;

const Title = styled.h5`
    font-family: Metropolis;
    font-weight: 600;
    font-size: 16px;
    line-height: 24px;
    color: var(--center-channel-color);
    margin: 0;
    margin-bottom: 2px;
`;

const TemplateItem = ({
    label,
    title,
    description,
    author,
    icon,
    color,
    labelColor,
    onSelect,
    ...attrs
}: Props & HTMLAttributes<HTMLDivElement>) => {
    const {formatMessage} = useIntl();
    return (
        <Item
            role='button'
            tabIndex={0}
            onClick={() => onSelect()}
            onKeyDown={(e) => {
                if (isKeyPressed(e.nativeEvent, KeyCodes.SPACE) || isKeyPressed(e.nativeEvent, KeyCodes.ENTER)) {
                    onSelect();
                }
            }}
            {...attrs}
        >
            <Thumbnail $color={color}>
                {label && <Label $color={labelColor}>{label}</Label>}
                {icon}
                <HoverPanel>
                    <FakeBtn>
                        <FormattedMessage defaultMessage='Create playbook'/>
                    </FakeBtn>
                </HoverPanel>
            </Thumbnail>
            <Detail>
                <Title>{title}</Title>
                <Description>{description}</Description>
                {author && (
                    <Tooltip
                        id={`${title}_author_usedby`}
                        content={formatMessage({defaultMessage: 'Used by'})}
                    >
                        <Author>{author}</Author>
                    </Tooltip>
                )}
            </Detail>
        </Item>
    );
};

export default TemplateItem;
