// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';
import type {ReactNode} from 'react';
import {FormattedMessage} from 'react-intl';

import SettingPicture from 'components/setting_picture';

const helpText: ReactNode = (
    <FormattedMessage
        id={'setting_picture.help.profile.example'}
        defaultMessage='Upload a picture in BMP, JPG or PNG format. Maximum file size: {max}'
        values={{max: 52428800}}
    />
);

describe('components/SettingItemMin', () => {
    const baseProps = {
        clientError: '',
        serverError: '',
        src: 'http://localhost:8065/api/v4/users/src_id',
        loadingPicture: false,
        submitActive: false,
        onSubmit: jest.fn(),
        title: 'Profile Picture',
        onFileChange: jest.fn(),
        updateSection: jest.fn(),
        maxFileSize: 209715200,
        helpText,
    };

    const mockFile = new File([new Blob()], 'image.jpeg', {
        type: 'image/jpeg',
    });
    test('should match snapshot, profile picture on source', () => {
        const wrapper = shallow(
            <SettingPicture {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, profile picture on file', () => {
        const props = {...baseProps, file: mockFile, src: ''};
        const wrapper = shallow(
            <SettingPicture {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, user icon on source', () => {
        const props = {...baseProps, onSetDefault: jest.fn()};
        const wrapper = shallow(
            <SettingPicture {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, team icon on source', () => {
        const props = {...baseProps, onRemove: jest.fn(), imageContext: 'team'};
        const wrapper = shallow(
            <SettingPicture {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, team icon on file', () => {
        const props = {...baseProps, onRemove: jest.fn(), imageContext: 'team', file: mockFile, src: ''};
        const wrapper = shallow(
            <SettingPicture {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, on loading picture', () => {
        const props = {...baseProps, loadingPicture: true};
        const wrapper = shallow(
            <SettingPicture {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with active Save button', () => {
        const props = {...baseProps, submitActive: true};
        const wrapper = shallow(
            <SettingPicture {...props}/>,
        );

        wrapper.setState({removeSrc: false});
        expect(wrapper).toMatchSnapshot();

        wrapper.setProps({submitActive: false});
        wrapper.setState({removeSrc: true});

        expect(wrapper).toMatchSnapshot();
    });

    test('should match state and call props.updateSection on handleCancel', () => {
        const props = {...baseProps, updateSection: jest.fn()};
        const wrapper = shallow(
            <SettingPicture {...props}/>,
        );
        wrapper.setState({removeSrc: true});
        const instance = wrapper.instance() as SettingPicture;
        const evt = {preventDefault: jest.fn()} as unknown as React.MouseEvent<HTMLButtonElement>;

        instance.handleCancel(evt);
        expect(props.updateSection).toHaveBeenCalledTimes(1);
        expect(props.updateSection).toHaveBeenCalledWith(evt);

        wrapper.update();
        expect(wrapper.state('removeSrc')).toEqual(false);
    });

    test('should call props.onRemove on handleSave', () => {
        const props = {...baseProps, onRemove: jest.fn()};
        const wrapper = shallow(
            <SettingPicture {...props}/>,
        );
        wrapper.setState({removeSrc: true});
        const instance = wrapper.instance() as SettingPicture;
        const evt = {preventDefault: jest.fn()} as unknown as React.MouseEvent;

        instance.handleSave(evt);
        expect(props.onRemove).toHaveBeenCalledTimes(1);
    });

    test('should call props.onSetDefault on handleSave', () => {
        const props = {...baseProps, onSetDefault: jest.fn()};
        const wrapper = shallow(
            <SettingPicture {...props}/>,
        );
        wrapper.setState({setDefaultSrc: true});
        const instance = wrapper.instance() as SettingPicture;
        const evt = {preventDefault: jest.fn()} as unknown as React.MouseEvent;

        instance.handleSave(evt);
        expect(props.onSetDefault).toHaveBeenCalledTimes(1);
    });

    test('should match state and call props.onSubmit on handleSave', () => {
        const props = {...baseProps, onSubmit: jest.fn()};
        const wrapper = shallow(
            <SettingPicture {...props}/>,
        );
        wrapper.setState({removeSrc: false});

        const instance = wrapper.instance() as SettingPicture;
        const evt = {preventDefault: jest.fn()} as unknown as React.MouseEvent;
        instance.handleSave(evt);
        expect(props.onSubmit).toHaveBeenCalledTimes(1);

        wrapper.update();
        expect(wrapper.state('removeSrc')).toEqual(false);
    });

    test('should match state on handleRemoveSrc', () => {
        const props = {...baseProps, onSubmit: jest.fn()};
        const wrapper = shallow(
            <SettingPicture {...props}/>,
        );
        wrapper.setState({removeSrc: false});
        const instance = wrapper.instance() as SettingPicture;
        const evt = {preventDefault: jest.fn()} as unknown as React.MouseEvent;
        instance.handleRemoveSrc(evt);
        wrapper.update();
        expect(wrapper.state('removeSrc')).toEqual(true);
    });

    test('should match state and call props.onFileChange on handleFileChange', () => {
        const props = {...baseProps, onFileChange: jest.fn()};
        const wrapper = shallow(
            <SettingPicture {...props}/>,
        );
        wrapper.setState({removeSrc: true});
        const instance = wrapper.instance() as SettingPicture;
        const evt = {preventDefault: jest.fn()} as unknown as React.ChangeEvent<HTMLInputElement>;

        instance.handleFileChange(evt);
        expect(props.onFileChange).toHaveBeenCalledTimes(1);
        expect(props.onFileChange).toHaveBeenCalledWith(evt);

        wrapper.update();
        expect(wrapper.state('removeSrc')).toEqual(false);
    });
});
