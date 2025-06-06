// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/// <reference types="cypress" />

declare namespace Cypress {
    interface Chainer<Subject> {
        (chainer: 'be.focusVisible', {exactStyles}: {exactStyles?: boolean}): Chainable<Subject>;

        (chainer: 'not.be.focusVisible', {exactStyles}: {exactStyles?: boolean}): Chainable<Subject>;
    }
}
