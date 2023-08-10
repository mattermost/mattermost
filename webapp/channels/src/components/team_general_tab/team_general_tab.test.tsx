// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import GeneralTab from 'components/team_general_tab/team_general_tab';

import {TestHelper} from 'utils/test_helper';

import type {ChangeEvent, ComponentProps} from 'react';

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
    const defaultProps: ComponentProps<typeof GeneralTab> = {
        team: TestHelper.getTeamMock({id: 'team_id'}),
        maxFileSize: 50,
        activeSection: 'team_icon',
        updateSection: jest.fn(),
        closeModal: jest.fn(),
        collapseModal: jest.fn(),
        actions: baseActions,
        canInviteTeamMembers: true,
    };

    test('should handle bad updateTeamIcon function call', () => {
        const wrapper = shallow<GeneralTab>(<GeneralTab {...defaultProps}/>);

        wrapper.instance().updateTeamIcon(null as unknown as ChangeEvent<HTMLInputElement>);

        expect(wrapper.state('clientError')).toEqual('An error occurred while selecting the image.');
    });

    test('should handle invalid file selection', () => {
        const wrapper = shallow<GeneralTab>(<GeneralTab {...defaultProps}/>);

        wrapper.instance().updateTeamIcon({
            target: {
                files: [{
                    type: 'text/plain',
                }],
            },
        } as unknown as ChangeEvent<HTMLInputElement>);

        expect(wrapper.state('clientError')).toEqual('Only BMP, JPG or PNG images may be used for team icons');
    });

    test('should handle too large files', () => {
        const wrapper = shallow<GeneralTab>(<GeneralTab {...defaultProps}/>);

        wrapper.instance().updateTeamIcon({
            target: {
                files: [{
                    type: 'image/jpeg',
                    size: defaultProps.maxFileSize + 1,
                }],
            },
        } as unknown as ChangeEvent<HTMLInputElement>);

        expect(wrapper.state('clientError')).toEqual('Unable to upload team icon. File is too large.');
    });

    test('should call actions.setTeamIcon on handleTeamIconSubmit', () => {
        const actions = {...baseActions};
        const props = {...defaultProps, actions};
        const wrapper = shallow<GeneralTab>(<GeneralTab {...props}/>);

        let teamIconFile = null;
        wrapper.setState({teamIconFile, submitActive: true});
        wrapper.instance().handleTeamIconSubmit();
        expect(actions.setTeamIcon).not.toHaveBeenCalled();

        teamIconFile = {file: 'team_icon_file'} as unknown as File;
        wrapper.setState({teamIconFile, submitActive: false});
        wrapper.instance().handleTeamIconSubmit();
        expect(actions.setTeamIcon).not.toHaveBeenCalled();

        wrapper.setState({teamIconFile, submitActive: true});
        wrapper.instance().handleTeamIconSubmit();

        expect(actions.setTeamIcon).toHaveBeenCalledTimes(1);
        expect(actions.setTeamIcon).toHaveBeenCalledWith(props.team?.id, teamIconFile);
    });

    test('should call actions.removeTeamIcon on handleTeamIconRemove', () => {
        const actions = {...baseActions};
        const props = {...defaultProps, actions};
        const wrapper = shallow<GeneralTab>(<GeneralTab {...props}/>);

        wrapper.instance().handleTeamIconRemove();

        expect(actions.removeTeamIcon).toHaveBeenCalledTimes(1);
        expect(actions.removeTeamIcon).toHaveBeenCalledWith(props.team?.id);
    });

    test('hide invite code if no permissions for team inviting', () => {
        const props = {...defaultProps, canInviteTeamMembers: false};

        const wrapper1 = shallow(<GeneralTab {...defaultProps}/>);
        const wrapper2 = shallow(<GeneralTab {...props}/>);

        expect(wrapper1).toMatchSnapshot();
        expect(wrapper2).toMatchSnapshot();
    });

    test('should call actions.patchTeam on handleAllowedDomainsSubmit', () => {
        const actions = {...baseActions};
        const props = {...defaultProps, actions};
        const wrapper = shallow<GeneralTab>(<GeneralTab {...props}/>);

        wrapper.instance().handleAllowedDomainsSubmit();

        expect(actions.patchTeam).toHaveBeenCalledTimes(1);
        expect(actions.patchTeam).toHaveBeenCalledWith(props.team);
    });

    test('should call actions.patchTeam on handleNameSubmit', () => {
        const actions = {...baseActions};
        const props = {...defaultProps, actions};
        if (props.team) {
            props.team.display_name = 'TestTeam';
        }

        const wrapper = shallow<GeneralTab>(<GeneralTab {...props}/>);

        wrapper.instance().handleNameSubmit();

        expect(actions.patchTeam).toHaveBeenCalledTimes(1);
        expect(actions.patchTeam).toHaveBeenCalledWith(props.team);
    });

    test('should call actions.patchTeam on handleInviteIdSubmit', () => {
        const actions = {...baseActions};
        const props = {...defaultProps, actions};
        if (props.team) {
            props.team.invite_id = '12345';
        }

        const wrapper = shallow<GeneralTab>(<GeneralTab {...props}/>);

        wrapper.instance().handleInviteIdSubmit();

        expect(actions.regenerateTeamInviteId).toHaveBeenCalledTimes(1);
        expect(actions.regenerateTeamInviteId).toHaveBeenCalledWith(props.team?.id);
    });

    test('should call actions.patchTeam on handleDescriptionSubmit', () => {
        const actions = {...baseActions};
        const props = {...defaultProps, actions};

        const wrapper = shallow<GeneralTab>(<GeneralTab {...props}/>);

        const newDescription = 'The Test Team';
        wrapper.setState({description: newDescription});
        wrapper.instance().handleDescriptionSubmit();
        if (props.team) {
            props.team.description = newDescription;
        }

        expect(actions.patchTeam).toHaveBeenCalledTimes(1);
        expect(actions.patchTeam).toHaveBeenCalledWith(props.team);
    });

    test('should match snapshot when team is group constrained', () => {
        const props = {...defaultProps};
        if (props.team) {
            props.team.group_constrained = true;
        }

        const wrapper = shallow(<GeneralTab {...props}/>);

        expect(wrapper).toMatchSnapshot();
    });

    test('should call actions.getTeam on handleUpdateSection if invite_id is empty', () => {
        const actions = {...baseActions};
        const props = {...defaultProps, actions};
        if (props.team) {
            props.team.invite_id = '';
        }

        const wrapper = shallow<GeneralTab>(<GeneralTab {...props}/>);

        wrapper.instance().handleUpdateSection('invite_id');

        expect(actions.getTeam).toHaveBeenCalledTimes(1);
        expect(actions.getTeam).toHaveBeenCalledWith(props.team?.id);
    });
});
