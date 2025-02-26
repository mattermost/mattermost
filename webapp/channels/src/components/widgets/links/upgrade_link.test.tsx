// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';
import {Provider} from 'react-redux';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import mockStore from 'tests/test_store';

import UpgradeLink from './upgrade_link';

let trackEventCall = 0;

jest.mock('actions/telemetry_actions.jsx', () => {
    const original = jest.requireActual('actions/telemetry_actions.jsx');
    return {
        ...original,
        trackEvent: () => {
            trackEventCall = 1;
        },
    };
});

describe('components/widgets/links/UpgradeLink', () => {
    const mockDispatch = jest.fn();
    jest.mock('react-redux', () => ({
        useDispatch: () => mockDispatch,
    }));

    test('should match the snapshot on show', () => {
        const store = mockStore({});
        const wrapper = shallow(
            <Provider store={store}><UpgradeLink/></Provider>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should trigger telemetry call when button clicked', (done) => {
        const mockWindowOpen = jest.fn();
        global.window.open = mockWindowOpen;
        const store = mockStore({
            entities: {
                general: {},
                cloud: {
                    customer: {},
                },
                users: {
                    profiles: {},
                },
            },
        });
        const wrapper = mountWithIntl(
            <Provider store={store}><UpgradeLink telemetryInfo='testing'/></Provider>,
        );
        expect(wrapper.find('button').exists()).toEqual(true);
        wrapper.find('button').simulate('click');

        setImmediate(() => {
            expect(trackEventCall).toBe(1);
            done();
        });
        expect(wrapper).toMatchSnapshot();
        expect(mockWindowOpen).toHaveBeenCalled();
    });
});
