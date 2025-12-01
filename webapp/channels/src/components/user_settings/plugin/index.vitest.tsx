// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';

import PluginTab from './index';

type Props = ComponentProps<typeof PluginTab>;

function getBaseProps(): Props {
    return {
        activeSection: '',
        closeModal: vi.fn(),
        collapseModal: vi.fn(),
        settings: {
            id: 'pluginA',
            action: {
                text: 'actionText',
                buttonText: 'buttonText',
                onClick: vi.fn(),
                title: 'actionTitle',
            },
            sections: [
                {
                    settings: [
                        {
                            default: '0',
                            name: '0',
                            options: [
                                {
                                    text: 'Option 0',
                                    value: '0',
                                },
                                {
                                    text: 'Option 1',
                                    value: '1',
                                },
                            ],
                            type: 'radio',
                        },
                    ],
                    title: 'section 1',
                    onSubmit: vi.fn(),
                },
                {
                    settings: [
                        {
                            default: '1',
                            name: '1',
                            options: [
                                {
                                    text: 'Option 0',
                                    value: '0',
                                },
                                {
                                    text: 'Option 1',
                                    value: '1',
                                },
                            ],
                            type: 'radio',
                        },
                    ],
                    title: 'section 2',
                    onSubmit: vi.fn(),
                },
            ],
            uiName: 'plugin A',
        },
        updateSection: vi.fn(),
    };
}

const CUSTOM_SECTION_TEXT = 'custom section content';

function CustomSection() {
    return (<div>{CUSTOM_SECTION_TEXT}</div>);
}

function CustomSectionThrows() {
    const throwError = () => {
        throw new Error('component error');
    };
    return (<div>{throwError()}</div>);
}

describe('plugin tab', () => {
    test('all props are properly passed to the children', () => {
        const {container} = renderWithContext(<PluginTab {...getBaseProps()}/>);
        expect(container).toMatchSnapshot();
    });

    test('setting name is properly set', () => {
        renderWithContext(<PluginTab {...getBaseProps()}/>);
        expect(screen.queryAllByText('plugin A Settings')).toHaveLength(2);
    });

    test('custom section component', () => {
        const props = getBaseProps();
        props.settings.sections.push({
            title: 'custom section',
            component: CustomSection,
        });
        renderWithContext(<PluginTab {...props}/>);
        expect(screen.queryAllByText('plugin A Settings')).toHaveLength(2);
        expect(screen.queryByText(CUSTOM_SECTION_TEXT)).toBeInTheDocument();
    });

    test('custom section component throws', () => {
        // Suppress all error output (React console.error + jsdom stderr)
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const originalStderrWrite = process.stderr.write.bind(process.stderr);
        process.stderr.write = vi.fn();

        const props = getBaseProps();
        props.settings.sections.push({
            title: 'custom section',
            component: CustomSectionThrows,
        });
        renderWithContext(<PluginTab {...props}/>);

        // Verify error boundary catches the error and displays error message
        expect(screen.queryAllByText('plugin A Settings')).toHaveLength(2);
        expect(screen.queryByText(CUSTOM_SECTION_TEXT)).not.toBeInTheDocument();
        expect(screen.queryByText('An error occurred in the pluginA plugin.')).toBeInTheDocument();

        // Verify React logged the error
        expect(consoleErrorSpy).toHaveBeenCalled();

        // Restore
        consoleErrorSpy.mockRestore();
        process.stderr.write = originalStderrWrite;
    });
});
