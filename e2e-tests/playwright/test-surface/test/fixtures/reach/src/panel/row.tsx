import React from 'react';

// shared by live code (which passes a scope) and dead code (which gets the legacy default)
export function Row({testId}: {testId?: string}) {
    return <div data-testid={testId ?? 'legacyRow'}/>;
}
