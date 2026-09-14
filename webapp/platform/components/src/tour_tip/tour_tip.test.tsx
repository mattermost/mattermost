// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen, waitFor} from '@testing-library/react';
import React, {type ComponentProps} from 'react';

import {TourTip} from './tour_tip';

import {wrapIntl} from '../testUtils';

const ROOT_PORTAL_ID = 'root-portal';
const capturedAppendTo: HTMLElement[] = [];

jest.mock('./tour_tip_backdrop', () => {
    const actual = jest.requireActual('./tour_tip_backdrop') as typeof import('./tour_tip_backdrop');
    return {
        TourTipBackdrop: (props: React.ComponentProps<typeof actual.TourTipBackdrop>) => {
            capturedAppendTo.push(props.appendTo);
            return actual.TourTipBackdrop(props);
        },
    };
});

type TourTipProps = ComponentProps<typeof TourTip>;

function createRootPortal() {
    const existing = document.getElementById(ROOT_PORTAL_ID);
    if (existing) {
        existing.remove();
    }
    const portal = document.createElement('div');
    portal.id = ROOT_PORTAL_ID;
    document.body.appendChild(portal);
    return portal;
}

function removeRootPortal() {
    document.getElementById(ROOT_PORTAL_ID)?.remove();
}

function renderTourTip(overrideProps: Partial<TourTipProps> = {}) {
    const props: TourTipProps = {
        show: true,
        screen: <span>{'Tip body'}</span>,
        title: <span>{'Tip title'}</span>,
        step: 0,
        overlayPunchOut: null,
        singleTip: true,
        showOptOut: false,
        ...overrideProps,
    };

    return render(wrapIntl(<TourTip {...props}/>));
}

describe('TourTip', () => {
    beforeAll(() => {
        global.ResizeObserver = class ResizeObserver {
            observe() {/* no-op */}
            unobserve() {/* no-op */}
            disconnect() {/* no-op */}
        };
    });

    afterEach(() => {
        capturedAppendTo.length = 0;
        removeRootPortal();
    });

    test('renders the popover when show is true and hides it when show is false', async () => {
        const {rerender} = renderTourTip({show: true});

        expect(await screen.findByRole('dialog')).toBeInTheDocument();
        expect(screen.getByTestId('current_tutorial_tip')).toBeInTheDocument();

        rerender(wrapIntl(
            <TourTip
                show={false}
                screen={<span>{'Tip body'}</span>}
                title={<span>{'Tip title'}</span>}
                step={0}
                overlayPunchOut={null}
                singleTip={true}
                showOptOut={false}
            />,
        ));

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    test('renders the arrow and resolved placement on the floating box', async () => {
        renderTourTip({placement: 'bottom-start'});

        const dialog = await screen.findByRole('dialog');
        expect(dialog).toHaveClass('tour-tip__box');
        expect(dialog.querySelector('.tour-tip__arrow')).toBeInTheDocument();
        expect(dialog).toHaveAttribute('data-placement');
        expect(dialog.getAttribute('data-placement')).toMatch(/^(top|bottom|left|right)(-start|-end)?$/);
    });

    test('sets dialog ARIA attributes labelled by the title', async () => {
        renderTourTip();

        const dialog = await screen.findByRole('dialog');
        const labelledBy = dialog.getAttribute('aria-labelledby');

        expect(labelledBy).toBeTruthy();
        expect(document.getElementById(labelledBy!)).toHaveTextContent('Tip title');
    });

    test('portals the backdrop into root-portal when that node exists', async () => {
        const portal = createRootPortal();
        renderTourTip();

        await screen.findByRole('dialog');

        expect(portal.querySelector('.tour-tip__backdrop')).toBeInTheDocument();
        expect(portal.querySelector('.tour-tip__overlay')).toBeInTheDocument();
    });

    test('falls back to document.body for the backdrop when root-portal is missing', async () => {
        expect(document.getElementById(ROOT_PORTAL_ID)).toBeNull();

        renderTourTip();

        await screen.findByRole('dialog');

        expect(capturedAppendTo[0]).toBe(document.body);
        expect(document.querySelector('.tour-tip__backdrop')).toBeInTheDocument();
    });

    test('does not apply a transform on the trigger when pulsatingDotTranslate is undefined', () => {
        renderTourTip({pulsatingDotTranslate: undefined});

        const trigger = document.getElementById('tipButton');
        expect(trigger).toBeInTheDocument();
        expect(trigger).not.toHaveStyle({transform: 'translate(undefinedpx, undefinedpx)'});
        expect(trigger?.style.transform).toBe('');
    });

    test('applies the pulsating-dot translate when provided', () => {
        renderTourTip({pulsatingDotTranslate: {x: 5, y: -8}});

        expect(document.getElementById('tipButton')).toHaveStyle({
            transform: 'translate(5px, -8px)',
        });
    });
});
