// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

export default class PluginInteractiveDialog extends BaseComponent {
    readonly title: Locator;
    readonly submitButton: Locator;
    readonly cancelButton: Locator;
    readonly generalErrorMessage: Locator;
    readonly serverError: Locator;

    constructor(container: Locator) {
        super(container);
        this.title = container.getByRole('heading', {level: 1});
        this.submitButton = container.getByRole('button', {name: en['interactive_dialog.submit']});
        this.cancelButton = container.getByRole('button', {name: en['interactive_dialog.cancel']});
        this.generalErrorMessage = container.getByText(en['apps.error.form.required_fields_empty'], {exact: true});
        // eslint-disable-next-line no-restricted-syntax
        this.serverError = container.locator('.error-text').last();
    }

    textInput(label: string): Locator {
        return this.container.getByLabel(label);
    }

    selectInput(label: string): Locator {
        return this.container.getByLabel(label);
    }

    radioOption(label: string): Locator {
        return this.container.getByRole('radio', {name: label});
    }

    checkboxByLabel(label: string): Locator {
        return this.container.getByRole('checkbox', {name: label});
    }

    dateInput(label: string): Locator {
        return this.container.getByLabel(label);
    }

    getFieldError(testId: string): Locator {
        return this.container.getByTestId(testId).locator('[class*="error"]');
    }

    getOption(name: string): Locator {
        return this.container.page().getByRole('option', {name});
    }
}
