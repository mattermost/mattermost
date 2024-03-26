// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import CommercialSupportModal from 'components/commercial_support_modal/commercial_support_modal';

import {TestHelper} from 'utils/test_helper';

describe('components/CommercialSupportModal', () => {
    test('should match snapshot', () => {
        const mockUser = TestHelper.getUserMock();
        const wrapper = shallow(
            <CommercialSupportModal
                onExited={jest.fn()}
                showBannerWarning={true}
                isCloud={false}
                currentUser={mockUser}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
