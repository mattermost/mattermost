// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {StylesConfig} from 'react-select';

import type {ChannelOption} from './forward_post_channel_select';

const menuMargin = 4;
const selectHeight = 40;

const getBaseStyles = (bodyHeight: number): StylesConfig<ChannelOption, boolean> => {
    const minMenuHeight = bodyHeight - selectHeight - menuMargin;

    return ({
        input: (provided) => ({
            ...provided,
            padding: 0,
            margin: 0,
            color: 'var(--center-channel-color)',
        }),
        placeholder: (provided) => ({
            ...provided,
            margin: 0,
            color: 'rgba(var(--center-channel-color-rgb), 0.75)',
            fontSize: '14px',
            lineHeight: '20px',
        }),

        control: (provided, state) => {
            const focusShadow = 'inset 0 0 0 2px var(--button-bg)';

            return ({
                ...provided,
                color: 'var(--center-channel-color)',
                backgroundColor: 'var(--center-channel-bg)',
                cursor: 'pointer',
                borderWidth: 0,
                boxShadow: state.isFocused ? focusShadow : 'inset 0 0 0 1px rgba(var(--center-channel-color-rgb), 0.16)',
                borderRadius: '4px',
                minHeight: `${selectHeight}px`,
                padding: '0 0 0 16px',

                ':hover': {
                    color: state.isFocused ? focusShadow : 'inset 0 0 0 1px rgba(var(--center-channel-color-rgb), 0.24)',
                },
            });
        },
        indicatorSeparator: () => ({
            display: 'none',
        }),
        indicatorsContainer: (provided) => ({
            ...provided,
            padding: '2px',
        }),
        dropdownIndicator: (provided, state) => ({
            ...provided,
            transform: state.isFocused ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 250ms ease-in-out',
        }),
        valueContainer: (provided) => ({
            ...provided,
            overflow: 'visible',
            padding: '0 16px 0 0',
            margin: 0,
        }),
        menu: (provided) => ({
            ...provided,
            padding: 0,
            margin: `${menuMargin}px 0 0 0`,
            zIndex: 10,
        }),
        menuList: (provided) => ({
            ...provided,
            padding: 0,
            backgroundColor: 'var(--center-channel-bg)',
            borderRadius: '4px',
            border: '1px solid rgba(var(--center-channel-color-rgb), 0.16)',
            maxHeight: `min(${minMenuHeight}px, 300px)`,

            /* Elevation 4 */
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',

            /* scrollbar styles */
            overflowY: 'auto', // for Firefox and browsers that doesn't support overflow-y:overlay property

            scrollbarColor: 'var(--center-channel-bg)',
            scrollbarWidth: 'thin',

            '::-webkit-scrollbar': {
                width: '8px',
            },

            '::-webkit-scrollbar-track': {
                width: '0px',
                background: 'transparent',
            },

            '::-webkit-scrollbar-thumb': {
                border: '1px var(--center-channel-bg) solid',
                background: 'rgba(var(--center-channel-color-rgb), 0.24) !important',
                backgroundClip: 'padding-box',
                borderRadius: '9999px',
            },
        }),
        groupHeading: (provided) => ({
            ...provided,
            cursor: 'default',
            position: 'relative',
            display: 'flex',
            height: '2.8rem',
            alignItems: 'center',
            justifyContent: 'flex-start',
            padding: '0 0 0 2rem',
            margin: 0,
            color: 'rgba(var(--center-channel-color-rgb), 0.75)',
            backgroundColor: 'none',
            fontSize: '1.2rem',
            fontWeight: 600,
            textTransform: 'uppercase',
        }),
        singleValue: (provided) => ({
            ...provided,
            maxWidth: 'calc(100% - 10px)',
            width: '100%',
            overflow: 'visible',
        }),
        option: (provided, state) => ({
            ...provided,
            cursor: 'pointer',
            padding: '8px 20px',
            backgroundColor: state.isFocused ? 'rgba(var(--center-channel-color-rgb), 0.08)' : 'transparent',
        }),
        menuPortal: (provided) => ({
            ...provided,
            zIndex: 10,
        }),
    });
};

export {getBaseStyles};
