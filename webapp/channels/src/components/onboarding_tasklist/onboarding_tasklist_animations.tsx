// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import StatusIcon from '@mattermost/compass-components/components/status-icon'; // eslint-disable-line no-restricted-imports

const Animation = styled.div`
    position: absolute;
    z-index: 30;
    flex-direction: column;
    left: 15px;
    bottom: 0;
    display: none;

    &.completed {
        display: flex;
    }

    &:before {
        content: '';
        background-color: var(--denim-status-online);
        opacity: 0;
        border-radius: 50%;
        width: 1rem;
        bottom: 15%;
        position: absolute;
        height: 1rem;
        margin-left: auto;
        margin-right: auto;
        left: 0;
        right: 0;
    }

    .x1 {
        opacity: 0;
        animation-delay: 150ms;
    }

    .x2 {
        transform: scale(0.6);
        margin-left: 6px;
        animation-delay: 250ms;
        opacity: 0;
    }
    .x3 {
        transform: scale(0.6);
        margin-left: -6px;
        animation-delay: 300ms;
        opacity: 0;
    }
    .x4 {
        transform: scale(0.2);
        opacity: 0;
    }

    &.completed {
        &:before {
            animation: opacity 800ms ease-in-out, scale 800ms linear;
        }
        .x1, .x2, .x3, .x4 {
            animation: opacity 900ms ease-in-out, moveUp 900ms linear;
        }
    }
    @keyframes moveUp {
        0% { 
            top: 0;
        }
        100% { 
            top: -50px;
        }
    }

    @keyframes opacity {
        0% { 
            opacity:0;
        }
        50% { 
            opacity: 1;
        }
        100% { 
            opacity: 0;
        }
    }

    @keyframes scale {
        0% { 
            transform: scale(0);
        }
        50% { 
            transform: scale(2);
        }
        100% { 
            transform: scale(4);
        }
    }

`;

export const CompletedAnimation = (props: {completed: boolean}) => {
    return (
        <Animation className={props.completed ? 'completed' : ''}>
            <StatusIcon
                status={'online'}
                className={'x1'}
            />
            <StatusIcon
                status={'online'}
                className={'x2'}
            />
            <StatusIcon
                status={'online'}
                className={'x3'}
            />
            <StatusIcon
                status={'online'}
                className={'x4'}
            />
        </Animation>
    );
};
