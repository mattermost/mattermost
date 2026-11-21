// A helper of the project's own named settle: it returns the driver, so its click is an ordinary click.
export function settle<D>(driver: D): D {
    return driver;
}
