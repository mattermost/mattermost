// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent, screen} from '@testing-library/react';
import type {ComponentProps} from 'react';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import SectionNotice from './section_notice';

type Props = ComponentProps<typeof SectionNotice>;

function getBaseProps(): Props {
    return {
        text: 'some text',
        title: 'some title',
        button: {
            onClick: jest.fn(),
            text: 'button title',
        },
        isError: false,
    };
}

describe('PluginAction', () => {
    it('does show the correct information', () => {
        const props = getBaseProps();
        renderWithContext(<SectionNotice {...props}/>);
        const button = screen.getByRole('button');
        expect(button).toBeInTheDocument();
        expect(button).toHaveTextContent(props.button!.text);
        expect(screen.queryByText(props.text)).toBeInTheDocument();
        expect(screen.queryByText(props.title)).toBeInTheDocument();
        fireEvent.click(button);
        expect(props.button?.onClick).toHaveBeenCalled();
    });

    it('does not show the button if no button is passed', () => {
        const props = getBaseProps();
        props.button = undefined;
        renderWithContext(<SectionNotice {...props}/>);
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('if error, the text is still the color of the center channel', () => {
        const props = getBaseProps();
        props.isError = true;
        renderWithContext(<SectionNotice {...props}/>);
        const text = screen.getByText(props.text);
        const title = screen.getByText(props.title);
        expect(text).toHaveStyle('color: var(--center-channel-color)');
        expect(title).toHaveStyle('color: var(--center-channel-color)');
    });
});
