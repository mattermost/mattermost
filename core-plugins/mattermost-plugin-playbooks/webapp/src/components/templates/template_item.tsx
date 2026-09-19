// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
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
    position: absolute;
    top: 0;
    display: grid;
    width: 100%;
    height: 50%;
    border-radius: 8px 8px 0 0;
    background: rgba(var(--button-bg-rgb), 0.32);
    color: rgba(var(--button-color-rgb), 1);
    place-items: center;
`;

const FakeBtn = styled.span`
    padding: 12px 20px;
    border-radius: 4px;
    background: rgba(var(--button-bg-rgb), 1);
    box-shadow: 0 2px 3px rgba(0 0 0 / 0.08);
    font-size: 14px;
    font-weight: 600;
    line-height: 14px;
`;

const Item = styled.div`
    position: relative;
    max-width: 360px;
    height: 100%;
    box-sizing: border-box;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 8px;
    background: var(--center-channel-bg);
    box-shadow: 0 2px 3px rgba(0 0 0 / 0.08);
    cursor: pointer;

    &:not(:hover, :focus) {
        ${HoverPanel} {
            display: none;
        }
    }
`;

type ThumbnailProps = {$color?: string;}
const Thumbnail = styled.div<ThumbnailProps>`
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12.5% 0;
    background: ${({$color}) => $color};
    height: 50%;
    border-radius: 8px 8px 0 0;
`;

type LabelProps = {$color?: string;}
const Label = styled.label<LabelProps>`
    position: absolute;
    top: 9px;
    left: 9px;
    padding: 0 4px;
    border-radius: 4px;
    background: ${({$color}) => $color?.split('-')[0]};
    color: ${({$color}) => $color?.split('-')[1]};
    font-size: 10px;
    font-weight: 600;
    line-height: 16px;
    text-transform: uppercase;
`;

const Author = styled.div`
    position: absolute;
    bottom: 15px;
    left: 20px;
`;

const Description = styled.p`
    color: rgba(var(--center-channel-color-rgb), 0.64);
    font-size: 14px;
    line-height: 20px;
`;

const Detail = styled.div`
    height: auto;
    padding: 20px 20px 60px;
`;

const Title = styled.h5`
    margin: 0;
    margin-bottom: 2px;
    color: var(--center-channel-color);
    font-family: Metropolis;
    font-size: 16px;
    font-weight: 600;
    line-height: 24px;
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
