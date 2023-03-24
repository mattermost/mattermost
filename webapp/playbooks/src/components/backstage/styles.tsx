// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled, {createGlobalStyle, css} from 'styled-components';
import Select from 'react-select';
import Creatable from 'react-select/creatable';

export const Banner = styled.div`
    color: var(--button-color);
    background-color: var(--button-bg);
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    z-index: 8;
    overflow: hidden;
    padding: 1rem 2.4rem;
    text-align: center;
`;

export const BackstageSubheader = styled.header`
    font-weight: 600;
    font-size: 14px;
    line-height: 20px;
    color: var(--center-channel-color);
`;

export const BackstageSubheaderDescription = styled.div`
    font-weight: normal;
    font-size: 14px;
    line-height: 20px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    margin: 4px 0 16px;
`;

export const StyledTextarea = styled.textarea`
    transition: border-color ease-in-out .15s, box-shadow ease-in-out .15s, -webkit-box-shadow ease-in-out .15s;
    width: 100%;
    resize: none;
    height: 160px;
    background-color: rgb(var(--center-channel-bg-rgb));
    border: none;
    box-shadow: inset 0 0 0 1px rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;
    padding: 10px 25px 0 16px;
    font-size: 14px;
    line-height: 20px;

    &:focus {
        box-shadow: inset 0 0 0 2px var(--button-bg);
    }
`;

export const GlobalSelectStyle = createGlobalStyle`
    .playbooks-rselect__control.playbooks-rselect__control {
        transition: all 0.15s ease;
        transition-delay: 0s;
        background-color: transparent;
        border-radius: 4px;
        border: none;
        box-shadow: inset 0 0 0 1px rgba(var(--center-channel-color-rgb), 0.16);
        width: 100%;
        font-size: 14px;

        &--is-focused {
            box-shadow: inset 0 0 0px 2px var(--button-bg);
        }
    }

    .playbooks-rselect--is-disabled {
        opacity: 0.56;
    }

    .playbooks-rselect__control,
    .playbooks-rselect__menu {
        .playbooks-rselect__menu-list {
            background-color: var(--center-channel-bg);
            border: none;
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
            line-height: 19px;
            background-color: rgba(var(--center-channel-color-rgb), 0.08);
            border-radius: 10px;
            padding-left: 8px;

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
            background-color: var(--center-channel-bg);
            border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
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
            background-color: var(--center-channel-bg);
            border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
            border-radius: 4px;
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
    font-style: normal;
    font-weight: normal;
    font-size: 11px;
    line-height: 16px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;
export const FilterButton = styled.button<{active?: boolean;}>`
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

    :hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: rgba(var(--center-channel-color-rgb), 0.72);
    }

    :active {
        background: rgba(var(--button-bg-rgb), 0.08);
        color: var(--button-bg);
    }

    .icon-chevron-down {
        :before {
            margin: 0;
        }
    }

    ${(props) => props.active && css`
        cursor: pointer;
        background: rgba(var(--button-bg-rgb), 0.08);
        color: var(--button-bg);
    `}
`;
export const HorizontalSpacer = styled.div<{ size: number }>`
    margin-left: ${(props) => props.size}px;
`;

export const VerticalSpacer = styled.div<{ size: number }>`
    margin-top: ${(props) => props.size}px;
`;
