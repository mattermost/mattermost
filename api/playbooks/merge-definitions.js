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
        try {
            fs.writeFileSync(filename, YAML.stringify(data, { lineWidth: 0 }).trimEnd());
            console.log("Wrote file " + filename);
        } catch (error) {
            console.error("Error writing file " + filename + ":", error.message);
        }
    }

    /**
     * Read a YAML file, parse it, and return the resulting object
     * @param filename {String} The YAML file to read
     * @returns {Record<String,any>|null} The parsed object
     */
    readFile(filename) {
        try {
            const rawYaml = fs.readFileSync(filename, 'utf8');
            console.log("Read file " + filename);
            return YAML.parse(rawYaml) || {};
        } catch (error) {
            console.error("Error reading file " + filename + ":", error.message);
            return null;
        }
    }

    /**
     * Merge OpenAPI schema definitions
     * @param args {Array<String>} Program arguments
     */
    run(args) {
        if (args.length < 3 || !args[2]) {
            console.error("Please specify an input file");
            return;
        }

        // Read definitions.yaml
        const parsed = this.readFile(args[2]);
        if (!parsed) return;

        // Ensure 'components' structure exists safely
        parsed.components = parsed.components || {};
        parsed.components.schemas = parsed.components.schemas || {};
        parsed.components.responses = parsed.components.responses || {};
        parsed.components.securitySchemes = parsed.components.securitySchemes || {};

        // Read other files safely (defaults to empty object if file fails/missing)
        const schemas = this.readFile("schemas.yaml") || {};
        const responses = this.readFile("responses.yaml") || {};
        const securitySchemes = this.readFile("securitySchemes.yaml") || {};

        // Merge components
        Object.assign(parsed.components.schemas, schemas);
        Object.assign(parsed.components.responses, responses);
        Object.assign(parsed.components.securitySchemes, securitySchemes);

        // Write merged definitions to a new file
        this.writeFile("merged-definitions.yaml", parsed);
    }
}

new MergeDefinitions().run(process.argv);
