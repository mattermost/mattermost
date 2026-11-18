import React from 'react';

// an overloaded helper: its first declarations are signatures, the last one has the body
function withText(testId: string): string;
function withText(testId: string | undefined): string | undefined;
function withText(testId: string | undefined): string | undefined {
    return testId ? `${testId}--text` : undefined;
}

export function Overloaded({testId}: {testId?: string}) {
    return <span data-testid={withText(testId)}/>;
}

export function OverloadedUser() {
    return <Overloaded testId='values.overloaded.message'/>;
}
