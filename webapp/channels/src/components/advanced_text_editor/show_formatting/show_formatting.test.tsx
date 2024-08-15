// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent} from '@testing-library/react';
import React from 'react';
import {IntlProvider} from 'react-intl';

import {renderWithContext} from 'tests/react_testing_utils';

import ShowFormatting from './show_formatting';

jest.mock('components/with_tooltip', () => {
    return ({children}: { children: React.ReactNode }) => <div>{children}</div>;
});

describe('ShowFormatting Component', () => {
    it('should render correctly with default props', () => {
        const {getByLabelText} = renderWithContext(
            <IntlProvider locale='en'>
                <ShowFormatting
                    onClick={() => {}}
                    active={false}
                />
            </IntlProvider>,
        );

        expect(getByLabelText('Eye Icon')).toBeInTheDocument();
    });

    it('should call onClick handler when clicked', () => {
        const onClick = jest.fn();
        const {getByLabelText} = renderWithContext(
            <IntlProvider locale='en'>
                <ShowFormatting
                    onClick={onClick}
                    active={false}
                />
            </IntlProvider>,
        );

        fireEvent.click(getByLabelText('Eye Icon'));
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should apply the active class when active prop is true', () => {
        const {container} = renderWithContext(
            <IntlProvider locale='en'>
                <ShowFormatting
                    onClick={() => {}}
                    active={true}
                />
            </IntlProvider>,
        );

        expect(container.querySelector('button')).toHaveClass('active');
    });
});
