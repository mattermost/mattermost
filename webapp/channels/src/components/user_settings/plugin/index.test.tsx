// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import {shallow} from 'enzyme';
import type {ComponentProps} from 'react';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import PluginTab from './index';

type Props = ComponentProps<typeof PluginTab>;

function getBaseProps(): Props {
    return {
        activeSection: '',
        closeModal: jest.fn(),
        collapseModal: jest.fn(),
        settings: {
            id: 'pluginA',
            action: {
                text: 'actionText',
                buttonText: 'buttonText',
                onClick: jest.fn(),
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
                    onSubmit: jest.fn(),
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
                    onSubmit: jest.fn(),
                },
            ],
            uiName: 'plugin A',
        },
        updateSection: jest.fn(),
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
    it('all props are properly passed to the children', () => {
        const wrapper = shallow(<PluginTab {...getBaseProps()}/>);
        expect(wrapper).toMatchSnapshot();
    });

    it('setting name is properly set', () => {
        renderWithContext(<PluginTab {...getBaseProps()}/>);
        expect(screen.queryAllByText('plugin A Settings')).toHaveLength(2);
    });

    it('custom section component', () => {
        const props = getBaseProps();
        props.settings.sections.push({
            title: 'custom section',
            component: CustomSection,
        });
        renderWithContext(<PluginTab {...props}/>);
        expect(screen.queryAllByText('plugin A Settings')).toHaveLength(2);
        expect(screen.queryByText(CUSTOM_SECTION_TEXT)).toBeInTheDocument();
    });

    it('custom section component throws', () => {
        const consoleError = console.error;
        console.error = jest.fn();

        const props = getBaseProps();
        props.settings.sections.push({
            title: 'custom section',
            component: CustomSectionThrows,
        });
        renderWithContext(<PluginTab {...props}/>);
        expect(screen.queryAllByText('plugin A Settings')).toHaveLength(2);
        expect(screen.queryByText(CUSTOM_SECTION_TEXT)).not.toBeInTheDocument();
        expect(screen.queryByText('An error occurred in the pluginA plugin.')).toBeInTheDocument();
        expect(console.error).toHaveBeenCalled();

        console.error = consoleError;
    });
});
