// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled, {createGlobalStyle, css} from 'styled-components';
import Select from 'react-select';
import Creatable from 'react-select/creatable';

export const Banner = styled.div`
    position: fixed;
    z-index: 8;
    top: 0;
    left: 0;
    overflow: hidden;
    width: 100%;
    padding: 1rem 2.4rem;
    background-color: var(--button-bg);
    color: var(--button-color);
    text-align: center;
`;

export const BackstageSubheader = styled.header`
    color: var(--center-channel-color);
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
`;

export const BackstageSubheaderDescription = styled.div`
    margin: 4px 0 16px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    font-size: 14px;
    font-weight: normal;
    line-height: 20px;
`;

export const StyledTextarea = styled.textarea`
    width: 100%;
    height: 160px;
    padding: 10px 25px 0 16px;
    border: none;
    border-radius: 4px;
    background-color: rgba(var(--center-channel-bg-rgb));
    box-shadow: inset 0 0 0 1px rgba(var(--center-channel-color-rgb), 0.16);
    font-size: 14px;
    line-height: 20px;
    resize: none;
    transition: border-color ease-in-out .15s, box-shadow ease-in-out .15s, -webkit-box-shadow ease-in-out .15s;

    &:focus {
        box-shadow: inset 0 0 0 2px var(--button-bg);
    }
`;

export const GlobalSelectStyle = createGlobalStyle`
    .playbooks-rselect__control.playbooks-rselect__control {
        width: 100%;
        border: none;
        border-radius: 4px;
        background-color: transparent;
        box-shadow: inset 0 0 0 1px rgba(var(--center-channel-color-rgb), 0.16);
        font-size: 14px;
        transition: all 0.15s ease;
        transition-delay: 0s;

        &--is-focused {
            box-shadow: inset 0 0 0 2px var(--button-bg);
        }
    }

    .playbooks-rselect--is-disabled {
        opacity: 0.56;
    }

    .playbooks-rselect__control,
    .playbooks-rselect__menu {
        .playbooks-rselect__menu-list {
            border: none;
            border-radius: var(--radius-s);
            background-color: var(--center-channel-bg);
        }

        .playbooks-rselect__input {
            color: var(--center-channel-color);
        }

        .playbooks-rselect__option--is-selected {
            background-color: rgba(var(--center-channel-color-rgb), 0.08);
            color: inherit;
        }

        .playbooks-rselect__option--is-focused {
            background-color: rgba(var(--center-channel-color-rgb), 0.16);
        }

        .playbooks-rselect__option {
            &:active {
                background-color: rgba(var(--center-channel-color-rgb), 0.08);
            }
        }

        .playbooks-rselect__single-value {
            color: var(--center-channel-color);
        }

        .playbooks-rselect__multi-value {
            height: 20px;
            padding-left: 8px;
            border-radius: 10px;
            background-color: rgba(var(--center-channel-color-rgb), 0.08);
            line-height: 19px;

            .playbooks-rselect__multi-value__label {
                padding: 0;
                color: var(--center-channel-color);
            }

            .playbooks-rselect__multi-value__remove {
                color: rgba(var(--center-channel-bg-rgb), 0.80);
            }
        }
    }
`;

const commonSelectStyle = css`
    flex-grow: 1;
    background-color: var(--center-channel-bg);
`;

export const StyledSelect = styled(Select).attrs((props) => {
    return {
        classNamePrefix: 'playbooks-rselect',
        ...props,
    };
})`
    ${commonSelectStyle}

    ${({classNamePrefix}) => css`
        .${classNamePrefix}__multi-value {
            padding-left: 6px;
        }
    `}

`;

export const StyledCreatable = styled(Creatable)`
    ${commonSelectStyle}

    ${({classNamePrefix}) => css`
        .${classNamePrefix}__control {
            border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
            background-color: var(--center-channel-bg);
        }

        .${classNamePrefix}__input {
            color: var(--center-channel-color);
        }

        .${classNamePrefix}__control.${classNamePrefix}__control--is-disabled {
            background-color: rgba(var(--center-channel-bg-rgb), 0.16);
        }

        .${classNamePrefix}__single-value {
            color: var(--center-channel-color);
        }

        .${classNamePrefix}__multi-value {
            padding-left: 6px;
        }

        .${classNamePrefix}__menu-list {
            border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
            border-radius: 4px;
            background-color: var(--center-channel-bg);
        }

        .${classNamePrefix}__option {
            color: var(--center-channel-color);
        }

        .${classNamePrefix}__option--is-focused {
            background-color: rgba(var(--center-channel-color-rgb), 0.1);
        }

        .${classNamePrefix}__option--is-selected {
            background-color: rgba(var(--center-channel-color-rgb), 0.2);
        }
    `}

`;

export const RadioInput = styled.input`
    && {
        width: 16px;
        height: 16px;
        margin: 0 8px 0 0;
    }
`;

export const CenteredRow = styled.div`
    display: flex;
    flex-direction: row;
    justify-content: center;
`;

export const InfoLine = styled.div`
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-size: 11px;
    font-style: normal;
    font-weight: normal;
    line-height: 16px;
`;
export const FilterButton = styled.button<{$active?: boolean;}>`
    display: flex;
    align-items: center;
    border: none;
    border-radius: 4px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    background: transparent;
    cursor: pointer;
    font-weight: 600;
    font-size: 14px;
    line-height: 12px;
    transition: all 0.15s ease;
    padding: 0 16px;
    height: 4rem;

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: rgba(var(--center-channel-color-rgb), 0.72);
    }

    &:active {
        background: rgba(var(--button-bg-rgb), 0.08);
        color: var(--button-bg);
    }

    .icon-chevron-down {
        &::before {
            margin: 0;
        }
    }

    ${(props) => props.$active && css`
        background: rgba(var(--button-bg-rgb), 0.08);
        color: var(--button-bg);
        cursor: pointer;
    `}
`;
export const HorizontalSpacer = styled.div<{$size: number}>`
    margin-left: ${(props) => props.$size}px;
`;

export const VerticalSpacer = styled.div<{$size: number}>`
    margin-top: ${(props) => props.$size}px;
`;
