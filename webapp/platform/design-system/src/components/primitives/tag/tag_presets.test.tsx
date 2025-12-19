// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen} from '@testing-library/react';
import React from 'react';
import {IntlProvider} from 'react-intl';

import {BetaTag, BotTag, GuestTag} from './tag_presets';

// Test wrapper with IntlProvider only (no Redux needed - pure components)
const renderWithIntl = (ui: React.ReactElement) => {
    return render(
        <IntlProvider locale='en' messages={{}}>
            {ui}
        </IntlProvider>,
    );
};

// Mock WithTooltip component
jest.mock('../with_tooltip', () => {
    return function WithTooltip({title, children}: {title: React.ReactNode; children: React.ReactNode}) {
        return (
            <div data-testid='tooltip-wrapper' title={String(title)}>
                {children}
            </div>
        );
    };
});

describe('Preset Tag Wrappers', () => {
    describe('BetaTag', () => {
        it('should render beta preset with default size', () => {
            renderWithIntl(<BetaTag/>);
            expect(screen.getByText('BETA')).toBeInTheDocument();
        });

        it('should apply custom size', () => {
            const {container} = renderWithIntl(<BetaTag size='lg'/>);
            const tag = container.querySelector('.Tag--lg');
            expect(tag).toBeInTheDocument();
        });

        it('should apply custom variant', () => {
            const {container} = renderWithIntl(<BetaTag variant='success'/>);
            const tag = container.querySelector('.Tag--success');
            expect(tag).toBeInTheDocument();
        });

        it('should apply custom className', () => {
            const {container} = renderWithIntl(<BetaTag className='custom-beta'/>);
            const tag = container.querySelector('.custom-beta');
            expect(tag).toBeInTheDocument();
        });

        it('should render with uppercase', () => {
            const {container} = renderWithIntl(<BetaTag/>);
            const tag = container.querySelector('.Tag--uppercase');
            expect(tag).toBeInTheDocument();
        });

        it('should default to info variant', () => {
            const {container} = renderWithIntl(<BetaTag/>);
            const tag = container.querySelector('.Tag--info');
            expect(tag).toBeInTheDocument();
        });
    });

    describe('BotTag', () => {
        it('should render bot preset with default size', () => {
            renderWithIntl(<BotTag/>);
            expect(screen.getByText('BOT')).toBeInTheDocument();
        });

        it('should apply custom size', () => {
            const {container} = renderWithIntl(<BotTag size='md'/>);
            const tag = container.querySelector('.Tag--md');
            expect(tag).toBeInTheDocument();
        });

        it('should apply custom className', () => {
            const {container} = renderWithIntl(<BotTag className='custom-bot'/>);
            const tag = container.querySelector('.custom-bot');
            expect(tag).toBeInTheDocument();
        });

        it('should render with uppercase', () => {
            const {container} = renderWithIntl(<BotTag/>);
            const tag = container.querySelector('.Tag--uppercase');
            expect(tag).toBeInTheDocument();
        });

        it('should use default variant', () => {
            const {container} = renderWithIntl(<BotTag/>);
            const tag = container.querySelector('.Tag--default');
            expect(tag).toBeInTheDocument();
        });
    });

    describe('GuestTag', () => {
        it('should render guest preset with default size', () => {
            renderWithIntl(<GuestTag/>);
            expect(screen.getByText('GUEST')).toBeInTheDocument();
        });

        it('should apply custom size', () => {
            const {container} = renderWithIntl(<GuestTag size='sm'/>);
            const tag = container.querySelector('.Tag--sm');
            expect(tag).toBeInTheDocument();
        });

        it('should apply custom className', () => {
            const {container} = renderWithIntl(<GuestTag className='custom-guest'/>);
            const tag = container.querySelector('.custom-guest');
            expect(tag).toBeInTheDocument();
        });

        it('should NOT render with uppercase (backward compat)', () => {
            const {container} = renderWithIntl(<GuestTag/>);
            const tag = container.querySelector('.Tag--uppercase');
            expect(tag).not.toBeInTheDocument();
        });

        it('should hide when hide prop is true', () => {
            const {container} = renderWithIntl(<GuestTag hide={true}/>);
            expect(container.firstChild).toBeNull();
        });

        it('should show when hide prop is false', () => {
            renderWithIntl(<GuestTag hide={false}/>);
            expect(screen.getByText('GUEST')).toBeInTheDocument();
        });

        it('should show by default when hide prop is not provided', () => {
            renderWithIntl(<GuestTag/>);
            expect(screen.getByText('GUEST')).toBeInTheDocument();
        });
    });
});
