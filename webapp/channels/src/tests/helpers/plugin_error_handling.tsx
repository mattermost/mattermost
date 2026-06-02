// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import type {PluginComponent} from 'types/store/plugins';

export function testPluginComponentErrorHandling(renderCallback: (pluginComponent: PluginComponent & {component: any}) => React.JSX.Element) {
    describe('error handling', () => {
        const origError = console.error;
        beforeEach(() => {
            console.error = jest.fn();
        });
        afterEach(() => {
            console.error = origError;
        });

        test('should render fallback when an error occurs in a plugin component', async () => {
            let throwError = true;
            function TestComponent(): JSX.Element {
                let obj: any;
                if (throwError) {
                    obj = {};
                } else {
                    obj = {
                        someField: {
                            thatDoesnt: {
                                exist: [1, 2, 3],
                            },
                        },
                    };
                }

                return <span>{'TestComponent ' + obj.someField.thatDoesnt.exist.toString()}</span>;
            }

            renderWithContext(renderCallback({
                id: 'testId',
                component: TestComponent,
                pluginId: 'testPluginId',
            }));

            expect(screen.queryByText('An error occurred', {exact: false})).toBeVisible();
            expect(screen.queryByText('TestComponent 1,2,3')).toBeNull();

            throwError = false;

            await userEvent.click(screen.getByText('Refresh?'));

            expect(screen.queryByText('An error occurred', {exact: false})).toBeNull();
            expect(screen.queryByText('TestComponent 1,2,3')).toBeVisible();
        });
    });
}
