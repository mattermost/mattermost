import React from 'react';
import {styled} from '@mui/system';
import {css, GlobalStyles} from '@mui/material';
import {INITIAL_VIEWPORTS} from '@storybook/addon-viewport';
import {DocsContainer} from '@storybook/addon-docs/blocks';

import {DocumentationThemeProvider} from './sb-themeprovider';
import ThemeProvider from '../src/themeprovider/themeprovider'

import {lightTheme, darkTheme} from "../src/themeprovider/themes";

const ThemeBlock = styled('div')(
    ({ left, fill, theme }) => css`
        display: flex;
        justify-content: center;
        align-items: center;
        position: absolute;
        top: 0;
        left: ${left || fill ? 0 : '50vw'};
        border-right: ${left ? '1px solid #202020' : 'none'};
        right: ${left ? '50vw' : 0};
        width: ${fill ? '100vw' : '50vw'};
        height: 100vh;
        bottom: 0;
        overflow: auto;
        padding: 0;
        background: ${theme.palette.background.default};
    `
)

export const withTheme = (StoryFn, context) => {
    // Get values from story parameter first, else fallback to globals
    const theme = context.parameters.theme || context.globals.theme;
    const storyTheme = theme === 'light' ? lightTheme : darkTheme;

    const canvasStyles = {
        'html': {
            fontSize: 10,
        },

        'body.sb-show-main.sb-main-centered': {
            alignItems: 'stretch',

            '#root': {
                flex: 1,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
            }
        }
    };

    const globalStyles = <GlobalStyles styles={canvasStyles}/>

    switch (theme) {
        case 'side-by-side': {
            return (
                <>
                    <ThemeProvider theme={lightTheme}>
                        {globalStyles}
                        <ThemeBlock left>
                            <StoryFn />
                        </ThemeBlock>
                    </ThemeProvider>
                    <ThemeProvider theme={darkTheme}>
                        {globalStyles}
                        <ThemeBlock>
                            <StoryFn />
                        </ThemeBlock>
                    </ThemeProvider>
                </>
            )
        }
        default: {
            return (
                <ThemeProvider theme={storyTheme}>
                    {globalStyles}
                    <ThemeBlock fill>
                        <StoryFn />
                    </ThemeBlock>
                </ThemeProvider>
            )
        }
    }
}

export const globalTypes = {
    theme: {
        name: 'Theme',
        description: 'Theme for the components',
        defaultValue: 'light',
        toolbar: {
            // The icon for the toolbar item
            icon: 'circlehollow',
            // Array of options
            items: [
                { value: 'light', icon: 'circlehollow', title: 'light' },
                { value: 'dark', icon: 'circle', title: 'dark' },
                { value: 'side-by-side', icon: 'sidebar', title: 'side by side' },
            ],
            // Property that specifies if the name of the item will be displayed
            showName: true,
        },
    },
}

export const decorators = [withTheme]

export const parameters = {
    dependencies: {
        // display only dependencies/dependents that have a story in storybook
        // by default this is false
        withStoriesOnly: true,

        // completely hide a dependency/dependents block if it has no elements
        // by default this is false
        hideEmpty: true,
    },
    actions: { argTypesRegex: '^on[A-Z].*' },
    layout: 'centered',
    controls: { hideNoControlsWarning: true },
    viewport: {
        viewports: INITIAL_VIEWPORTS,
    },
    backgrounds: {
        grid: {
            cellSize: 4,
            opacity: 0.2,
            cellAmount: 16,
        },
        disable: true,
    },
    docs: {
        container: ({ context, children }) => {
            return (
                <DocsContainer context={context}>
                    <DocumentationThemeProvider>{children}</DocumentationThemeProvider>
                </DocsContainer>
            );
        },
    },
};
