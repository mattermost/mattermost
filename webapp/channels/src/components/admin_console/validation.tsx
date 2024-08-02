// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IntlShape, MessageDescriptor} from 'react-intl';

export default class ValidationResult {
    result: boolean;
    text: MessageDescriptor | string;

    constructor(result: boolean, text: MessageDescriptor | string) {
        this.result = result;
        this.text = text;
    }

    public isValid(): boolean {
        return this.result;
    }

    public error(intl: IntlShape): string|null {
        if (this.result) {
            return null;
        }
        if (typeof this.text === 'string') {
            return this.text;
        }
        return intl.formatMessage(this.text);
    }
}
