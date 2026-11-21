// Minimal ambient React/Redux/router types for scanner fixtures.
declare module 'react' {
    export type ReactNode = any;
    export type FC<P = {}> = (props: P) => any;
    export function useState<T>(v: T): [T, (v: T) => void];
    export function useMemo<T>(f: () => T, deps: unknown[]): T;
    export function useCallback<T>(f: T, deps: unknown[]): T;
    export function useEffect(f: () => void, deps?: unknown[]): void;
    export function memo<T>(c: T): T;
    export function forwardRef<T>(c: T): T;
    export function lazy<T>(f: () => Promise<{default: T}>): T;
    export class Component<P = {}, S = {}> {
        constructor(props: P);
        props: P;
        state: S;
        setState(s: Partial<S>): void;
    }
    const React: {Component: typeof Component; memo: typeof memo; forwardRef: typeof forwardRef; lazy: typeof lazy; useState: typeof useState};
    export default React;
}
declare module 'react-redux' {
    export function connect(a?: unknown, b?: unknown): <T>(c: T) => T;
    export function useSelector<T>(f: (state: any) => T): T;
    export function useDispatch(): (a: unknown) => any;
}
declare module 'redux' {
    export function bindActionCreators<T>(o: T, dispatch: unknown): T;
}
declare module 'react-router-dom' {
    export function useHistory(): {push(p: string): void};
    export function Route(props: {path: string; component?: unknown; render?: (p: unknown) => any; children?: any}): any;
    export function Switch(props: {children?: any}): any;
    export function Link(props: {to: string; children?: any; [k: string]: any}): any;
    export function NavLink(props: {to: string; children?: any; [k: string]: any}): any;
}
declare namespace JSX {
    interface IntrinsicElements {
        [k: string]: any;
    }
    interface Element {}
    interface ElementAttributesProperty {
        props: {};
    }
    interface ElementChildrenAttribute {
        children: {};
    }
}
