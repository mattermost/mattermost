// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {render, screen} from 'tests/react_testing_utils';

import MarkdownPhoneLink from './index';

describe('MarkdownPhoneLink', () => {
    test('should render the link with a phone icon and the label text', () => {
        const {container} = render(
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
        render(<MarkdownPhoneLink href='tel:+34600517276'>{'tel:+34600517276'}</MarkdownPhoneLink>);

        expect(screen.getByRole('link')).toHaveTextContent(/^\+34600517276$/);
    });

    test('should keep a label that happens to start with tel:', () => {
        render(<MarkdownPhoneLink href='tel:+34600517276'>{'tel: call us'}</MarkdownPhoneLink>);

        expect(screen.getByRole('link')).toHaveTextContent('tel: call us');
    });
});
