// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';

import {render, renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import PluginAction from './plugin_action';

type Props = ComponentProps<typeof PluginAction>;

function getBaseProps(): Props {
    return {
        action: {
            title: 'some title',
            text: 'some text',
            buttonText: 'button text',
            onClick: jest.fn(),
        },
    };
}

describe('PluginAction', () => {
    it('does not show when no action is provided', () => {
        const {container} = render(<PluginAction/>);
        expect(container.firstChild).toBeNull();
    });

    it('does show the correct information', async () => {
        const props = getBaseProps();
        renderWithContext(<PluginAction {...props}/>);
        const button = screen.getByText(props.action!.buttonText);
        expect(button).toBeInTheDocument();
        expect(screen.queryByText(props.action!.text)).toBeInTheDocument();
        expect(screen.queryByText(props.action!.title)).toBeInTheDocument();
        await userEvent.click(button);
        expect(props.action?.onClick).toHaveBeenCalled();
    });
});
