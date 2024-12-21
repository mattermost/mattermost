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

export const ModalBody = styled.div`
    padding: 0 32px;
    display: flex;
    flex-direction: column;
    gap: 20px;
`;

export const AdminSection = styled.section.attrs({className: 'AdminPanel'})`
    && {
        overflow: visible;
    }
`;

export const PlaceholderHeading = styled.h4`
    && {
        font-size: 20px;
        font-weight: 600;
        line-height: 28px;
        margin-bottom: 4px;
    }
`;

export const PlaceholderParagraph = styled.p`
    && {
        font-size: 14px;
    }
`;

export const ModalParagraph = styled.p`
    && {
        font-size: 12px;
        line-height: 16px;
        font-weight: 400;
        color: rgba(var(--center-channel-color-rgb), 0.72);
    }
`;

export const PlaceholderContainer = styled.div`
    display: flex;
    place-items: center;
    flex-direction: column;
    gap: 5px;

    svg {
        margin: 30px 30px 20px;
    }

    hgroup {
        text-align: center;
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

export const FieldInput = styled.input.attrs({className: 'form-control secure-connections-input'})<{$deleted?: boolean}>`
    font-weight: normal;
    && {
        border-color: transparent;
        box-shadow: none;
    }
    ${({$deleted}) => $deleted && css`
        && {
            color: #D24B4E;
            text-decoration: line-through;
        }
    `};
`;

export const FieldDeleteButton = styled.button.attrs({className: 'btn btn-sm btn-transparent'})`
    font-weight: normal;
`;

export const LinkButton = styled.button.attrs({className: 'btn btn-link'})`
    font-weight: normal;
`;
