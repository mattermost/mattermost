// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent} from '@testing-library/react';
import React from 'react';
import {IntlProvider} from 'react-intl';

import '@testing-library/jest-dom/extend-expect';
import {renderWithContext} from 'tests/react_testing_utils';

import ToggleFormattingBar from './toggle_formatting_bar';

jest.mock('components/with_tooltip', () => {
    return ({children}: { children: React.ReactNode }) => <div>{children}</div>;
});

describe('ToggleFormattingBar Component', () => {
    it('should render correctly with default props', () => {
        const {getAllByLabelText} = renderWithContext(
            <IntlProvider locale='en'>
                <ToggleFormattingBar
                    onClick={() => {}}
                    active={false}
                    disabled={false}
                />
            </IntlProvider>,
        );

        expect(getAllByLabelText('Format letter Case Icon')[0]).toBeInTheDocument();
    });

    it('should call onClick handler when clicked', () => {
        const onClick = jest.fn();
        const {getByLabelText} = renderWithContext(
            <IntlProvider locale='en'>
                <ToggleFormattingBar
                    onClick={onClick}
                    active={false}
                    disabled={false}
                />
            </IntlProvider>,
        );

        fireEvent.click(getByLabelText('formatting'));
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should not be clickable when disabled', () => {
        const onClick = jest.fn();
        const {getByLabelText} = renderWithContext(
            <IntlProvider locale='en'>
                <ToggleFormattingBar
                    onClick={onClick}
                    active={false}
                    disabled={true}
                />
            </IntlProvider>,
        );

        fireEvent.click(getByLabelText('formatting'));
        expect(onClick).not.toHaveBeenCalled();
    });

    it('should have the correct id based on active prop', () => {
        const {getByRole} = renderWithContext(
            <IntlProvider locale='en'>
                <ToggleFormattingBar
                    onClick={() => {}}
                    active={true}
                    disabled={false}
                />
            </IntlProvider>,
        );

        expect(getByRole('button')).toHaveAttribute('id', 'toggleFormattingBarButton');
    });
});
