// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import WithTooltip from 'components/with_tooltip';

import PanelHeader from './panel_header';

describe('components/drafts/panel/panel_header', () => {
    const baseProps: React.ComponentProps<typeof PanelHeader> = {
        kind: 'draft' as const,
        actions: <div>{'actions'}</div>,
        hover: false,
        timestamp: 12345,
        remote: false,
        title: <div>{'title'}</div>,
        error: undefined,
    };

    it('should match snapshot', () => {
        const wrapper = shallow(
            <PanelHeader
                {...baseProps}
            />,
        );

        expect(wrapper.find('div.PanelHeader__actions').hasClass('PanelHeader__actions show')).toBe(false);
        expect(wrapper.find(WithTooltip).exists()).toBe(false);
        expect(wrapper).toMatchSnapshot();
    });

    it('should show sync icon when draft is from server', () => {
        const props = {
            ...baseProps,
            remote: true,
        };

        const wrapper = shallow(
            <PanelHeader
                {...props}
            />,
        );

        expect(wrapper.find(WithTooltip).exists()).toBe(true);
        expect(wrapper).toMatchSnapshot();
    });

    it('should show draft actions when hovered', () => {
        const props = {
            ...baseProps,
            hover: true,
        };

        const wrapper = shallow(
            <PanelHeader
                {...props}
            />,
        );

        expect(wrapper.find('div.PanelHeader__actions').hasClass('PanelHeader__actions show')).toBe(true);
        expect(wrapper).toMatchSnapshot();
    });
});
