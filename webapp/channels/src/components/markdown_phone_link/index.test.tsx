// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {RootHtmlPortalId} from 'utils/constants';

import MarkdownPhoneLink from './index';

class TestLinkTooltip extends React.PureComponent<{href: string}> {
    render() {
        if (this.props.href.startsWith('tel:')) {
            return <div>{'Phone tooltip'}</div>;
        }

        return null;
    }
}

describe('MarkdownPhoneLink', () => {
    test('should render the link with a phone icon and the label text', () => {
        const {container} = renderWithContext(
            <MarkdownPhoneLink
                href='tel:+34600517276'
                className='theme markdown__link'
                target='_blank'
                rel='noreferrer'
            >
                {'+34 600 517 276'}
            </MarkdownPhoneLink>,
        );

        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('href', 'tel:+34600517276');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noreferrer');
        expect(link).toHaveClass('markdown-phone-link', 'theme', 'markdown__link');
        expect(link).toHaveTextContent('+34 600 517 276');
        expect(container.querySelector('svg')).toBeInTheDocument();
    });

    test('should drop the tel: prefix when the text is the raw href', () => {
        renderWithContext(<MarkdownPhoneLink href='tel:+34600517276'>{'tel:+34600517276'}</MarkdownPhoneLink>);

        expect(screen.getByRole('link')).toHaveTextContent(/^\+34600517276$/);
    });

    test('should keep a label that happens to start with tel:', () => {
        renderWithContext(<MarkdownPhoneLink href='tel:+34600517276'>{'tel: call us'}</MarkdownPhoneLink>);

        expect(screen.getByRole('link')).toHaveTextContent('tel: call us');
    });

    test('should show a call tooltip on hover', async () => {
        renderWithContext(<MarkdownPhoneLink href='tel:+34600517276'>{'Call the office'}</MarkdownPhoneLink>);

        await userEvent.hover(screen.getByRole('link'));
        await waitFor(() => {
            expect(screen.getByText('Click to call +34600517276')).toBeVisible();
        });
    });

    test('should show plugin link tooltips on a single link when hasPluginTooltips is set', async () => {
        const state = {
            plugins: {
                components: {
                    LinkTooltip: [{id: 'test', pluginId: 'example.test', component: TestLinkTooltip}],
                },
            },
        };

        const {container} = renderWithContext(
            <>
                <MarkdownPhoneLink
                    href='tel:+34600517276'
                    className='theme markdown__link'
                    hasPluginTooltips={true}
                >
                    {'+34600517276'}
                </MarkdownPhoneLink>
                <div id={RootHtmlPortalId}/>
            </>,
            state,
        );

        const links = container.querySelectorAll('a');
        expect(links).toHaveLength(1);
        expect(links[0]).toHaveAttribute('href', 'tel:+34600517276');
        expect(links[0]).toHaveClass('markdown-phone-link', 'theme', 'markdown__link');
        expect(links[0].querySelector('svg')).toBeInTheDocument();

        await userEvent.hover(screen.getByText('+34600517276'));
        await waitFor(() => {
            expect(screen.queryByText('Phone tooltip')).toBeVisible();
        });
        expect(screen.queryByText(/Click to call/)).not.toBeInTheDocument();
    });
});
