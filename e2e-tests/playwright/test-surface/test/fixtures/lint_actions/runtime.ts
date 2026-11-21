// The runtime's shapes the spec rules read, declared as the lib declares them, and a small generated surface.
import type {Locator, Page} from '@playwright/test';

export {expect} from '@playwright/test';

export type Meta = {readonly testId: string; readonly role: string | null};

export declare class Driver {
    readonly locator: Locator;
    readonly meta: Meta;
    press(key: string, ...more: string[]): Promise<void>;
    pressTo<T>(key: string, destination: T): Promise<T>;
    hover(): Promise<void>;
    focus(): Promise<void>;
    blur(): Promise<void>;
}
export declare class ButtonDriver extends Driver {
    click(): Promise<void>;
    clickTo<T>(destination: T): Promise<T>;
}
export declare class TextboxDriver extends Driver {
    fill(value: string): Promise<void>;
    clear(): Promise<void>;
    type(value: string): Promise<void>;
}
export declare class TabDriver extends Driver {
    select(): Promise<void>;
}
export declare class TextDriver extends Driver {}
export type NotRendered = {readonly notRendered: true};
export type Part<D, P> = P extends false ? NotRendered : D;

export declare class Scope<B = unknown> {
    readonly page: Page;
    readonly scope: string;
    protected readonly bind: B;
    get locator(): Locator;
}

export type ApiOp = {readonly op: string};
export declare const Api: {readonly CreatePost: ApiOp; readonly DeletePost: ApiOp};
/** The settled verbs, as the runtime names their type. */
export type Settling<D extends Driver> = {readonly [V in keyof D & ('click' | 'fill')]: (...args: never[]) => Promise<unknown>};
export declare function settle<D extends Driver>(driver: D, opts: {wait: ApiOp}): Settling<D>;
export declare function waitForApi(page: Page, op: ApiOp): Promise<unknown>;
export declare function helper(page: Page): Promise<void>;

export declare class PostMenu<B> extends Scope<B> {
    get deleteMenuItem(): ButtonDriver;
    get editMenuItem(): ButtonDriver;
}
export declare class ConfirmModal<B> extends Scope<B> {
    get confirmButton(): ButtonDriver;
    get nameTextbox(): TextboxDriver;
}
export declare class Post<B> extends Scope<B> {
    get menuButton(): ButtonDriver;
    get deleteModal(): ConfirmModal<B>;
}
export declare class Settings<B> extends Scope<B> {
    get saveButton(): ButtonDriver;
    get nameTextbox(): TextboxDriver;
    get notifyButton(): Part<ButtonDriver, B>;
    tab(key: 'info' | 'notifications'): TabDriver;
    get titleText(): TextDriver;
    get panel(): Scope<B>;
}
export declare class Sidebar<B> extends Scope<B> {
    channel(id: string): ButtonDriver;
}
export declare class App {
    readonly page: Page;
    post(id: string): Post<{}>;
    get postMenu(): PostMenu<{}>;
    get settings(): Settings<{}>;
    get sidebar(): Sidebar<{}>;
}
export declare const app: App;
export declare const page: Page;
