// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import {mount} from 'enzyme';
import {IntlProvider} from 'react-intl';

import Pluggable from 'plugins/pluggable/pluggable.jsx';
import ProfilePopover from 'components/profile_popover.jsx';

class ProfilePopoverPlugin extends React.PureComponent {
    render() {
        return <span>{'ProfilePopoverPlugin'}</span>;
    }
}

describe('plugins/Pluggable', () => {
    test('should match snapshot with overridden component', () => {
        const wrapper = mount(
            <Pluggable
                components={{ProfilePopover: ProfilePopoverPlugin}}
                theme={{}}
            >
                <ProfilePopover
                    user={{}}
                    src='src'
                />
            </Pluggable>
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with no overridden component', () => {
        window.mm_config = {};
        const wrapper = mount(
            <IntlProvider>
                <Pluggable
                    components={{}}
                    theme={{}}
                >
                    <ProfilePopover
                        user={{}}
                        src='src'
                    />
                </Pluggable>
            </IntlProvider>
        );
        expect(wrapper).toMatchSnapshot();
    });
});
