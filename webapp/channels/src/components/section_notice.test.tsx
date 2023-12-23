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
        primaryButton: {
            onClick: jest.fn(),
            text: 'primary button title',
        },
        secondaryButton: {
            onClick: jest.fn(),
            text: 'secondary button title',
        },
        linkButton: {
            onClick: jest.fn(),
            text: 'link button title',
        },
        isDismissable: true,
        onDismissClick: jest.fn(),
        type: 'info',
    };
}

describe('PluginAction', () => {
    it('does show the correct information', () => {
        const props = getBaseProps();
        renderWithContext(<SectionNotice {...props}/>);
        const primaryButton = screen.getByText(props.primaryButton!.text);
        const secondaryButton = screen.getByText(props.secondaryButton!.text);
        const linkButton = screen.getByText(props.linkButton!.text);
        const closeButton = screen.getByLabelText('Dismiss notice');

        expect(primaryButton).toBeInTheDocument();
        expect(secondaryButton).toBeInTheDocument();
        expect(linkButton).toBeInTheDocument();
        expect(closeButton).toBeInTheDocument();
        expect(screen.queryByText(props.text)).toBeInTheDocument();
        expect(screen.queryByText(props.title)).toBeInTheDocument();
        fireEvent.click(primaryButton);
        expect(props.primaryButton?.onClick).toHaveBeenCalledTimes(1);
        fireEvent.click(secondaryButton);
        expect(props.secondaryButton?.onClick).toHaveBeenCalledTimes(1);
        fireEvent.click(linkButton);
        expect(props.linkButton?.onClick).toHaveBeenCalledTimes(1);
        fireEvent.click(closeButton);
        expect(props.onDismissClick).toHaveBeenCalledTimes(1);
    });

    it('does not show the button if no button is passed', () => {
        const props = getBaseProps();
        props.primaryButton = undefined;
        props.secondaryButton = undefined;
        props.linkButton = undefined;
        props.isDismissable = false;
        renderWithContext(<SectionNotice {...props}/>);
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
});
