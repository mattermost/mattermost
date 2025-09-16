// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import 'tests/helpers/localstorage';

import AnnouncementBar from 'components/announcement_bar/default_announcement_bar/announcement_bar';

describe('components/AnnouncementBar', () => {
    const baseProps = {
        isLoggedIn: true,
        canViewSystemErrors: false,
        canViewAPIv3Banner: false,
        license: {
            id: '',
        },
        siteURL: '',
        sendEmailNotifications: true,
        enablePreviewMode: false,
        bannerText: 'Banner text',
        allowBannerDismissal: true,
        enableBanner: true,
        bannerColor: 'green',
        bannerTextColor: 'black',
        enableSignUpWithGitLab: false,
        message: 'text',
        announcementBarCount: 0,
        actions: {
            sendVerificationEmail: jest.fn(),
            incrementAnnouncementBarCount: jest.fn(),
            decrementAnnouncementBarCount: jest.fn(),
        },
    };

    test('should match snapshot, bar showing', () => {
        const props = baseProps;
        const wrapper = shallow<AnnouncementBar>(
            <AnnouncementBar {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, bar not showing', () => {
        const props = {...baseProps, enableBanner: false};
        const wrapper = shallow<AnnouncementBar>(
            <AnnouncementBar {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, bar showing, no dismissal', () => {
        const props = {...baseProps, allowBannerDismissal: false};
        const wrapper = shallow<AnnouncementBar>(
            <AnnouncementBar {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, props change', () => {
        const props = baseProps;
        const wrapper = shallow<AnnouncementBar>(
            <AnnouncementBar {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();

        const newProps = {...baseProps, bannerColor: 'yellow', bannerTextColor: 'red'};
        wrapper.setProps(newProps as any);
        expect(wrapper).toMatchSnapshot();

        newProps.allowBannerDismissal = false;
        wrapper.setProps(newProps as any);
        expect(wrapper).toMatchSnapshot();

        newProps.enableBanner = false;
        wrapper.setProps(newProps as any);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, dismissal', () => {
        const props = baseProps;
        const wrapper = shallow<AnnouncementBar>(
            <AnnouncementBar {...props}/>,
        );

        // Banner should show
        expect(wrapper).toMatchSnapshot();

        // Banner should remain hidden
        const newProps = {...baseProps, bannerColor: 'yellow', bannerTextColor: 'red'};
        wrapper.setProps(newProps as any);
        expect(wrapper).toMatchSnapshot();

        // Banner should return
        newProps.bannerText = 'Some new text';
        wrapper.setProps(newProps as any);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, admin configured bar', () => {
        const props = {...baseProps, enableBanner: true, bannerText: 'Banner text'};
        const wrapper = shallow(
            <div>
                <AnnouncementBar {...props}/>
                <AnnouncementBar
                    {...props}
                    className='admin-announcement'
                />
            </div>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    describe('announcement bar count and CSS management', () => {
        let setPropertySpy: jest.SpyInstance;
        let removePropertySpy: jest.SpyInstance;
        let addClassSpy: jest.SpyInstance;
        let removeClassSpy: jest.SpyInstance;

        beforeEach(() => {
            // Mock DOM methods
            setPropertySpy = jest.spyOn(document.documentElement.style, 'setProperty');
            removePropertySpy = jest.spyOn(document.documentElement.style, 'removeProperty');
            addClassSpy = jest.spyOn(document.body.classList, 'add');
            removeClassSpy = jest.spyOn(document.body.classList, 'remove');
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        test('should set CSS custom property and add class on mount', () => {
            const props = {...baseProps, announcementBarCount: 0};
            shallow<AnnouncementBar>(<AnnouncementBar {...props}/>);

            expect(setPropertySpy).toHaveBeenCalledWith('--announcement-bar-count', '1');
            expect(addClassSpy).toHaveBeenCalledWith('announcement-bar--fixed');
            expect(props.actions.incrementAnnouncementBarCount).toHaveBeenCalled();
        });

        test('should update CSS custom property when announcement bar count changes', () => {
            const props = {...baseProps, announcementBarCount: 1};
            const wrapper = shallow<AnnouncementBar>(<AnnouncementBar {...props}/>);

            // Reset spies after mount
            setPropertySpy.mockClear();
            addClassSpy.mockClear();

            // Update props to simulate count change
            const newProps = {...props, announcementBarCount: 2};
            wrapper.setProps(newProps as any);

            expect(setPropertySpy).toHaveBeenCalledWith('--announcement-bar-count', '2');
            expect(addClassSpy).toHaveBeenCalledWith('announcement-bar--fixed');
        });

        test('should remove class and custom property when count reaches 0', () => {
            const props = {...baseProps, announcementBarCount: 1};
            const wrapper = shallow<AnnouncementBar>(<AnnouncementBar {...props}/>);

            // Reset spies after mount
            setPropertySpy.mockClear();
            removeClassSpy.mockClear();

            // Update props to simulate count reaching 0
            const newProps = {...props, announcementBarCount: 0};
            wrapper.setProps(newProps as any);

            expect(removeClassSpy).toHaveBeenCalledWith('announcement-bar--fixed');
        });

        test('should maintain class when count is greater than 0', () => {
            const props = {...baseProps, announcementBarCount: 2};
            const wrapper = shallow<AnnouncementBar>(<AnnouncementBar {...props}/>);

            // Reset spies after mount
            setPropertySpy.mockClear();
            addClassSpy.mockClear();
            removeClassSpy.mockClear();

            // Update props to simulate count change from 2 to 1
            const newProps = {...props, announcementBarCount: 1};
            wrapper.setProps(newProps as any);

            expect(setPropertySpy).toHaveBeenCalledWith('--announcement-bar-count', '1');
            expect(addClassSpy).toHaveBeenCalledWith('announcement-bar--fixed');
            expect(removeClassSpy).not.toHaveBeenCalled();
        });

        test('should properly clean up on unmount when last bar', () => {
            const props = {...baseProps, announcementBarCount: 1};
            const wrapper = shallow<AnnouncementBar>(<AnnouncementBar {...props}/>);

            // Reset spies after mount
            removeClassSpy.mockClear();
            removePropertySpy.mockClear();

            wrapper.unmount();

            expect(props.actions.decrementAnnouncementBarCount).toHaveBeenCalled();
            expect(removeClassSpy).toHaveBeenCalledWith('announcement-bar--fixed');
            expect(removePropertySpy).toHaveBeenCalledWith('--announcement-bar-count');
        });

        test('should update count but maintain class on unmount when other bars remain', () => {
            const props = {...baseProps, announcementBarCount: 2};
            const wrapper = shallow<AnnouncementBar>(<AnnouncementBar {...props}/>);

            // Reset spies after mount
            setPropertySpy.mockClear();
            removeClassSpy.mockClear();
            removePropertySpy.mockClear();

            wrapper.unmount();

            expect(props.actions.decrementAnnouncementBarCount).toHaveBeenCalled();
            expect(setPropertySpy).toHaveBeenCalledWith('--announcement-bar-count', '1');
            expect(removeClassSpy).not.toHaveBeenCalled();
            expect(removePropertySpy).not.toHaveBeenCalled();
        });

        test('should handle undefined announcement bar count gracefully', () => {
            const props = {...baseProps, announcementBarCount: undefined};
            const wrapper = shallow<AnnouncementBar>(<AnnouncementBar {...props}/>);

            expect(setPropertySpy).toHaveBeenCalledWith('--announcement-bar-count', '1');
            expect(addClassSpy).toHaveBeenCalledWith('announcement-bar--fixed');

            wrapper.unmount();

            expect(removeClassSpy).toHaveBeenCalledWith('announcement-bar--fixed');
            expect(removePropertySpy).toHaveBeenCalledWith('--announcement-bar-count');
        });
    });
});
