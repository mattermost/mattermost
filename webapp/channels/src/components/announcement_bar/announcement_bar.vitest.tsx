// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import AnnouncementBar from 'components/announcement_bar/default_announcement_bar/announcement_bar';

import {render} from 'tests/vitest_react_testing_utils';

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
        message: <span>{'text'}</span>,
        announcementBarCount: 0,
        actions: {
            sendVerificationEmail: vi.fn(),
            incrementAnnouncementBarCount: vi.fn(),
            decrementAnnouncementBarCount: vi.fn(),
        },
    };

    test('should match snapshot, bar showing', () => {
        const props = baseProps;
        const {container} = render(
            <AnnouncementBar {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, bar not showing', () => {
        const props = {...baseProps, enableBanner: false};
        const {container} = render(
            <AnnouncementBar {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, bar showing, no dismissal', () => {
        const props = {...baseProps, allowBannerDismissal: false};
        const {container} = render(
            <AnnouncementBar {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, props change', () => {
        const props = baseProps;
        const {container, rerender} = render(
            <AnnouncementBar {...props}/>,
        );

        expect(container).toMatchSnapshot();

        const newProps = {...baseProps, bannerColor: 'yellow', bannerTextColor: 'red'};
        rerender(<AnnouncementBar {...newProps}/>);
        expect(container).toMatchSnapshot();

        const newProps2 = {...newProps, allowBannerDismissal: false};
        rerender(<AnnouncementBar {...newProps2}/>);
        expect(container).toMatchSnapshot();

        const newProps3 = {...newProps2, enableBanner: false};
        rerender(<AnnouncementBar {...newProps3}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, dismissal', () => {
        const props = baseProps;
        const {container, rerender} = render(
            <AnnouncementBar {...props}/>,
        );

        // Banner should show
        expect(container).toMatchSnapshot();

        // Banner should remain hidden
        const newProps = {...baseProps, bannerColor: 'yellow', bannerTextColor: 'red'};
        rerender(<AnnouncementBar {...newProps}/>);
        expect(container).toMatchSnapshot();

        // Banner should return
        const newProps2 = {...newProps, bannerText: 'Some new text'};
        rerender(<AnnouncementBar {...newProps2}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, admin configured bar', () => {
        const props = {...baseProps, enableBanner: true, bannerText: 'Banner text'};
        const {container} = render(
            <div>
                <AnnouncementBar {...props}/>
                <AnnouncementBar
                    {...props}
                    className='admin-announcement'
                />
            </div>,
        );

        expect(container).toMatchSnapshot();
    });

    describe('announcement bar count and CSS management', () => {
        let setPropertySpy: ReturnType<typeof vi.spyOn>;
        let removePropertySpy: ReturnType<typeof vi.spyOn>;
        let addClassSpy: ReturnType<typeof vi.spyOn>;
        let removeClassSpy: ReturnType<typeof vi.spyOn>;

        beforeEach(() => {
            // Mock DOM methods
            setPropertySpy = vi.spyOn(document.documentElement.style, 'setProperty');
            removePropertySpy = vi.spyOn(document.documentElement.style, 'removeProperty');
            addClassSpy = vi.spyOn(document.body.classList, 'add');
            removeClassSpy = vi.spyOn(document.body.classList, 'remove');
        });

        afterEach(() => {
            vi.restoreAllMocks();
        });

        test('should set CSS custom property and add class on mount', () => {
            const props = {...baseProps, announcementBarCount: 0};
            render(<AnnouncementBar {...props}/>);

            expect(setPropertySpy).toHaveBeenCalledWith('--announcement-bar-count', '1');
            expect(addClassSpy).toHaveBeenCalledWith('announcement-bar--fixed');
            expect(props.actions.incrementAnnouncementBarCount).toHaveBeenCalled();
        });

        test('should update CSS custom property when announcement bar count changes', () => {
            const props = {...baseProps, announcementBarCount: 1};
            const {rerender} = render(<AnnouncementBar {...props}/>);

            // Reset spies after mount
            setPropertySpy.mockClear();
            addClassSpy.mockClear();

            // Update props to simulate count change
            const newProps = {...props, announcementBarCount: 2};
            rerender(<AnnouncementBar {...newProps}/>);

            expect(setPropertySpy).toHaveBeenCalledWith('--announcement-bar-count', '2');
            expect(addClassSpy).toHaveBeenCalledWith('announcement-bar--fixed');
        });

        test('should remove class and custom property when count reaches 0', () => {
            const props = {...baseProps, announcementBarCount: 1};
            const {rerender} = render(<AnnouncementBar {...props}/>);

            // Reset spies after mount
            setPropertySpy.mockClear();
            removeClassSpy.mockClear();

            // Update props to simulate count reaching 0
            const newProps = {...props, announcementBarCount: 0};
            rerender(<AnnouncementBar {...newProps}/>);

            expect(removeClassSpy).toHaveBeenCalledWith('announcement-bar--fixed');
        });

        test('should maintain class when count is greater than 0', () => {
            const props = {...baseProps, announcementBarCount: 2};
            const {rerender} = render(<AnnouncementBar {...props}/>);

            // Reset spies after mount
            setPropertySpy.mockClear();
            addClassSpy.mockClear();
            removeClassSpy.mockClear();

            // Update props to simulate count change from 2 to 1
            const newProps = {...props, announcementBarCount: 1};
            rerender(<AnnouncementBar {...newProps}/>);

            expect(setPropertySpy).toHaveBeenCalledWith('--announcement-bar-count', '1');
            expect(addClassSpy).toHaveBeenCalledWith('announcement-bar--fixed');
            expect(removeClassSpy).not.toHaveBeenCalled();
        });

        test('should properly clean up on unmount when last bar', () => {
            const props = {...baseProps, announcementBarCount: 1};
            const {unmount} = render(<AnnouncementBar {...props}/>);

            // Reset spies after mount
            removeClassSpy.mockClear();
            removePropertySpy.mockClear();

            unmount();

            expect(props.actions.decrementAnnouncementBarCount).toHaveBeenCalled();
            expect(removeClassSpy).toHaveBeenCalledWith('announcement-bar--fixed');
            expect(removePropertySpy).toHaveBeenCalledWith('--announcement-bar-count');
        });

        test('should update count but maintain class on unmount when other bars remain', () => {
            const props = {...baseProps, announcementBarCount: 2};
            const {unmount} = render(<AnnouncementBar {...props}/>);

            // Reset spies after mount
            setPropertySpy.mockClear();
            removeClassSpy.mockClear();
            removePropertySpy.mockClear();

            unmount();

            expect(props.actions.decrementAnnouncementBarCount).toHaveBeenCalled();
            expect(setPropertySpy).toHaveBeenCalledWith('--announcement-bar-count', '1');
            expect(removeClassSpy).not.toHaveBeenCalled();
            expect(removePropertySpy).not.toHaveBeenCalled();
        });

        test('should handle undefined announcement bar count gracefully', () => {
            const props = {...baseProps, announcementBarCount: undefined};
            const {unmount} = render(<AnnouncementBar {...props}/>);

            expect(setPropertySpy).toHaveBeenCalledWith('--announcement-bar-count', '1');
            expect(addClassSpy).toHaveBeenCalledWith('announcement-bar--fixed');

            unmount();

            expect(removeClassSpy).toHaveBeenCalledWith('announcement-bar--fixed');
            expect(removePropertySpy).toHaveBeenCalledWith('--announcement-bar-count');
        });
    });
});
