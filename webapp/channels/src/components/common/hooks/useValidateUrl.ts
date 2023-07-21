// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import debounce from 'lodash/debounce';
import {useState, useRef, useEffect} from 'react';

import {Client4} from 'mattermost-redux/client';

function makeIdGetter() {
    let id = Number.MIN_SAFE_INTEGER;
    return function idGetter(): number {
        id++;
        return id;
    };
}

type DebounceOptions = {
    interval?: number;
    trailing?: boolean;
    leading?: boolean;
}

const defaultDebounceOptions = {
    interval: 333,
    trailing: true,
    leading: true,
};

type ValidateUrlOptions = {
    doAsyncCheck: boolean;
    debounceOptions: DebounceOptions;
}

const defaultValidateUrlOptions = {
    doAsyncCheck: true,
    debounceOptions: defaultDebounceOptions,
};

type UrlValidator = {
    verifying: boolean;
    result: ValidationResult;
    validate: (url: string) => void;
}

type VerifyingStatus = {
    verifying: boolean;
    eventId: number;
}

type ValidationResult = {
    valid: boolean;
    error: string | null;
    inferredProtocol: 'https' | 'http' | null;
}

function synchronousChecks(url: string): [boolean, string | null] {
    if (!url.length) {
        return [false, 'Empty'];
    }
    return [true, null];
}

const makeValidator = (options: ValidateUrlOptions) => debounce((
    reportResult: (result: ValidationResult) => void,
    url: string,
) => {
    const [newValid, newError] = synchronousChecks(url);
    if (!newValid || !options.doAsyncCheck) {
        reportResult({
            valid: newValid,
            error: newError,
            inferredProtocol: null,
        });
        return;
    }

    let effectiveUrl = url;
    let inferredProtocol: 'http' | 'https' | null = null;
    if (effectiveUrl.startsWith('localhost')) {
        effectiveUrl = 'http://' + effectiveUrl;
        inferredProtocol = 'http';
    } else if (!effectiveUrl.startsWith('http://') && !effectiveUrl.startsWith('https://')) {
        effectiveUrl = 'https://' + effectiveUrl;
        inferredProtocol = 'https';
    }

    Client4.testSiteURL(effectiveUrl).then(() => {
        reportResult({
            valid: true,
            error: null,
            inferredProtocol,
        });
    }).catch((error: Error) => {
        reportResult({
            valid: false,
            error: error.message,
            inferredProtocol,
        });
    });
}, options.debounceOptions.interval, {trailing: options.debounceOptions.trailing, leading: options.debounceOptions.leading});

export default function useValidateUrl(options: ValidateUrlOptions = defaultValidateUrlOptions): UrlValidator {
    const [verifying, setVerifying] = useState<VerifyingStatus>({verifying: false, eventId: Number.MIN_SAFE_INTEGER});
    const [result, setResult] = useState<ValidationResult>({
        valid: false,
        error: null,
        inferredProtocol: null,
    });
    const {current: getId} = useRef<() => number>(makeIdGetter());
    const validateRef = useRef(makeValidator(options));
    useEffect(() => {
        validateRef.current = makeValidator(options);
    }, [options]);

    return {
        result,
        verifying: verifying.verifying,
        validate: (url: string) => {
            const eventId = getId();

            setVerifying((presentVerifying: VerifyingStatus) => {
                if (presentVerifying.eventId > eventId) {
                    return presentVerifying;
                }
                return {
                    verifying: true,
                    eventId,
                };
            });

            const reportResult = (result: ValidationResult) => {
                setVerifying((presentVerifying: VerifyingStatus) => {
                    if (presentVerifying.eventId > eventId) {
                        return presentVerifying;
                    }
                    setResult(result);
                    return {verifying: false, eventId};
                });
            };

            validateRef.current(reportResult, url);
        },
    };
}
