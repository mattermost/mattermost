// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import AnchoredTourPoint from './anchored_tour_point';

describe('AnchoredTourPoint', () => {
    it('keeps the closed dot under modals and still offers it as a button', () => {
        renderWithContext(
            <>
                <button id='burnOnReadButton'>{'Burn-on-read'}</button>
                <div id='root-portal'/>
                <AnchoredTourPoint
                    anchorId='burnOnReadButton'
                    aim='center'
                    title={'Tip'}
                    closeLabel={'Close'}
                    onClose={() => {}}
                    primaryAction={{label: 'Got it', onClick: () => {}}}
                    testId='anchored-tour'
                >
                    {'Body'}
                </AnchoredTourPoint>
            </>,
        );

        const tour = screen.getByTestId('anchored-tour');
        expect(tour).toHaveStyle({zIndex: '1000'});
        expect(screen.getByRole('button', {name: 'Open tip'})).toBeInTheDocument();
        expect(screen.queryByText('Tip')).not.toBeInTheDocument();
    });
});
