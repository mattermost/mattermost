// A component library known only by its declarations and its published test-parts.json.
type TestIdProps = {testId?: string};
export declare function Modal(props: TestIdProps & {title: string; onClose?: () => void; onBack?: () => void; showBackButton?: boolean; children?: any; 'data-testid'?: string}): any;
export declare function Button(props: TestIdProps & {onClick?: () => void; children?: any; 'data-testid'?: string}): any;
export declare function IconButton(props: TestIdProps & {toggled?: boolean; onClick?: () => void; 'aria-label': string}): any;
export declare function Tabs(props: TestIdProps & {tabs: Array<{key: string; label: string}>; activeKey: string; onChange: (key: string) => void}): any;
