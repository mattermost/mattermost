
declare type Maybe<T> = T | undefined | null;

type DeepPartial<T> = {
    [P in keyof T]?: DeepPartial<T[P]>;
}
