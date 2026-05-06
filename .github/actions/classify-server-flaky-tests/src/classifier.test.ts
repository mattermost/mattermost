import {buildMarkdown, classifyFlakyTests} from "./classifier";

function testcase(name: string, classname: string, failed = false): string {
    if (failed) {
        return `<testcase classname="${classname}" name="${name}"><failure>failed</failure></testcase>`;
    }

    return `<testcase classname="${classname}" name="${name}"></testcase>`;
}

describe("classifyFlakyTests", () => {
    it("excludes one failure then pass", () => {
        const flakyTests = classifyFlakyTests(
            "<testsuite>" +
                testcase("TestOneRetry", "pkg/example", true) +
                testcase("TestOneRetry", "pkg/example") +
                "</testsuite>",
        );

        expect(flakyTests).toEqual([]);
    });

    it("includes two failures then pass", () => {
        const flakyTests = classifyFlakyTests(
            "<testsuite>" +
                testcase("TestTwoRetries", "pkg/example", true) +
                testcase("TestTwoRetries", "pkg/example", true) +
                testcase("TestTwoRetries", "pkg/example") +
                "</testsuite>",
        );

        expect(flakyTests).toEqual([
            {
                failedAttempts: 2,
                key: {
                    classname: "pkg/example",
                    file: "",
                    name: "TestTwoRetries",
                },
            },
        ]);
    });

    it("includes three failures then pass", () => {
        const flakyTests = classifyFlakyTests(
            "<testsuite>" +
                testcase("TestThreeRetries", "pkg/example", true) +
                testcase("TestThreeRetries", "pkg/example", true) +
                testcase("TestThreeRetries", "pkg/example", true) +
                testcase("TestThreeRetries", "pkg/example") +
                "</testsuite>",
        );

        expect(flakyTests).toEqual([
            {
                failedAttempts: 3,
                key: {
                    classname: "pkg/example",
                    file: "",
                    name: "TestThreeRetries",
                },
            },
        ]);
    });

    it("excludes four failed attempts", () => {
        const flakyTests = classifyFlakyTests(
            "<testsuite>" +
                testcase("TestPersistentFailure", "pkg/example", true) +
                testcase("TestPersistentFailure", "pkg/example", true) +
                testcase("TestPersistentFailure", "pkg/example", true) +
                testcase("TestPersistentFailure", "pkg/example", true) +
                "</testsuite>",
        );

        expect(flakyTests).toEqual([]);
    });

    it("excludes pass only", () => {
        const flakyTests = classifyFlakyTests(
            "<testsuite>" + testcase("TestPass", "pkg/example") + "</testsuite>",
        );

        expect(flakyTests).toEqual([]);
    });

    it("groups same test name by classname", () => {
        const flakyTests = classifyFlakyTests(
            "<testsuite>" +
                testcase("TestDuplicateName", "pkg/one", true) +
                testcase("TestDuplicateName", "pkg/one", true) +
                testcase("TestDuplicateName", "pkg/one") +
                testcase("TestDuplicateName", "pkg/two", true) +
                testcase("TestDuplicateName", "pkg/two") +
                "</testsuite>",
        );

        expect(flakyTests).toHaveLength(1);
        expect(flakyTests[0].key.classname).toBe("pkg/one");
    });

    it("supports flakyFailure elements", () => {
        const flakyTests = classifyFlakyTests(`
            <testsuite>
              <testcase classname="pkg/example" name="TestFlakyFailure">
                <flakyFailure>first failed attempt</flakyFailure>
                <flakyFailure>second failed attempt</flakyFailure>
              </testcase>
            </testsuite>
        `);

        expect(flakyTests).toEqual([
            {
                failedAttempts: 2,
                key: {
                    classname: "pkg/example",
                    file: "",
                    name: "TestFlakyFailure",
                },
            },
        ]);
    });
});

describe("buildMarkdown", () => {
    it("renders markdown metacharacters as inert table text", () => {
        const markdown = buildMarkdown([
            {
                failedAttempts: 2,
                key: {
                    classname: "pkg|example & <b>tag</b>",
                    file: "",
                    name: "Test[spoof](https://example.com) *bold* `code` _u_ ~s~\nPipe|Bang!",
                },
            },
        ]);

        expect(markdown).toContain(
            "| Test&#91;spoof&#93;&#40;https://example.com&#41; &#42;bold&#42; &#96;code&#96; &#95;u&#95; &#126;s&#126; Pipe&#124;Bang&#33; | pkg&#124;example &amp; &lt;b&gt;tag&lt;/b&gt; | 2 |",
        );
    });
});
