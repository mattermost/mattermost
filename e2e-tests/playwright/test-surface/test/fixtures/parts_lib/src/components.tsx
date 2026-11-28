import React, {useState} from 'react';

function useControllable<T>(value: T | undefined, initial: T, onChange?: (v: T) => void): [T, (v: T) => void] {
    const [v, setV] = useState(value ?? initial);
    return [v, (next: T) => {
        setV(next);
        onChange?.(next);
    }];
}

export function IconButton({testId, toggled, onClick, ...rest}: {testId?: string; toggled?: boolean; onClick?: () => void; 'aria-label': string}) {
    return (
        <button
            data-testid={toggled === undefined ? (testId ? `${testId}--button` : undefined) : (testId ? `${testId}--togglebutton` : undefined)}
            {...rest}
            aria-pressed={toggled === undefined ? undefined : toggled}
            onClick={onClick}
        />
    );
}

function Header({testId, onClose}: {testId?: string; onClose?: () => void}) {
    return (
        <div>
            <IconButton
                aria-label='Close'
                data-testid={(testId ? `${testId}.close--button` : undefined)}
                onClick={() => onClose?.()}
            />
        </div>
    );
}

export function Modal({testId, onClose, children, ...rest}: {testId?: string; onClose?: () => void; children?: any}) {
    return (
        <div
            data-testid={(testId ? `${testId}--dialog` : undefined)}
            {...rest}
            role='dialog'
        >
            <Header
                testId={testId}
                onClose={onClose}
            />
            {children}
        </div>
    );
}

export function Tabs({testId, tabs, value, onChange}: {testId?: string; tabs: Array<{key: string}>; value?: string; onChange?: (k: string) => void}) {
    const [, setValue] = useControllable(value, '', onChange);
    return (
        <div data-testid={(testId ? `${testId}` : undefined)}>
            {tabs.map((t) => (
                <button
                    key={t.key}
                    role='tab'
                    data-testid={(testId ? `${testId}.tab:${t.key}--tab` : undefined)}
                    onClick={() => setValue(t.key)}
                />
            ))}
        </div>
    );
}

export function Wrapper(props: {testId?: string; onClose?: () => void}) {
    return <Modal {...props}/>;
}

export function Plain(props: {label: string}) {
    const {label, ...rest} = props;
    return <a href='#' {...rest}>{label}</a>;
}
