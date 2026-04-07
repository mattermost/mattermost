// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderHookWithContext} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import {useExternalLink} from './use_external_link';

const baseCurrentUserId = 'someUserId';
const baseTelemetryId = 'someTelemetryId';

function getBaseState(): DeepPartial<GlobalState> {
    return {
        entities: {
            users: {
                currentUserId: baseCurrentUserId,
            },
            general: {
                config: {
                    TelemetryId: baseTelemetryId,
                },
                license: {
                    Cloud: 'true',
                },
            },
        },
    };
}

describe('useExternalLink', () => {
    it('keep non mattermost links untouched', async () => {
        const url = 'https://www.someLink.com/something?query1=2#anchor';
        const {result: {current: [href, queryParams]}} = await renderHookWithContext(() => useExternalLink(url, 'some location', {utm_source: 'something'}), getBaseState());
        expect(href).toEqual(url);
        expect(queryParams).toEqual({});
    });

    it('mailto links are untouched even if to mattermost emails', async () => {
        const mailtoURL = 'mailto:example@mattermost.com?subject=123&body=456';
        const {result: {current: [mailtoHref, mailtoQueryParams]}} = await renderHookWithContext(() => useExternalLink(mailtoURL), getBaseState());
        expect(mailtoHref).toEqual(mailtoURL);
        expect(mailtoQueryParams).toEqual({});
    });

    it('all base queries are set correctly', async () => {
        const url = 'https://www.mattermost.com/some/url';
        const {result: {current: [href, queryParams]}} = await renderHookWithContext(() => useExternalLink(url), getBaseState());
        const parsedLink = new URL(href);
        expect(parsedLink.searchParams.get('utm_source')).toBe('mattermost');
        expect(parsedLink.searchParams.get('utm_medium')).toBe('in-product-cloud');
        expect(parsedLink.searchParams.get('utm_content')).toBe('');
        expect(parsedLink.searchParams.get('uid')).toBe(baseCurrentUserId);
        expect(parsedLink.searchParams.get('sid')).toBe(baseTelemetryId);
        expect(queryParams.utm_source).toBe('mattermost');
        expect(queryParams.utm_medium).toBe('in-product-cloud');
        expect(queryParams.utm_content).toBe('');
        expect(queryParams.uid).toBe(baseCurrentUserId);
        expect(queryParams.sid).toBe(baseTelemetryId);
        expect(href.split('?')[0]).toBe(url);
    });

    it('provided location is added to the params', async () => {
        const url = 'https://www.mattermost.com/some/url';
        const location = 'someLocation';
        const {result: {current: [href, queryParams]}} = await renderHookWithContext(() => useExternalLink(url, location), getBaseState());
        const parsedLink = new URL(href);
        expect(parsedLink.searchParams.get('utm_content')).toBe(location);
        expect(queryParams.utm_content).toBe(location);
    });

    it('non cloud environments set the proper utm medium', async () => {
        const url = 'https://www.mattermost.com/some/url';
        const state = getBaseState();
        state.entities!.general!.license!.Cloud = 'false';
        const {result: {current: [href, queryParams]}} = await renderHookWithContext(() => useExternalLink(url), state);
        const parsedLink = new URL(href);
        expect(parsedLink.searchParams.get('utm_medium')).toBe('in-product');
        expect(queryParams.utm_medium).toBe('in-product');
    });

    it('keep existing query parameters untouched', async () => {
        const url = 'https://www.mattermost.com/some/url?myParameter=true';
        const {result: {current: [href, queryParams]}} = await renderHookWithContext(() => useExternalLink(url), getBaseState());
        const parsedLink = new URL(href);
        expect(parsedLink.searchParams.get('myParameter')).toBe('true');
        expect(queryParams.myParameter).toBe('true');
    });

    it('keep anchors untouched', async () => {
        const url = 'https://www.mattermost.com/some/url?myParameter=true#myAnchor';
        const {result: {current: [href]}} = await renderHookWithContext(() => useExternalLink(url), getBaseState());
        const parsedLink = new URL(href);
        expect(parsedLink.hash).toBe('#myAnchor');
    });

    it('overwriting params gets preference over default params', async () => {
        const url = 'https://www.mattermost.com/some/url';
        const location = 'someLocation';
        const expectedContent = 'someOtherLocation';
        const expectedSource = 'someOtherSource';
        const {result: {current: [href, queryParams]}} = await renderHookWithContext(() => useExternalLink(url, location, {utm_content: expectedContent, utm_source: expectedSource}), getBaseState());
        const parsedLink = new URL(href);
        expect(parsedLink.searchParams.get('utm_content')).toBe(expectedContent);
        expect(queryParams.utm_content).toBe(expectedContent);
        expect(parsedLink.searchParams.get('utm_source')).toBe(expectedSource);
        expect(queryParams.utm_source).toBe(expectedSource);
    });

    it('existing params gets preference over default and overwritten params', async () => {
        const location = 'someLocation';
        const overwrittenContent = 'someOtherLocation';
        const overwrittenSource = 'someOtherSource';
        const expectedContent = 'differentLocation';
        const expectedSource = 'differentSource';
        const url = `https://www.mattermost.com/some/url?utm_content=${expectedContent}&utm_source=${expectedSource}`;

        const {result: {current: [href, queryParams]}} = await renderHookWithContext(() => useExternalLink(url, location, {utm_content: overwrittenContent, utm_source: overwrittenSource}), getBaseState());
        const parsedLink = new URL(href);
        expect(parsedLink.searchParams.get('utm_content')).toBe(expectedContent);
        expect(queryParams.utm_content).toBe(expectedContent);
        expect(parsedLink.searchParams.get('utm_source')).toBe(expectedSource);
        expect(queryParams.utm_source).toBe(expectedSource);
    });

    it('results are stable between re-renders', async () => {
        const url = 'https://www.mattermost.com/some/url';
        const overwriteQueryParams = {utm_content: 'overwrittenContent', utm_source: 'overwrittenSource'};

        const {result, rerender} = await renderHookWithContext(() => useExternalLink(url, 'someLocation', overwriteQueryParams), getBaseState());
        const [firstHref, firstParams] = result.current;
        rerender();
        const [secondHref, secondParams] = result.current;
        expect(firstHref).toBe(secondHref);
        expect(firstParams).toBe(secondParams);
    });

    it('do not substitute %20 on query params', async () => {
        const url = 'https://www.mattermost.com/some/url?subject=hello%20world';
        const {result: {current: [href]}} = await renderHookWithContext(() => useExternalLink(url), getBaseState());
        expect(href).toContain('subject=hello%20world');
    });

    it('do not error on invalid URLs', async () => {
        const invalidUrl = 'not a valid url';
        const {result: {current: [href, queryParams]}} = await renderHookWithContext(() => useExternalLink(invalidUrl), getBaseState());
        expect(href).toBe(invalidUrl);
        expect(queryParams).toEqual({});
    });

    it('do not modify arbitrary links that happen to include mattermost.com', async () => {
        const invalidUrl = 'https://example.com/mattermost.com';
        const {result: {current: [href, queryParams]}} = await renderHookWithContext(() => useExternalLink(invalidUrl), getBaseState());
        expect(href).toBe(invalidUrl);
        expect(queryParams).toEqual({});
    });

    it('do not modify mailto links on mattermost.com', async () => {
        const mailtoUrl = 'mailto:support@mattermost.com';
        const {result: {current: [href, queryParams]}} = await renderHookWithContext(() => useExternalLink(mailtoUrl), getBaseState());
        expect(href).toBe(mailtoUrl);
        expect(queryParams).toEqual({});
    });
});
