// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen} from '@testing-library/react';
import React from 'react';
import {IntlProvider} from 'react-intl';

import Tag from './tag';
import {BetaTag, BotTag, GuestTag} from './tag_presets';
import TagGroup from './tag_group';

// Test wrapper with IntlProvider
const renderWithIntl = (ui: React.ReactElement) => {
    return render(
        <IntlProvider locale='en' messages={{}}>
            {ui}
        </IntlProvider>,
    );
};

describe('TagGroup', () => {
    it('should render children', () => {
        renderWithIntl(
            <TagGroup>
                <Tag text='Tag 1' testId='tag-1'/>
                <Tag text='Tag 2' testId='tag-2'/>
            </TagGroup>,
        );
        expect(screen.getByTestId('tag-1')).toBeInTheDocument();
        expect(screen.getByTestId('tag-2')).toBeInTheDocument();
    });

    it('should apply base TagGroup class', () => {
        const {container} = renderWithIntl(
            <TagGroup>
                <Tag text='Test'/>
            </TagGroup>,
        );
        const group = container.firstChild as HTMLElement;
        expect(group).toHaveClass('TagGroup');
    });

    it('should apply custom className', () => {
        const {container} = renderWithIntl(
            <TagGroup className='custom-group'>
                <Tag text='Test'/>
            </TagGroup>,
        );
        const group = container.firstChild as HTMLElement;
        expect(group).toHaveClass('TagGroup');
        expect(group).toHaveClass('custom-group');
    });

    it('should apply testId attribute', () => {
        renderWithIntl(
            <TagGroup testId='my-tag-group'>
                <Tag text='Test'/>
            </TagGroup>,
        );
        expect(screen.getByTestId('my-tag-group')).toBeInTheDocument();
    });

    it('should render multiple tags', () => {
        renderWithIntl(
            <TagGroup>
                <BetaTag/>
                <BotTag/>
                <GuestTag/>
                <Tag text='Custom' variant='info'/>
            </TagGroup>,
        );
        expect(screen.getByText('BETA')).toBeInTheDocument();
        expect(screen.getByText('BOT')).toBeInTheDocument();
        expect(screen.getByText('GUEST')).toBeInTheDocument();
        expect(screen.getByText('Custom')).toBeInTheDocument();
    });

    it('should handle empty children', () => {
        const {container} = renderWithIntl(<TagGroup>{[]}</TagGroup>);
        expect(container.firstChild).toBeInTheDocument();
    });

    it('should render as div element', () => {
        const {container} = renderWithIntl(
            <TagGroup>
                <Tag text='Test'/>
            </TagGroup>,
        );
        expect(container.firstChild?.nodeName).toBe('DIV');
    });
});

