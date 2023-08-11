// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {OverlayTrigger as BaseOverlayTrigger} from 'react-bootstrap'; // eslint-disable-line no-restricted-imports
import {FormattedMessage, IntlProvider} from 'react-intl';

import {mount} from 'enzyme';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';

import OverlayTrigger from './overlay_trigger';

describe('OverlayTrigger', () => {
    const testId = 'test.value';

    const intlProviderProps = {
        defaultLocale: 'en',
        locale: 'en',
        messages: {
            [testId]: 'Actual value',
        },
    };
    const baseProps = {
        overlay: (
            <FormattedMessage
                id={testId}
                defaultMessage='Default value'
            />
        ),
    };

    // Intercept console error messages since we intentionally cause some as part of these tests
    let originalConsoleError: () => void;

    beforeEach(() => {
        originalConsoleError = console.error;
        console.error = jest.fn();
    });

    afterEach(() => {
        console.error = originalConsoleError;
    });

    test('base OverlayTrigger should fail to pass intl to overlay', () => {
        const wrapper = mount(
            <IntlProvider {...intlProviderProps}>
                <BaseOverlayTrigger {...baseProps}>
                    <span/>
                </BaseOverlayTrigger>
            </IntlProvider>,
        );

        // console.error will have been called by FormattedMessage because its intl context is missing
        expect(() => {
            mount(wrapper.find(BaseOverlayTrigger).prop('overlay'));
        }).toThrow('[React Intl] Could not find required `intl` object. <IntlProvider> needs to exist in the component ancestry.');
    });

    test('custom OverlayTrigger should pass intl to overlay', () => {
        const wrapper = mount(
            <IntlProvider {...intlProviderProps}>
                <OverlayTrigger {...baseProps}>
                    <span/>
                </OverlayTrigger>
            </IntlProvider>,
        );

        const overlay = mount(wrapper.find(BaseOverlayTrigger).prop('overlay'));

        expect(overlay.text()).toBe('Actual value');
        expect(console.error).not.toHaveBeenCalled();
    });

    test('ref should properly be forwarded', () => {
        const ref = React.createRef<BaseOverlayTrigger>();
        const props = {
            ...baseProps,
            ref,
        };

        const wrapper = mountWithIntl(
            <IntlProvider {...intlProviderProps}>
                <OverlayTrigger {...props}>
                    <span/>
                </OverlayTrigger>
            </IntlProvider>,
        );

        expect(ref.current).toBe(wrapper.find(BaseOverlayTrigger).instance());
    });

    test('style and className should correctly be passed to overlay', () => {
        const props = {
            ...baseProps,
            overlay: (
                <span
                    className='test-overlay-className'
                    style={{backgroundColor: 'red'}}
                >
                    {'test-overlay'}
                </span>
            ),
            defaultOverlayShown: true, // Make sure the overlay is visible
        };

        const wrapper = mount(
            <IntlProvider {...intlProviderProps}>
                <OverlayTrigger {...props}>
                    <span/>
                </OverlayTrigger>
            </IntlProvider>,
        );

        // Dive into the react-bootstrap internals to find our overlay
        const overlay = mount((wrapper.find(BaseOverlayTrigger).instance() as any)._overlay).find('span'); // eslint-disable-line no-underscore-dangle

        // Confirm that we've found the right span
        expect(overlay.exists()).toBe(true);
        expect(overlay.text()).toBe('test-overlay');

        // Confirm that our props are included
        expect(overlay.prop('className')).toContain('test-overlay-className');
        expect(overlay.prop('style')).toMatchObject({backgroundColor: 'red'});

        // And confirm that react-bootstrap's props are included
        expect(overlay.prop('className')).toContain('fade in');
        expect(overlay.prop('placement')).toBe('right');
        expect(overlay.prop('positionTop')).toBe(0);
    });

    test('disabled and style should both be supported', () => {
        const props = {
            ...baseProps,
            overlay: (
                <span
                    style={{backgroundColor: 'red'}}
                >
                    {'test-overlay'}
                </span>
            ),
            defaultOverlayShown: true, // Make sure the overlay is visible
            disabled: true,
        };

        const wrapper = mount(
            <IntlProvider {...intlProviderProps}>
                <OverlayTrigger {...props}>
                    <span/>
                </OverlayTrigger>
            </IntlProvider>,
        );

        // Dive into the react-bootstrap internals to find our overlay
        const overlay = mount((wrapper.find(BaseOverlayTrigger).instance() as any)._overlay).find('span'); // eslint-disable-line no-underscore-dangle

        // Confirm that we've found the right span
        expect(overlay.exists()).toBe(true);
        expect(overlay.text()).toBe('test-overlay');

        // Confirm that our props are included
        expect(overlay.prop('style')).toMatchObject({backgroundColor: 'red', visibility: 'hidden'});
    });
});
