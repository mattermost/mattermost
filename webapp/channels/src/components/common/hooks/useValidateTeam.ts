// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useState, useRef, useEffect} from 'react';

import debounce from 'lodash/debounce';

import {Client4} from 'mattermost-redux/client';

import {cleanUpUrlable, BadUrlReasons, teamNameToUrl} from 'utils/url';
import Constants from 'utils/constants';

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

type ValidateOptions = {
    doAsyncCheck: boolean;
    debounceOptions: DebounceOptions;
}

const defaultValidateOptions = {
    doAsyncCheck: true,
    debounceOptions: defaultDebounceOptions,
};

type TeamValidator = {
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
    error: false | typeof BadUrlReasons[keyof typeof BadUrlReasons] | string;
}

function synchronousChecks(teamName: string): [boolean, typeof BadUrlReasons[keyof typeof BadUrlReasons] | false] {
    // borrowed from team_url, which has some peculiarities tied to being a part of a two screen UI
    // that allows more variation between team name and url than we allow in usages of this function
    const nameAsUrl = cleanUpUrlable(teamName.trim());

    if (!nameAsUrl.length) {
        return [false, BadUrlReasons.Empty];
    }

    if (nameAsUrl.length < Constants.MIN_TEAMNAME_LENGTH || nameAsUrl.length > Constants.MAX_TEAMNAME_LENGTH) {
        return [false, BadUrlReasons.Length];
    }

    if (Constants.RESERVED_TEAM_NAMES.some((reservedName) => nameAsUrl.startsWith(reservedName))) {
        return [false, BadUrlReasons.Reserved];
    }

    return [true, false];
}

const makeValidator = (options: ValidateOptions) => debounce((
    reportResult: (result: ValidationResult) => void,
    teamName: string,
) => {
    const [newValid, newError] = synchronousChecks(teamName);
    if (!newValid || !options.doAsyncCheck) {
        const result = {
            valid: newValid,
            error: newError,
        };
        if (teamName.length === 1) {
            // in this case, we don't want to bother user if they are still typing
            setTimeout(() => {
                reportResult(result);
            }, 300);
        } else {
            reportResult(result);
        }
        return;
    }

    Client4.checkIfTeamExists(teamNameToUrl(teamName).url).then((response) => {
        if (response.exists) {
            reportResult({
                valid: false,
                error: BadUrlReasons.Taken,
            });
        } else {
            reportResult({
                valid: true,
                error: false,
            });
        }
    }).catch((error: Error) => {
        reportResult({
            valid: false,
            error: error.message,
        });
    });
}, options.debounceOptions.interval, {trailing: options.debounceOptions.trailing, leading: options.debounceOptions.leading});

export default function useValidateTeam(options: ValidateOptions = defaultValidateOptions): TeamValidator {
    const [verifying, setVerifying] = useState<VerifyingStatus>({verifying: false, eventId: Number.MIN_SAFE_INTEGER});
    const [result, setResult] = useState<ValidationResult>({
        valid: false,
        error: false,
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
