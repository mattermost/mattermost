// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as Utils from 'utils/utils';

export default class ValidationResult {
    result: boolean;
    text: string;
    textDefault: string;

    constructor(result: boolean, text: string, textDefault: string) {
        this.result = result;
        this.text = text;
        this.textDefault = textDefault;
    }

    public isValid(): boolean {
        return this.result;
    }

    public error(): string|null {
        if (this.result) {
            return null;
        }
        return Utils.localizeMessage(this.text, this.textDefault);
    }
}
