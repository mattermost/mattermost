// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

jest.mock('utils/browser_history');

import {shallow} from 'enzyme';
import React from 'react';

import MfaSection from 'components/user_settings/security/mfa_section/mfa_section';
import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import {getHistory} from 'utils/browser_history';

describe('MfaSection', () => {
    const baseProps = {
        active: true,
        areAllSectionsInactive: false,
        mfaActive: false,
        mfaAvailable: true,
        mfaEnforced: false,
        updateSection: jest.fn(),
        actions: {
            deactivateMfa: jest.fn(() => Promise.resolve({})),
        },
    };

    describe('rendering', () => {
        test('should render nothing when MFA is not available', () => {
            const props = {
                ...baseProps,
                mfaAvailable: false,
            };
            const wrapper = shallow(<MfaSection {...props}/>);

            expect(wrapper).toMatchSnapshot();
        });

        test('when section is collapsed and MFA is not active', () => {
            const props = {
                ...baseProps,
                active: false,
                mfaActive: false,
            };
            const wrapper = shallow(<MfaSection {...props}/>);

            expect(wrapper).toMatchSnapshot();
        });

        test('when section is collapsed and MFA is active', () => {
            const props = {
                ...baseProps,
                active: false,
                mfaActive: true,
            };
            const wrapper = shallow(<MfaSection {...props}/>);

            expect(wrapper).toMatchSnapshot();
        });

        test('when section is expanded and MFA is not active', () => {
            const props = {
                ...baseProps,
                mfaActive: false,
            };
            const wrapper = shallow(<MfaSection {...props}/>);

            expect(wrapper).toMatchSnapshot();
        });

        test('when section is expanded and MFA is active but not enforced', () => {
            const props = {
                ...baseProps,
                mfaActive: true,
            };
            const wrapper = shallow(<MfaSection {...props}/>);

            expect(wrapper).toMatchSnapshot();
        });

        test('when section is expanded and MFA is active and enforced', () => {
            const props = {
                ...baseProps,
                mfaActive: true,
                mfaEnforced: true,
            };
            const wrapper = shallow(<MfaSection {...props}/>);

            expect(wrapper).toMatchSnapshot();
        });

        test('when section is expanded with a server error', () => {
            const props = {
                ...baseProps,
                serverError: 'An error occurred',
            };
            const wrapper = shallow(<MfaSection {...props}/>);

            wrapper.setState({serverError: 'An error has occurred'});

            expect(wrapper).toMatchSnapshot();
        });
    });

    describe('setupMfa', () => {
        it('should send to setup page', () => {
            const wrapper = mountWithIntl(<MfaSection {...baseProps}/>);

            const mockEvent = {
                preventDefault: jest.fn(),
            } as unknown as React.MouseEvent<HTMLElement>;

            (wrapper.instance() as MfaSection).setupMfa(mockEvent);

            expect(getHistory().push).toHaveBeenCalledWith('/mfa/setup');
        });
    });

    describe('removeMfa', () => {
        it('on success, should close section and clear state', async () => {
            const wrapper = mountWithIntl(<MfaSection {...baseProps}/>);

            const mockEvent = {
                preventDefault: jest.fn(),
            } as unknown as React.MouseEvent<HTMLElement>;

            wrapper.setState({serverError: 'An error has occurred'});

            await (wrapper.instance() as MfaSection).removeMfa(mockEvent);

            expect(baseProps.updateSection).toHaveBeenCalledWith('');
            expect(wrapper.state('serverError')).toEqual(null);
            expect(getHistory().push).not.toHaveBeenCalled();
        });

        it('on success, should send to setup page if MFA enforcement is enabled', async () => {
            const props = {
                ...baseProps,
                mfaEnforced: true,
            };

            const wrapper = mountWithIntl(<MfaSection {...props}/>);

            const mockEvent = {
                preventDefault: jest.fn(),
            } as unknown as React.MouseEvent<HTMLElement>;

            await (wrapper.instance() as MfaSection).removeMfa(mockEvent);

            expect(baseProps.updateSection).not.toHaveBeenCalled();
            expect(getHistory().push).toHaveBeenCalledWith('/mfa/setup');
        });

        it('on error, should show error', async () => {
            const error = {message: 'An error occurred'};

            const wrapper = mountWithIntl(<MfaSection {...baseProps}/>);

            const mockEvent = {
                preventDefault: jest.fn(),
            } as unknown as React.MouseEvent<HTMLElement>;

            baseProps.actions.deactivateMfa.mockImplementation(() => Promise.resolve({error}));

            await (wrapper.instance() as MfaSection).removeMfa(mockEvent);

            expect(baseProps.updateSection).not.toHaveBeenCalled();
            expect(wrapper.state('serverError')).toEqual(error.message);
        });
    });
});
