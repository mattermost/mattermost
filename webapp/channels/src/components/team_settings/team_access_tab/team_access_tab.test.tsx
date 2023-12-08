// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';
import type {ComponentProps} from 'react';

import {type MockIntl} from 'tests/helpers/intl-test-helper';
import {TestHelper} from 'utils/test_helper';

import AccessTab from './team_access_tab';

describe('components/TeamSettings', () => {
    const getTeam = jest.fn().mockResolvedValue({data: true});
    const patchTeam = jest.fn().mockReturnValue({data: true});
    const regenerateTeamInviteId = jest.fn().mockReturnValue({data: true});
    const removeTeamIcon = jest.fn().mockReturnValue({data: true});
    const setTeamIcon = jest.fn().mockReturnValue({data: true});
    const baseActions = {
        getTeam,
        patchTeam,
        regenerateTeamInviteId,
        removeTeamIcon,
        setTeamIcon,
    };
    const defaultProps: ComponentProps<typeof AccessTab> = {
        team: TestHelper.getTeamMock({id: 'team_id'}),
        maxFileSize: 50,
        closeModal: jest.fn(),
        actions: baseActions,
        canInviteTeamMembers: true,
        isMobileView: false,
    };

    test('hide invite code if no permissions for team inviting', () => {
        const props = {...defaultProps, canInviteTeamMembers: false};

        const wrapper1 = shallow(<AccessTab {...defaultProps}/>);
        const wrapper2 = shallow(<AccessTab {...props}/>);

        expect(wrapper1).toMatchSnapshot();
        expect(wrapper2).toMatchSnapshot();
    });

    test('should call actions.patchTeam on handleAllowedDomainsSubmit', () => {
        const actions = {...baseActions};
        const props = {...defaultProps, actions};
        const wrapper = shallow<AccessTab>(<AccessTab {...props}/>);

        wrapper.instance().handleAllowedDomainsSubmit();

        expect(actions.patchTeam).toHaveBeenCalledTimes(1);
        expect(actions.patchTeam).toHaveBeenCalledWith({
            allowed_domains: '',
            id: props.team?.id,
        });
    });

    test('should call actions.patchTeam on handleInviteIdSubmit', () => {
        const actions = {...baseActions};
        const props = {...defaultProps, actions};
        if (props.team) {
            props.team.invite_id = '12345';
        }

        const wrapper = shallow<AccessTab>(<AccessTab {...props}/>);

        wrapper.instance().handleInviteIdSubmit();

        expect(actions.regenerateTeamInviteId).toHaveBeenCalledTimes(1);
        expect(actions.regenerateTeamInviteId).toHaveBeenCalledWith(props.team?.id);
    });

    test('should match snapshot when team is group constrained', () => {
        const props = {...defaultProps};
        if (props.team) {
            props.team.group_constrained = true;
        }

        const wrapper = shallow(<AccessTab {...props}/>);

        expect(wrapper).toMatchSnapshot();
    });

    test('should call actions.getTeam on handleUpdateSection if invite_id is empty', () => {
        const actions = {...baseActions};
        const props = {...defaultProps, actions};
        if (props.team) {
            props.team.invite_id = '';
        }

        shallow<AccessTab>(<AccessTab {...props}/>);

        expect(actions.getTeam).toHaveBeenCalledTimes(1);
        expect(actions.getTeam).toHaveBeenCalledWith(props.team?.id);
    });
});
