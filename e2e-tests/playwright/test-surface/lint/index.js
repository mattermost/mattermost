// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import disableReason from './e2e-disable-reason.js';
import noFloatingActions from './e2e-no-floating-actions.js';
import noLiteralLocators from './e2e-no-literal-locators.js';
import noLocatorAction from './e2e-no-locator-action.js';
import observeActions from './e2e-observe-actions.js';
import {conditionalLogic, positionalPicks, probes, sleeps, softAssertions, swallowedCatch, urlAssertions} from './e2e-patterns.js';
import webapp from './webapp.js';

export default {
    rules: {
        'e2e-disable-reason': disableReason,
        'e2e-no-conditional-logic': conditionalLogic,
        'e2e-no-floating-actions': noFloatingActions,
        'e2e-no-literal-locators': noLiteralLocators,
        'e2e-no-locator-action': noLocatorAction,
        'e2e-no-positional-picks': positionalPicks,
        'e2e-no-probes': probes,
        'e2e-no-sleeps': sleeps,
        'e2e-no-soft-assertions': softAssertions,
        'e2e-no-swallowed-catch': swallowedCatch,
        'e2e-no-url-assertions': urlAssertions,
        'e2e-observe-actions': observeActions,
        ...webapp.rules,
    },
};
