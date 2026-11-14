// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import {Client4} from 'mattermost-redux/client';

import {act, fireEvent, renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import SiteUrl, {getHostHint, isValidSiteUrl, normalizeSiteUrl} from './site_url';
import {Animations} from './steps';

describe('normalizeSiteUrl', () => {
    test.each([
        ['chat.example.com', 'https:', 'https://chat.example.com'],
        ['chat.example.com', 'http:', 'http://chat.example.com'],
        ['  chat.example.com:8065/ ', 'http:', 'http://chat.example.com:8065'],
        ['http://chat.example.com', 'https:', 'http://chat.example.com'],
        ['https://chat.example.com/', 'http:', 'https://chat.example.com'],
    ])('%s with %s', (input, protocol, expected) => {
        expect(normalizeSiteUrl(input, protocol)).toBe(expected);
    });
});

describe('isValidSiteUrl', () => {
    test.each([
        'https://chat.example.com',
        'http://chat.example.com:8065',
        'https://chat.example.com:443',
        'http://10.0.0.1',
        'http://[::1]:8065',
        'http://localhost:8065',
    ])('accepts %s', (url) => {
        expect(isValidSiteUrl(url)).toBe(true);
    });

    test.each([
        'https://chat.example.com/mattermost',
        'https://chat.example.com?a=b',
        'https://chat.example.com#top',
        'https://user:pass@chat.example.com',
        'ftp://chat.example.com',
        'https://',
        'https://:8065',
        'https://chat.example.com:0',
        'https://chat.example.com:65536',
        'https://chat.example.com:',
        'https://exa%41mple.com',
        'https://chat example.com',
    ])('rejects %s', (url) => {
        expect(isValidSiteUrl(url)).toBe(false);
    });
});

describe('getHostHint', () => {
    test.each([
        ['http://localhost:8065', 'loopback'],
        ['http://127.0.0.1', 'loopback'],
        ['http://127.1.2.3:8065', 'loopback'],
        ['http://[::1]:8065', 'loopback'],
        ['http://10.0.0.1:8065', 'ip'],
        ['https://192.168.1.10', 'ip'],
        ['http://[2001:db8::1]', 'ip'],
        ['https://chat.example.com', null],
        ['https://127.example.com', null],
    ])('%s', (url, expected) => {
        expect(getHostHint(url)).toBe(expected);
    });
});

describe('components/preparing_workspace/site_url', () => {
    const loopbackHint = /This address only works on this computer/;
    const ipHint = /An IP address works, but a domain name is easier to share/;

    let next: jest.Mock;
    let skip: jest.Mock;
    let testSiteURL: jest.SpyInstance;

    // Keeps the URL in state, like the wizard does.
    const Wrapper = ({initialUrl, show = true}: {initialUrl: string; show?: boolean}) => {
        const [url, setUrl] = useState(initialUrl);
        return (
            <SiteUrl
                show={show}
                transitionDirection={Animations.Reasons.EnterFromBefore}
                next={next}
                skip={skip}
                url={url}
                setUrl={setUrl}
            />
        );
    };

    const renderStep = (initialUrl = 'https://chat.example.com') => renderWithContext(<Wrapper initialUrl={initialUrl}/>);

    const replaceUrl = async (url: string) => {
        await userEvent.clear(screen.getByRole('textbox'));
        await userEvent.type(screen.getByRole('textbox'), url);
    };

    beforeEach(() => {
        next = jest.fn();
        skip = jest.fn();
        testSiteURL = jest.spyOn(Client4, 'testSiteURL').mockResolvedValue({status: 'OK'});
    });

    afterEach(() => {
        testSiteURL.mockRestore();
    });

    test('shows the URL it is given, the help text, and no hint for a domain name', () => {
        renderStep();

        expect(screen.getByRole('textbox')).toHaveValue('https://chat.example.com');
        expect(screen.getByText('Standard ports, such as 80 and 443, can be omitted, but non-standard ports are required')).toBeInTheDocument();
        expect(screen.queryByText(loopbackHint)).not.toBeInTheDocument();
        expect(screen.queryByText(ipHint)).not.toBeInTheDocument();
    });

    test('shows the loopback hint for localhost', () => {
        renderStep('http://localhost:8065');

        expect(screen.getByText(loopbackHint)).toBeInTheDocument();
        expect(screen.queryByText(ipHint)).not.toBeInTheDocument();
    });

    test('shows the IP address hint while the host is an IP address', async () => {
        renderStep();

        await replaceUrl('10.0.0.1:8065');
        expect(screen.getByText(ipHint)).toBeInTheDocument();
        expect(screen.queryByText(loopbackHint)).not.toBeInTheDocument();

        await replaceUrl('chat.example.com');
        expect(screen.queryByText(ipHint)).not.toBeInTheDocument();
    });

    test('rejects a URL with a path without testing it', async () => {
        renderStep();

        await replaceUrl('https://chat.example.com/mattermost');
        await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

        const error = /Enter only http:\/\/ or https:\/\/, a host name, and an optional port/;
        expect(screen.getByRole('status')).toHaveTextContent(error);
        expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByRole('textbox')).toHaveAccessibleDescription(error);
        expect(testSiteURL).not.toHaveBeenCalled();
        expect(next).not.toHaveBeenCalled();

        await userEvent.type(screen.getByRole('textbox'), 'x');
        expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'false');
        expect(screen.getByRole('textbox')).not.toHaveAccessibleDescription();
    });

    test('tests the URL once and advances when the test succeeds', async () => {
        renderStep();

        await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

        await waitFor(() => expect(next).toHaveBeenCalledTimes(1));
        expect(testSiteURL).toHaveBeenCalledTimes(1);
        expect(testSiteURL).toHaveBeenCalledWith('https://chat.example.com');
        expect(screen.getByText('Test successful. This is a valid URL.')).toBeInTheDocument();
    });

    test('adds the browser protocol to a URL without one before testing it', async () => {
        renderStep();

        await replaceUrl('chat.example.com/');
        expect(testSiteURL).not.toHaveBeenCalled();
        await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

        await waitFor(() => expect(next).toHaveBeenCalled());
        expect(testSiteURL).toHaveBeenCalledWith(`${window.location.protocol}//chat.example.com`);
        expect(screen.getByRole('textbox')).toHaveValue(`${window.location.protocol}//chat.example.com`);
    });

    test('shows Testing URL while the test runs', async () => {
        testSiteURL.mockReturnValue(new Promise(() => {}));
        renderStep();

        await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

        expect(screen.getByText('Testing URL')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Continue'})).toBeDisabled();
        expect(next).not.toHaveBeenCalled();
    });

    test('resets a running test when the admin leaves the step and comes back', async () => {
        testSiteURL.mockReturnValue(new Promise(() => {}));
        const {rerender} = renderStep();

        await userEvent.click(screen.getByRole('button', {name: 'Continue'}));
        expect(screen.getByText('Testing URL')).toBeInTheDocument();

        rerender(<Wrapper initialUrl='https://chat.example.com'/>);
        rerender(
            <Wrapper
                initialUrl='https://chat.example.com'
                show={false}
            />,
        );
        rerender(<Wrapper initialUrl='https://chat.example.com'/>);

        expect(await screen.findByRole('button', {name: 'Continue'})).toBeEnabled();
        expect(screen.queryByText('Testing URL')).not.toBeInTheDocument();
    });

    test('treats a test that takes too long as failed', async () => {
        jest.useFakeTimers();
        try {
            testSiteURL.mockReturnValue(new Promise(() => {}));
            renderStep();

            fireEvent.click(screen.getByRole('button', {name: 'Continue'}));
            expect(screen.getByText('Testing URL')).toBeInTheDocument();

            await act(async () => {
                jest.advanceTimersByTime(10000);
            });

            expect(screen.getByText('Test unsuccessful. Mattermost couldn’t reach this URL.')).toBeInTheDocument();
            expect(screen.getByRole('button', {name: 'Use anyway'})).toBeInTheDocument();
            expect(next).not.toHaveBeenCalled();
        } finally {
            jest.useRealTimers();
        }
    });

    test('shows Use anyway when the test fails, and Use anyway advances', async () => {
        testSiteURL.mockRejectedValue(new Error('unreachable'));
        renderStep();

        expect(screen.queryByRole('button', {name: 'Use anyway'})).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

        expect(await screen.findByText('Test unsuccessful. Mattermost couldn’t reach this URL.')).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('Test unsuccessful. Mattermost couldn’t reach this URL.');
        expect(next).not.toHaveBeenCalled();

        await userEvent.click(screen.getByRole('button', {name: 'Use anyway'}));
        expect(next).toHaveBeenCalledTimes(1);
        expect(testSiteURL).toHaveBeenCalledTimes(1);
    });

    test('hides Use anyway again once the URL is edited', async () => {
        testSiteURL.mockRejectedValue(new Error('unreachable'));
        renderStep();

        await userEvent.click(screen.getByRole('button', {name: 'Continue'}));
        expect(await screen.findByRole('button', {name: 'Use anyway'})).toBeInTheDocument();

        await userEvent.type(screen.getByRole('textbox'), 'x');
        expect(screen.queryByRole('button', {name: 'Use anyway'})).not.toBeInTheDocument();
        expect(screen.queryByText('Test unsuccessful. Mattermost couldn’t reach this URL.')).not.toBeInTheDocument();
    });

    test('always shows the skip button', async () => {
        testSiteURL.mockRejectedValue(new Error('unreachable'));
        renderStep();

        expect(screen.getByRole('button', {name: 'I’ll do this later'})).toBeInTheDocument();

        await replaceUrl('https://chat.example.com/path');
        await userEvent.click(screen.getByRole('button', {name: 'Continue'}));
        expect(screen.getByRole('button', {name: 'I’ll do this later'})).toBeInTheDocument();

        await replaceUrl('https://chat.example.com');
        await userEvent.click(screen.getByRole('button', {name: 'Continue'}));
        await screen.findByRole('button', {name: 'Use anyway'});
        await userEvent.click(screen.getByRole('button', {name: 'I’ll do this later'}));
        expect(skip).toHaveBeenCalledTimes(1);
    });
});
