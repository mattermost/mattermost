import React from 'react';

// props path, destructuring default
export function Leaf({testId = 'values.leaf.default--button'}: {testId?: string}) {
    return <button data-testid={testId}/>;
}

// props.a.b through an object literal at the usage
export function Deep(props: {ids: {main: string}}) {
    return <span data-testid={props.ids.main}/>;
}

// rest props spread onto a child component
export function Wrapper({label, ...rest}: {label: string; testId?: string}) {
    return <Leaf {...rest}/>;
}

// class component: this.props, read inside an arrow class property
export class Panel extends React.Component<{prefix: string}> {
    renderClose = () => <button data-testid={`${this.props.prefix}.close--button`}/>;
    render() {
        return this.renderClose();
    }
}

// `a ?? b`: the fallback only applies to instances where `a` is missing
export function Fallback({id, 'data-testid': dataTestId}: {id: string; 'data-testid'?: string}) {
    return <span data-testid={dataTestId ?? id}/>;
}

export function FallbackUses() {
    return (
        <div>
            <Fallback
                id='legacy_id'
                data-testid='values.fallback.given--text'
            />
            <Fallback id='values.fallback.from_id--text'/>
        </div>
    );
}
