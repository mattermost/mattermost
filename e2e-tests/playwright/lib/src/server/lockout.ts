// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {runMmctlLocal} from '../containers/mmctl_container';

import {testConfig} from '@/test_config';

type LockoutFix = {
    reason: string;
    risk: string;
    settings: Record<string, string>;
    /** Applies only if `mmctl --local config get <key>` returns `value`; the error id is not specific. */
    onlyIf?: {key: string; value: string};
};

/** Settings that lock the admin out, keyed by the server error id they cause, with the mmctl --local fix. */
const LOCKOUT_FIXES: Record<string, LockoutFix> = {
    // Login: unverified email.
    'api.user.login.not_verified.app_error': {
        reason: 'email verification is required and the admin email is unverified',
        risk: 'blocks login for any user with an unverified email, admin included',
        settings: {'EmailSettings.RequireEmailVerification': 'false'},
    },
    // Login: enrolled in MFA.
    'mfa.validate_token.authenticate.app_error': {
        reason: 'MFA is enabled and the admin is enrolled',
        risk: 'blocks login for an admin enrolled in MFA',
        settings: {
            'ServiceSettings.EnableMultifactorAuthentication': 'false',
            'ServiceSettings.EnforceMultifactorAuthentication': 'false',
        },
    },
    // Login: username sign-in disabled.
    'api.user.login.invalid_credentials_email': {
        reason: 'sign-in with username is disabled and the admin logs in by username',
        risk: 'blocks admin login by username',
        settings: {'EmailSettings.EnableSignInWithUsername': 'true'},
        onlyIf: {key: 'EmailSettings.EnableSignInWithUsername', value: 'false'},
    },
    // API: MFA enforced, admin not enrolled.
    'api.context.mfa_required.app_error': {
        reason: 'MFA is enforced and the admin is not enrolled',
        risk: 'blocks every API call for an admin not enrolled in MFA',
        settings: {
            'ServiceSettings.EnableMultifactorAuthentication': 'false',
            'ServiceSettings.EnforceMultifactorAuthentication': 'false',
        },
    },
};

/** Risk of setting `key` to `value`, or undefined if safe. */
export function describeLockoutRisk(key: string, value: unknown): string | undefined {
    const risks = new Set<string>();
    for (const fix of Object.values(LOCKOUT_FIXES)) {
        if (key in fix.settings && String(value) !== fix.settings[key]) {
            risks.add(fix.risk);
        }
    }
    return risks.size > 0 ? [...risks].join(' and ') : undefined;
}

function serverErrorId(error: unknown): string | undefined {
    return (error as {server_error_id?: string} | null)?.server_error_id;
}

/** Clears the lockout `error` indicates; false for unknown errors, throws if the fix fails. */
export async function clearAdminLockout(error: unknown): Promise<boolean> {
    const fix = LOCKOUT_FIXES[serverErrorId(error) ?? ''];
    if (!fix) {
        return false;
    }

    if (fix.onlyIf) {
        // Cannot confirm without a container.
        if (!testConfig.mattermostContainerId || testConfig.adminUsername.includes('@')) {
            return false;
        }
        const current = await runMmctlLocal(['config', 'get', fix.onlyIf.key]);
        if (current.exitCode !== 0 || current.output.trim() !== fix.onlyIf.value) {
            return false;
        }
    }

    if (!testConfig.mattermostContainerId) {
        throw new Error(
            `Admin is locked out: ${fix.reason}, and there is no server container to run mmctl --local in. ` +
                `Turn off ${Object.keys(fix.settings).join(', ')} manually.`,
        );
    }

    for (const [key, value] of Object.entries(fix.settings)) {
        const result = await runMmctlLocal(['config', 'set', key, value]);
        if (result.exitCode !== 0) {
            throw new Error(`Admin is locked out (${fix.reason}) and setting ${key} failed: ${result.output}`);
        }
    }

    return true;
}
