"use strict";

var child_process = require("child_process"),
    fs = require("fs"),
    path = require("path");

var rootDir = path.resolve(__dirname, "../.."),
    upstreamDir = process.env.PROTOBUF_UPSTREAM || path.join(__dirname, "upstream"),
    outputDir = path.join(__dirname, "generated"),
    outputFile = path.join(outputDir, "messages.js"),
    importRoots = [
        "src",
        "conformance",
        "conformance/test_protos",
        "editions/golden"
    ],
    schemaFiles = [
        "conformance/conformance.proto",
        "src/google/protobuf/test_messages_proto2.proto",
        "src/google/protobuf/test_messages_proto3.proto",
        "conformance/test_protos/test_messages_edition2023.proto",
        "editions/golden/test_messages_proto2_editions.proto",
        "editions/golden/test_messages_proto3_editions.proto"
    ];

if (!fs.existsSync(upstreamDir)) {
    console.error("missing upstream protobuf checkout: " + upstreamDir);
    process.exit(1);
}

upstreamDir = path.resolve(upstreamDir);

fs.mkdirSync(outputDir, { recursive: true });

runPbjs(importRoots.map(fromUpstream), schemaFiles.map(fromUpstream));

function fromUpstream(relativePath) {
    return path.join(upstreamDir, relativePath);
}

function runPbjs(importPaths, protoFiles) {
    var args = [
        path.join(rootDir, "cli/bin/pbjs"),
        "-t", "static-module",
        "-w", "commonjs",
        "--dependency", "../../../minimal",
        "-o", outputFile
    ];

    importPaths.forEach(function(importPath) {
        args.push("-p", importPath);
    });
    Array.prototype.push.apply(args, protoFiles);

    var result = child_process.spawnSync(process.execPath, args, {
        cwd: rootDir,
        stdio: "inherit"
    });

    if (result.error)
        throw result.error;

    process.exit(result.status || 0);
}
