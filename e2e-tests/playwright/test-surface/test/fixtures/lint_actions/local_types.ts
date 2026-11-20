// A project type that shares a name with a Playwright receiver: it is not Playwright's, whatever its path.
export declare class Keyboard {
    press(key: string): Promise<void>;
}
export declare const keyboard: Keyboard;
