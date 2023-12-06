'use strict';
const YAML = require('yaml');
const fs = require('fs');

class MergeDefinitions {
    constructor() {}

    /**
     * Write YAML data to the specified file
     * @param filename {String}
     * @param data {Record<String, any>}
     */
    writeFile(filename, data) {
        fs.writeFileSync(filename, YAML.stringify(data, { lineWidth: 0 }).trimEnd());
        console.log("wrote file " + filename);
    }

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
     * Merge OpenAPI schema definitions
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
        // read definitions.yaml
        const parsed = this.readFile(args[2]);
        // read schemas.yaml
        const schemas = this.readFile("schemas.yaml");
        // read responses.yaml
        const responses = this.readFile("responses.yaml");
        // read securitySchemes.yaml
        const securitySchemes = this.readFile("securitySchemes.yaml");
        // merge schemas with definitions.yaml
        parsed["components"]["schemas"] = Object.assign(parsed["components"]["schemas"], schemas);
        // merge responses with definitions.yaml
        parsed["components"]["responses"] = Object.assign(parsed["components"]["responses"], responses);
        // merge securitySchemes with definitions.yaml
        parsed["components"]["securitySchemes"] = Object.assign(parsed["components"]["securitySchemes"], securitySchemes);
        // write merged definitions to a new file
        this.writeFile("merged-definitions.yaml", parsed);
    }
}

new MergeDefinitions().run(process.argv);
