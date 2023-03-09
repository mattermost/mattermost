// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled, {css} from 'styled-components';
import {useRouteMatch} from 'react-router-dom';
import React from 'react';

import StatusBadge from 'src/components/backstage/status_badge';

import {BaseInput} from 'src/components/assets/inputs';
import {getSiteUrl} from 'src/client';
import CopyLink from 'src/components/widgets/copy_link';

export const Content = styled.div`
    background: var(--center-channel-bg);
    color: var(--center-channel-color);
    margin: 8px 0 0 0;
    padding: 0 8px 4px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 8px;
`;

export const ExpandRight = styled.div`
    margin-left: auto;
`;

export const Badge = styled(StatusBadge)`
    display: unset;
    position: unset;
    height: unset;
    white-space: nowrap;
`;

export const HelpText = styled.div`
    font-size: 12px;
    line-height: 16px;
    margin-top: 4px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    font-weight: 400;
`;

export const ErrorText = styled.div`
    font-size: 12px;
    line-height: 16px;
    margin-top: 4px;
    color: var(--error-text);
`;

export const StyledInput = styled(BaseInput)<{error?: boolean}>`
    height: 40px;
    width: 100%;

    background-color: ${(props) => (props.disabled ? 'rgba(var(--center-channel-color-rgb), 0.03)' : 'var(--center-channel-bg)')};

    ${(props) => (
        props.error && css`
            box-shadow: inset 0 0 0 1px var(--error-text);

            &:focus {
                box-shadow: inset 0 0 0 2px var(--error-text);
            }
        `
    )}

    scroll-margin-top: 36px;
`;

interface AnchorLinkTitleProps {
    title: string;
    id: string;

}

export const AnchorLinkTitle = (props: AnchorLinkTitleProps) => {
    const {url} = useRouteMatch();

    return (
        <LinkTitle>
            <CopyLink
                id={`section-link-${props.id}`}
                to={getSiteUrl() + `${url}#${props.id}`}
                name={props.title}
                area-hidden={true}
            />
            {props.title}
        </LinkTitle>
    );
};

const LinkTitle = styled.h3`
    font-family: Metropolis, sans-serif;
    font-size: 16px;
    font-weight: 600;
    line-height: 24px;
    padding-left: 8px;
    margin: 0;
    white-space: nowrap;
    display: inline-block;

    ${CopyLink} {
        margin-left: -1.25em;
        opacity: 1;
        transition: opacity ease 0.15s;
    }
    &:not(:hover) ${CopyLink}:not(:hover) {
        opacity: 0;
    }
`;

export enum Role {
    Viewer = 'viewer',
    Participant = 'participant',
}

export const Separator = styled.hr`
    display: flex;
    align-content: center;
    border-top: 1px solid rgba(var(--center-channel-color-rgb),0.08);
    margin: 5px auto;
    width: 100%;
`;
