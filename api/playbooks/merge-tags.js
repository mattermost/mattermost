'use strict';
const YAML = require('yaml');
const fs = require('fs');

class MergeTags {
    constructor() {}

    /**
     * Read a YAML file, parse it, and return the resulting object
     * @param filename {String} The YAML file to read
     * @returns {Record<String,any>} The parsed object
     */
    readFile(filename) {
        const rawYaml = fs.readFileSync(filename);
        console.log("read file " + filename);
        return YAML.parse(rawYaml.toString());
    }

    /**
     * Merge OpenAPI tags
     * @param args {Array<String>} Program arguments
     */
    run(args) {
        if (args.length < 3) {
            console.error("please specify an input file");
            return;
        }
        if (args[2] === "") {
            console.error("input file not specified");
            return;
        }
        // read introduction.yaml
        const parsed = this.readFile(args[2]);
        // read tags.yaml
        const tags = this.readFile("tags.yaml");
        if ("tags" in parsed) {
            parsed["tags"].push(...tags["tags"]);
        }
        if ("x-tagGroups" in parsed) {
            parsed["x-tagGroups"].push(...tags["x-tagGroups"]);
        }
        // Convert the modified object back to YAML and remove the trailing "null" as we want the
        // "paths" field to have no value at this stage of building.
        const yamlString =
            YAML.stringify(parsed, { lineWidth: 0 }).
                replace(/^paths:.*null.*$/mg, "paths: ");
        // write out to merged-tags.yaml
        fs.writeFileSync("merged-tags.yaml", yamlString);
        console.log("wrote file merged-tags.yaml");
    }
}

new MergeTags().run(process.argv);
