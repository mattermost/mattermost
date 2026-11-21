import React from 'react';

/** One testid rendered at two sites: only the condition both share is the element's. */
export function TwoSites({open, compact, pinned}: {open: boolean; compact: boolean; pinned: boolean}) {
    if (!open) {
        return null;
    }
    if (compact) {
        return <div>{pinned && <button data-testid='header.dismiss--button'>{'x'}</button>}</div>;
    }
    return <section><button data-testid='header.dismiss--button'>{'Close'}</button></section>;
}

/** An early return on a prop with a default: each instance renders one of the two buttons. */
function Follow({iconOnly = false, testId}: {iconOnly?: boolean; testId?: string}) {
    if (iconOnly) {
        return (
            <button
                aria-pressed={true}
                data-testid={testId ? `${testId}--togglebutton` : undefined}
            />
        );
    }
    return <button data-testid={testId ? `${testId}--button` : undefined}>{'Follow'}</button>;
}

export function Follows() {
    return (
        <div>
            <Follow testId='header.follow'/>
            <Follow
                iconOnly={true}
                testId='header.follow_icon'
            />
        </div>
    );
}

/** Props spread through `React.createElement(component || 'input', {...rest})` land on an <input>. */
function Quick({inputComponent, ...rest}: {inputComponent?: React.ElementType; onInput?: () => void; 'data-testid'?: string}) {
    return <div className='wrap'>{React.createElement(inputComponent || 'input', {...rest})}</div>;
}

export function QuickSearch() {
    return (
        <Quick
            data-testid='header.search--textbox'
            onInput={() => {}}
        />
    );
}

// QuickInput's shape: a forwardRef wrapper around a memo component that createElements its `inputComponent`
// (itself a forwardRef that spreads its props onto an <input>)
type QuickProps = {inputComponent?: React.ElementType; value?: string; forwardedRef?: unknown; clearTestId?: string; 'data-testid'?: string};
const LengthInput = React.forwardRef(({maxLength, ...props}: {maxLength?: number; 'data-testid'?: string}, ref: unknown) => (
    <span>
        <input
            ref={ref}
            {...props}
        />
        {maxLength}
    </span>
));
const QuickMemo = React.memo(({inputComponent, value, forwardedRef, clearTestId, ...restProps}: QuickProps) => {
    const inputElement = React.createElement(
        inputComponent || 'input',
        {
            ...restProps,
            ref: forwardedRef,
            defaultValue: value,
        },
    );
    return (
        <div>
            {inputElement}
            <button data-testid={clearTestId ? `${clearTestId}--button` : undefined}/>
        </div>
    );
});
const QuickForwarded = React.forwardRef((props: QuickProps, ref: unknown) => (
    <QuickMemo
        forwardedRef={ref}
        {...props}
    />
));

export function StatusText() {
    return (
        <QuickForwarded
            inputComponent={LengthInput}
            data-testid='header.status--textbox'
            clearTestId='header.status_clear'
        />
    );
}
