// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen} from '@testing-library/react';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import {wrapIntl} from '@mattermost/components/src/testUtils';

import BackstageList from './backstage_list';

describe('components/backstage/components/BackstageList', () => {
    test('Should have the browsing hint', () => {
        render(
            wrapIntl(
                <BackstageList
                    header={
                        <FormattedMessage
                            id='installed_incoming_webhooks.header'
                            defaultMessage='Installed Incoming Webhooks'
                        />
                    }
                    hintText={
                        <FormattedMessage
                            id='installed_incoming_webhooks.hint'
                            defaultMessage='Search by title of the webhook or by associated channel. Examples: "My Webhook Title", "town-square", or "Town Square".'
                        />
                    }
                    loading={false}
                >
                    {() => {
                        return [[], false];
                    }}
                </BackstageList>,
            ),
        );

        const header = screen.getByText('Installed Incoming Webhooks');
        expect(header).toBeInTheDocument();

        const hint = screen.getByText(/Search by title of the/);
        expect(hint).toBeInTheDocument();
    });

    test("Shouldn't have the browsing hint", () => {
        render(
            wrapIntl(
                <BackstageList
                    header={
                        <FormattedMessage
                            id='installed_incoming_webhooks.header'
                            defaultMessage='Installed Incoming Webhooks'
                        />
                    }
                    loading={false}
                >
                    {() => {
                        return [[], false];
                    }}
                </BackstageList>,
            ),
        );
        const header = screen.getByText('Installed Incoming Webhooks');
        expect(header).toBeInTheDocument();

        const hint = screen.queryByText(/Search by title of the/);
        expect(hint).toBeNull();
    });

    test('Should match snapshot with browsing hint', () => {
        const container = render(
            wrapIntl(
                <BackstageList
                    header={
                        <FormattedMessage
                            id='installed_incoming_webhooks.header'
                            defaultMessage='Installed Incoming Webhooks'
                        />
                    }
                    hintText={
                        <FormattedMessage
                            id='installed_incoming_webhooks.hint'
                            defaultMessage='Search by title of the webhook or by associated channel. Examples: "My Webhook Title", "town-square", or "Town Square".'
                        />
                    }
                    loading={false}
                >
                    {() => {
                        return [[], false];
                    }}
                </BackstageList>,
            ),
        );
        expect(container).toMatchSnapshot();
    });

    test('Should match snapshot without browsing hint', () => {
        const container = render(
            wrapIntl(
                <BackstageList
                    header={
                        <FormattedMessage
                            id='installed_incoming_webhooks.header'
                            defaultMessage='Installed Incoming Webhooks'
                        />
                    }
                    loading={false}
                >
                    {() => {
                        return [[], false];
                    }}
                </BackstageList>,
            ),
        );
        expect(container).toMatchSnapshot();
    });
});
