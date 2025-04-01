// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ReactNode} from 'react';
import React from 'react';
import styled, {css} from 'styled-components';

export const SectionHeading = styled.h3`
    &&& {
        margin-bottom: 8px;
    }
`;

export const SectionHeader = styled.header.attrs({className: 'header'})<{$borderless?: boolean}>`
    &&& {
        padding: 24px 32px;
        ${({$borderless}) => !$borderless && css`
            border-bottom: 1px solid var(--center-channel-color-12, rgba(63, 67, 80, 0.12));
        `}
    }
`;

export const SectionContent = styled.div.attrs({className: 'content'})<{$compact?: boolean}>`
    &&& {
        padding: ${({$compact}) => ($compact ? '24px 32px' : '48px 32px')};
        border-bottom: 1px solid var(--center-channel-color-12, rgba(63, 67, 80, 0.12));
    }
`;

export const AdminSection = styled.section.attrs({className: 'AdminPanel'})`
    && {
        overflow: visible;
    }
`;

export const AdminWrapper = (props: {children: ReactNode}) => {
    return (
        <div className='admin-console__wrapper'>
            <div className='admin-console__content'>
                {props.children}
            </div>
        </div>
    );
};

export const BorderlessInput = styled.input.attrs({className: 'Input form-control'})<{$deleted?: boolean; $strong?: boolean}>`
    && {
        height: 40px;
        border-color: transparent;
        border-top: 0;
        background: none;
        box-shadow: none;
        &:hover,
        &:focus {
            border-color: transparent;
            box-shadow: none;
        }

        &:hover {
            background: rgba(var(--center-channel-color-rgb), 0.04)
        }
        &:focus {
            background: rgba(var(--button-bg-rgb), 0.08);
        }
    }

    ${({$deleted}) => $deleted && css`
        && {
            color: #D24B4E;
            text-decoration: line-through;
        }
    `};

    ${({$strong}) => $strong && css`
        && {
            font-size: 14px;
            font-style: normal;
            font-weight: 600;
        }
    `};
`;

export const DangerText = styled.span`
    color: #D24B4E;
`;

export const FieldDeleteButton = styled.button.attrs({className: 'btn btn-sm btn-transparent'})`
    font-weight: normal;
`;

export const LinkButton = styled.button.attrs({className: 'btn btn-link'})`
    font-weight: normal;
    padding: 8px 16px !important;
    font-size: 12px;
    font-style: normal;
    font-weight: 600;
    line-height: 16px;
    gap: 6px;
`;
