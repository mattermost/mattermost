// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {fireEvent, screen, render, waitForElementToBeRemoved, waitFor} from '@testing-library/react';
import {shallow} from 'enzyme';

import AccessHistoryModal from 'components/access_history_modal/access_history_modal';
import AuditTable from 'components/audit_table';
import LoadingScreen from 'components/loading_screen';

import {withIntl} from 'tests/helpers/intl-test-helper';

describe('components/AccessHistoryModal', () => {
    const baseProps = {
        onHide: jest.fn(),
        actions: {
            getUserAudits: jest.fn(),
        },
        userAudits: [],
        currentUserId: '',
    };

    test('should match snapshot when no audits exist', () => {
        const wrapper = shallow(
            <AccessHistoryModal {...baseProps}/>,
        );
        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find(LoadingScreen).exists()).toBe(true);
        expect(wrapper.find(AuditTable).exists()).toBe(false);
    });

    test('should match snapshot when audits exist', () => {
        const wrapper = shallow(
            <AccessHistoryModal {...baseProps}/>,
        );

        wrapper.setProps({userAudits: ['audit1', 'audit2']});
        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find(LoadingScreen).exists()).toBe(false);
        expect(wrapper.find(AuditTable).exists()).toBe(true);
    });

    test('should have called actions.getUserAudits only when first rendered', () => {
        const actions = {
            getUserAudits: jest.fn(),
        };
        const props = {...baseProps, actions};
        const view = render(withIntl(<AccessHistoryModal {...props}/>));

        expect(actions.getUserAudits).toHaveBeenCalledTimes(1);
        const newProps = {...props, currentUserId: 'foo'};
        view.rerender(withIntl(<AccessHistoryModal {...newProps}/>));
        expect(actions.getUserAudits).toHaveBeenCalledTimes(1);
    });

    test('should hide', async () => {
        render(withIntl(<AccessHistoryModal {...baseProps}/>));
        await waitFor(() => screen.getByText('Access History'));
        fireEvent.click(screen.getByLabelText('Close'));
        await waitForElementToBeRemoved(() => screen.getByText('Access History'));
    });
});
