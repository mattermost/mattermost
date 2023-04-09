// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

const QuickUse = styled.button`
    position: absolute;
    top: 7px;
    right: 7px;

    text-align: center;
    padding: 4px 10px;
    border: 0px;

    background: var(--denim-button-bg);
    border-radius: 4px;
    font-weight: 600;

    font-size: 11px;
    line-height: 16px;
    color: var(--button-color);
    visibility: hidden;
    opacity: 0;
    z-index: 2;

    transition: visibility 0.2s ease-in-out, opacity 0.2s ease-in-out;
`;

interface UseCaseProps {
    className?: string;
    name: string;
    illustration: string;
    channelsCount: number;
    boardsCount: number;
    playbooksCount: number;
    disableQuickUse: boolean;

    onQuickUse: () => void;
    onSelectTemplate: () => void;
}

const UseCase = (props: UseCaseProps) => {
    const {formatMessage, formatList} = useIntl();

    const details = useMemo(() => {
        const detailBuilder: string[] = [];
        if (props.channelsCount) {
            detailBuilder.push(formatMessage({
                id: 'work_templates.menu.usecase_channels_count',
                defaultMessage: '{channelsCount, plural, =1 {# channel} other {# channels}}',
            }, {channelsCount: props.channelsCount}));
        }

        if (props.boardsCount) {
            detailBuilder.push(formatMessage({
                id: 'work_templates.menu.usecase_boards_count',
                defaultMessage: '{boardsCount, plural, =1 {# board} other {# boards}}',
            }, {boardsCount: props.boardsCount}));
        }

        if (props.playbooksCount) {
            detailBuilder.push(formatMessage({
                id: 'work_templates.menu.usecase_playbooks_count',
                defaultMessage: '{playbooksCount, plural, =1 {# playbook} other {# playbooks}}',
            }, {playbooksCount: props.playbooksCount}));
        }

        return formatList(detailBuilder, {style: 'narrow'});
    }, [props.channelsCount, props.boardsCount, props.playbooksCount]);

    const selectTemplate = (e: React.MouseEvent<HTMLElement>) => {
        e.stopPropagation();

        props.onSelectTemplate();
    };

    const quickUse = (e: React.MouseEvent<HTMLElement>) => {
        e.stopPropagation();

        props.onQuickUse();
    };

    return (
        <div
            className={props.className}
            onClick={selectTemplate}
        >
            <div className='illustration'>
                <QuickUse
                    onClick={quickUse}
                    disabled={props.disableQuickUse}
                >{formatMessage({id: 'work_templates.menu.quick_use', defaultMessage: 'Quick use'})}</QuickUse>
                <img src={props.illustration}/>
            </div>
            <div className='name'>
                {props.name}
                <p className='details'>
                    {details}
                </p>
            </div>
        </div>
    );
};

const StyledUseCaseMenuItem = styled(UseCase)`
    display: flex;
    flex-direction: column;
    width: 220px;
    border: 1px solid rgba(var(--center-channel-text-rgb), 0.16);
    border-radius: 8px;
    cursor: pointer;
    margin-bottom: 16px;
    margin-right: 10px;

    .illustration {
        height: 130px;
        background: rgba(73, 146, 243, 0.2);
        border-radius: 8px 8px 0px 0px;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        position: relative;
        flex-grow: 1;
        overflow-x: hidden;
        overflow-y: hidden;
        transition: height 0.2s ease-in-out;

        img {
            width: 204px;
            height: 123px;
            z-index: 1;
            transition: margin 0.2s ease-in-out;
        }
    }

    .name {
        padding: 14px 12px;
        width: 220px;
        height: 44px;
        font-family: 'Open Sans';
        line-height: 16px;
        font-weight: 600;
        font-size: 12px;
        line-height: 16px;
        color: var(--center-channel-color);
        transition: height 0.2s ease-in-out;
        flex-grow: 2;

        .details {
            visibility: hidden;
            margin-bottom: 12px;
            opacity: 0;
            font-weight: 400;
            font-size: 11px;
            line-height: 16px;
            letter-spacing: 0.02em;
            color: rgba(var(--center-channel-text-rgb), 0.72);
            transition: visibility 0.2s ease-in-out, opacity 0.2s ease-in-out;
        }
    }

    &:hover {
        box-shadow: var(--elevation-2);
        ${QuickUse} {
            visibility: visible;
            opacity: 1;
        }

        img {
            margin-bottom: -12px;
        }

        .name {
            height: 56px;
            padding: 12px 12px 0;
            .details {
                visibility: visible;
                opacity: 1;
            }
        }

        .illustration {
            height: 118px;
        }

    }
`;

export default StyledUseCaseMenuItem;

