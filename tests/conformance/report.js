"use strict";

var fs = require("fs");

var logFile = process.argv[2];
if (!logFile) {
    console.error("usage: node tests/conformance/report.js <conformance-log> [test-list-log]");
    process.exit(1);
}

if (!fs.existsSync(logFile)) {
    console.log("## Protobuf conformance");
    console.log("");
    console.log("No conformance log found.");
    process.exit(0);
}

var logBuffer = fs.readFileSync(logFile),
    log = logBuffer[0] === 0xff && logBuffer[1] === 0xfe
        ? logBuffer.toString("utf16le")
        : logBuffer.toString("utf8"),
    summary = /CONFORMANCE SUITE \w+: (\d+) successes, (\d+) skipped, (\d+) expected failures, (\d+) unexpected failures\./.exec(log),
    requiredFailures = (log.match(/ERROR, test=Required\./g) || []).length,
    recommendedFailures = (log.match(/ERROR, test=Recommended\./g) || []).length;

if (!summary) {
    console.log("## Protobuf conformance");
    console.log("");
    console.log("No conformance summary found.");
    process.exit(0);
}

var successes = Number(summary[1]),
    skipped = Number(summary[2]),
    expectedFailures = Number(summary[3]),
    unexpectedFailures = Number(summary[4]),
    total = successes + unexpectedFailures,
    totals = readCategoryTotals(process.argv[3], total),
    totalPercent = total ? (successes / total * 100).toFixed(2) : "0.00",
    requiredPassing = totals.required ? totals.required - requiredFailures : null,
    recommendedPassing = totals.recommended ? totals.recommended - recommendedFailures : null,
    requiredPercent = totals.required ? (requiredPassing / totals.required * 100).toFixed(2) : null,
    recommendedPercent = totals.recommended ? (recommendedPassing / totals.recommended * 100).toFixed(2) : null,
    notice = "Conformance: "
        + (totals.required ? "required " + requiredPercent + "% (" + requiredPassing + "/" + totals.required + "), " : "")
        + (totals.recommended ? "recommended " + recommendedPercent + "% (" + recommendedPassing + "/" + totals.recommended + "), " : "")
        + "total " + totalPercent + "% (" + successes + "/" + total + ")";

console.log("## Protobuf conformance");
console.log("");
console.log("| Metric | Count |");
console.log("| --- | ---: |");
if (totals.required)
    console.log("| Required passing | " + requiredPercent + "% (" + requiredPassing + "/" + totals.required + ") |");
else
    console.log("| Required failures | " + requiredFailures + " |");
if (totals.recommended)
    console.log("| Recommended passing | " + recommendedPercent + "% (" + recommendedPassing + "/" + totals.recommended + ") |");
else
    console.log("| Recommended failures | " + recommendedFailures + " |");
console.log("| Total passing | " + totalPercent + "% (" + successes + "/" + total + ") |");
console.log("| Skipped | " + skipped + " |");
console.log("| Expected failures | " + expectedFailures + " |");
console.log("| Unexpected failures | " + unexpectedFailures + " |");

if (process.env.GITHUB_ACTIONS)
    console.error("::notice::" + notice);

function readCategoryTotals(testListLogFile, expectedTotal) {
    var testListLogBuffer,
        testListLog,
        firstSuiteEnd,
        required = Object.create(null),
        recommended = Object.create(null),
        match,
        testNamePattern = /SKIPPED, test=(Required|Recommended)\.([^\r\n ]+)/g;

    if (!testListLogFile || !fs.existsSync(testListLogFile))
        return { required: 0, recommended: 0 };

    testListLogBuffer = fs.readFileSync(testListLogFile);
    testListLog = testListLogBuffer[0] === 0xff && testListLogBuffer[1] === 0xfe
        ? testListLogBuffer.toString("utf16le")
        : testListLogBuffer.toString("utf8");
    firstSuiteEnd = testListLog.indexOf("CONFORMANCE SUITE");
    if (firstSuiteEnd >= 0)
        testListLog = testListLog.substring(0, firstSuiteEnd);

    while ((match = testNamePattern.exec(testListLog)) !== null) {
        if (match[1] === "Required")
            required[match[2]] = true;
        else
            recommended[match[2]] = true;
    }

    required = Object.keys(required).length;
    recommended = Object.keys(recommended).length;
    if (required + recommended !== expectedTotal)
        return { required: 0, recommended: 0 };

    return { required: required, recommended: recommended };
}
