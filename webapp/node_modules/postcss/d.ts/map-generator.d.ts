import Root from './root';
export default class MapGenerator {
    private stringify;
    private root;
    private opts;
    private mapOpts;
    private previousMaps;
    private map;
    private css;
    constructor(stringify: any, root: Root, opts: any);
    isMap(): boolean;
    previous(): any;
    isInline(): any;
    isSourcesContent(): any;
    clearAnnotation(): void;
    setSourcesContent(): void;
    applyPrevMaps(): void;
    isAnnotation(): any;
    addAnnotation(): void;
    outputFile(): any;
    generateMap(): any[];
    relative(file: any): any;
    sourcePath(node: any): any;
    generateString(): void;
    generate(): any[];
}
