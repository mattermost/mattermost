// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import {mount} from 'enzyme';
import {registerComponents} from 'plugins';

import Pluggable from 'plugins/pluggable.jsx';
import ProfilePopover from 'components/profile_popover.jsx';

class ProfilePopoverPlugin extends React.PureComponent {
    render() {
        return <span>{'ProfilePopoverPlugin'}</span>;
    }
}

describe('plugins/Pluggable', () => {
    test('should match snapshot with overridden component', () => {
        registerComponents({ProfilePopover: ProfilePopoverPlugin});

        const wrapper = mount(
            <Pluggable>
                <ProfilePopover
                    user={{}}
                    src='src'
                />
            </Pluggable>
        );
        expect(wrapper).toMatchSnapshot();

        global.window.plugins.components = {};
    });

    test('should match snapshot with no overridden component', () => {
        const wrapper = mount(
            <Pluggable>
                <ProfilePopover
                    user={{}}
                    src='src'
                />
            </Pluggable>
        );
        expect(wrapper).toMatchSnapshot();
    });
});
