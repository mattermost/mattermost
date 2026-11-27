// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import userEvent from '@testing-library/user-event';
import React from 'react';

import type {EntityCard} from '@mattermost/types/posts';

import {renderWithContext} from 'tests/react_testing_utils';

import EntityCardView from './entity_card';

jest.mock('components/block_renderer', () => ({
    BlockRenderer: () => <div data-testid='block-renderer'/>,
}));
jest.mock('components/block_renderer/translation/mm_block', () => ({
    translateMMBlocks: (blocks: unknown[]) => blocks,
}));
jest.mock('components/external_link', () => ({
    __esModule: true,
    default: ({children, href, ...rest}: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
        <a
            href={href}
            {...rest}
        >{children}</a>
    ),
}));

describe('EntityCardView', () => {
    const baseCard: EntityCard = {
        type_id: 'mm:time',
        value: '2024-06-01T15:04:05Z',
        title: 'Timestamp',
        instant: Date.parse('2024-06-01T15:04:05Z'),
        blocks: [{type: 'text', text: '**UTC:** 15:04 UTC'}],
        url: 'https://example.com/time',
        rows: [{label: 'URL', value: 'https://example.com/time'}],
    };

    it('renders the blocks body and still shows the card url', () => {
        const {getByTestId} = renderWithContext(
            <EntityCardView card={baseCard}/>,
        );

        expect(getByTestId('entity-card')).toBeInTheDocument();
        expect(getByTestId('entity-card-blocks')).toBeInTheDocument();
        expect(getByTestId('entity-card-link')).toHaveAttribute('href', 'https://example.com/time');
    });

    it('opens a typed row value as another entity', async () => {
        const onOpen = jest.fn();
        const card: EntityCard = {
            type_id: 'com.mattermost.cyberlens:cve',
            value: 'CVE-2021-44228',
            title: 'Log4Shell',
            rows: [{
                label: 'CVSS 3.1 vector',
                value: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H',
                type_id: 'com.mattermost.cyberlens:cvss',
            }],
        };
        const {getByRole} = renderWithContext(
            <EntityCardView
                card={card}
                onOpen={onOpen}
            />,
        );
        await userEvent.click(getByRole('button', {name: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H'}));
        expect(onOpen).toHaveBeenCalledWith({
            typeId: 'com.mattermost.cyberlens:cvss',
            value: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H',
            label: 'CVSS 3.1 vector',
        });
    });

    it('renders a related term as its link and opens a typed value that has none', async () => {
        const onOpen = jest.fn();
        const card: EntityCard = {
            ...baseCard,
            related: [
                {label: 'Glossary', text: 'MLT', type_id: 'com.example:acronym', url: '/conflux/team/pages/abcdefghijklmnopqrstuvwxyz'},
                {label: 'When', text: '16:30 CET', type_id: 'mm:time'},
            ],
        };
        const {getByRole} = renderWithContext(
            <EntityCardView
                card={card}
                onOpen={onOpen}
            />,
        );

        const term = getByRole('link', {name: 'MLT'});
        expect(term).toHaveAttribute('href', '/conflux/team/pages/abcdefghijklmnopqrstuvwxyz');
        await userEvent.click(term);
        expect(onOpen).not.toHaveBeenCalled();

        await userEvent.click(getByRole('button', {name: '16:30 CET'}));
        expect(onOpen).toHaveBeenCalledWith({typeId: 'mm:time', value: '16:30 CET', label: 'When'});
    });

    it('hops related entities on value when display text includes a name', async () => {
        const onOpen = jest.fn();
        const card: EntityCard = {
            ...baseCard,
            related: [{
                label: 'CWE',
                text: 'CWE-502 Deserialization of Untrusted Data',
                value: 'CWE-502',
                type_id: 'com.mattermost.cyberlens:cwe',
            }],
        };
        const {getByRole} = renderWithContext(
            <EntityCardView
                card={card}
                onOpen={onOpen}
            />,
        );

        await userEvent.click(getByRole('button', {name: 'CWE-502 Deserialization of Untrusted Data'}));
        expect(onOpen).toHaveBeenCalledWith({
            typeId: 'com.mattermost.cyberlens:cwe',
            value: 'CWE-502',
            label: 'CWE',
        });
    });

    it('renders related below sections', () => {
        const card: EntityCard = {
            type_id: 'com.mattermost.cyberlens:cwe',
            value: 'CWE-502',
            title: 'Deserialization of Untrusted Data',
            sections: [{title: 'Mitigations', count: 1, items: [{head: 'M1', text: 'Validate'}]}],
            related: [{label: 'Parent', text: 'CWE-913', type_id: 'com.mattermost.cyberlens:cwe'}],
        };
        const {container, getByText} = renderWithContext(
            <EntityCardView card={card}/>,
        );
        const html = container.textContent || '';
        expect(html.indexOf('Mitigations')).toBeGreaterThan(-1);
        expect(html.indexOf('Related')).toBeGreaterThan(html.indexOf('Mitigations'));
        expect(getByText('Parent')).toBeInTheDocument();
        expect(getByText('CWE-913')).toBeInTheDocument();
    });

    it('renders section link labels with head and host', () => {
        const card: EntityCard = {
            type_id: 'com.mattermost.cyberlens:cwe',
            value: 'CWE-502',
            title: 'Deserialization of Untrusted Data',
            sections: [{
                title: 'Observed examples',
                count: 1,
                items: [{head: 'CVE-2021-44228', text: 'Log4Shell', url: 'https://www.cve.org/CVERecord?id=CVE-2021-44228'}],
            }],
        };
        const {getByRole, getByText} = renderWithContext(
            <EntityCardView card={card}/>,
        );
        expect(getByRole('link', {name: 'CVE-2021-44228 — www.cve.org'})).toBeInTheDocument();
        expect(getByText('Log4Shell')).toBeInTheDocument();
    });

    it('uses FIRST CVSS qualitative colors for the severity chrome', () => {
        const card: EntityCard = {
            type_id: 'com.mattermost.cyberlens:cve',
            value: 'CVE-2021-44228',
            title: 'Log4Shell',
            severity: 'CRITICAL',
            score: '10.0',
        };
        const {getByTestId} = renderWithContext(
            <EntityCardView card={card}/>,
        );
        expect(getByTestId('entity-severity')).toHaveStyle({background: '#cc0500'});
    });
});
