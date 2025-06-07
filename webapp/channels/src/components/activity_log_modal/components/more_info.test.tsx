// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen, fireEvent} from '@testing-library/react';
import React from 'react';
import {IntlProvider} from 'react-intl';

import {General} from 'mattermost-redux/constants';

import MoreInfo from 'components/activity_log_modal/components/more_info';

import {TestHelper} from 'utils/test_helper';

describe('components/activity_log_modal/MoreInfo', () => {
    const baseProps = {
        locale: General.DEFAULT_LOCALE,
        currentSession: TestHelper.getSessionMock({
            props: {os: 'Linux', platform: 'Linux', browser: 'Desktop App'},
            id: 'sessionId',
            create_at: 1534917291042,
            last_activity_at: 1534917643890,
        }),
        moreInfo: false,
        handleMoreInfo: jest.fn(),
    };

    const renderComponent = (props = baseProps) => {
        return render(
            <IntlProvider locale='en'>
                <MoreInfo {...props}/>
            </IntlProvider>,
        );
    };

    test('should render more info link when moreInfo is false', () => {
        renderComponent();
        expect(
            screen.getByRole('link', {name: 'More info'}),
        ).toBeInTheDocument();
    });

    test('should render session details when moreInfo is true', () => {
        const props = {...baseProps, moreInfo: true};
        renderComponent(props);

        expect(screen.getByText(/First time active: August 22, 2018/)).toBeInTheDocument();
        expect(screen.getByText(/OS: Linux/)).toBeInTheDocument();
        expect(screen.getByText(/Browser: Desktop App/)).toBeInTheDocument();
        expect(screen.getByText(/Session ID: sessionId/)).toBeInTheDocument();
    });

    test('should call handleMoreInfo when clicking more info link', () => {
        renderComponent();

        fireEvent.click(screen.getByRole('link', {name: 'More info'}));
        expect(baseProps.handleMoreInfo).toHaveBeenCalledTimes(1);
    });
});
