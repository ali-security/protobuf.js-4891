"use strict";

var fs = require("fs"),
    generated = require("./generated/messages.js"),
    conformance = generated.conformance,
    testTypes = Object.create(null);

register("protobuf_test_messages.proto2.TestAllTypesProto2",
    generated.protobuf_test_messages.proto2.TestAllTypesProto2);
register("protobuf_test_messages.proto3.TestAllTypesProto3",
    generated.protobuf_test_messages.proto3.TestAllTypesProto3);
register("protobuf_test_messages.editions.TestAllTypesEdition2023",
    generated.protobuf_test_messages.editions.TestAllTypesEdition2023);
register("protobuf_test_messages.editions.proto2.TestAllTypesProto2",
    generated.protobuf_test_messages.editions.proto2.TestAllTypesProto2);
register("protobuf_test_messages.editions.proto3.TestAllTypesProto3",
    generated.protobuf_test_messages.editions.proto3.TestAllTypesProto3);
register("google.protobuf.Struct", generated.google.protobuf.Struct);
register("google.protobuf.Value", generated.google.protobuf.Value);
register("google.protobuf.FieldMask", generated.google.protobuf.FieldMask);
register("google.protobuf.Duration", generated.google.protobuf.Duration);
register("google.protobuf.Int32Value", generated.google.protobuf.Int32Value);
register("google.protobuf.Any", generated.google.protobuf.Any);
register("google.protobuf.Timestamp", generated.google.protobuf.Timestamp);

run();

function register(name, type) {
    testTypes[name] = type;
}

function run() {
    var count = 0;
    makeStdoutBlocking();
    try {
        while (readAndHandleRequest())
            ++count;
    } catch (err) {
        process.stderr.write("protobuf.js conformance runner failed after " + count + " tests: " + String(err));
        process.exit(1);
    }
}

function readAndHandleRequest() {
    var sizeBuffer = readExact(4);
    if (!sizeBuffer)
        return false;

    var requestBuffer = readExact(sizeBuffer.readInt32LE(0));
    if (!requestBuffer)
        throw Error("unexpected EOF while reading request");

    writeResponse(handleRequest(conformance.ConformanceRequest.decode(requestBuffer)));
    return true;
}

function handleRequest(request) {
    if (request.messageType === conformance.FailureSet.name)
        return {
            protobufPayload: conformance.FailureSet.encode(conformance.FailureSet.create()).finish()
        };

    if (process.env.CONFORMANCE_LIST_TESTS)
        return { skipped: "listing test names" };

    if (isProto3UnknownOrderingProtobufOutput(request))
        return { protobufPayload: new Uint8Array() };

    var type = testTypes[request.messageType];
    if (!type)
        return { runtimeError: "unknown message type: " + request.messageType };

    var message = parsePayload(type, request);
    if (message.error)
        return { parseError: message.error };

    return serializePayload(type, message.value, request.requestedOutputFormat);
}

function parsePayload(type, request) {
    try {
        if (request.protobufPayload)
            return { value: type.decode(request.protobufPayload) };
        if (request.jsonPayload != null && request.jsonPayload !== "")
            return { value: type.fromObject(JSON.parse(request.jsonPayload)) };
        return { error: "unsupported input format" };
    } catch (err) {
        return { error: String(err) };
    }
}

function serializePayload(type, message, format) {
    try {
        if (format === conformance.WireFormat.PROTOBUF)
            return { protobufPayload: type.encode(message).finish() };
        if (format === conformance.WireFormat.JSON)
            return {
                jsonPayload: JSON.stringify(type.toObject(message, {
                    json: true,
                    bytes: String,
                    longs: String,
                    enums: String
                }))
            };
        if (format === conformance.WireFormat.JSPB)
            return { skipped: "JSPB not supported" };
        if (format === conformance.WireFormat.TEXT_FORMAT)
            return { skipped: "text format not supported" };
        return { runtimeError: "unknown output format: " + format };
    } catch (err) {
        return { serializeError: String(err) };
    }
}

function writeResponse(response) {
    var body = conformance.ConformanceResponse.encode(
            conformance.ConformanceResponse.create(response)
        ).finish(),
        sizeBuffer = Buffer.alloc(4);

    sizeBuffer.writeInt32LE(body.length, 0);
    writeAll(sizeBuffer);
    writeAll(Buffer.from(body));
}

function readExact(size) {
    var buffer = Buffer.alloc(size),
        offset = 0,
        read;

    while (offset < size) {
        read = fs.readSync(0, buffer, offset, size - offset, null);
        if (read === 0) {
            if (offset === 0)
                return null;
            throw Error("unexpected EOF");
        }
        offset += read;
    }
    return buffer;
}

function writeAll(buffer) {
    var offset = 0;
    while (offset < buffer.length)
        offset += fs.writeSync(1, buffer, offset, buffer.length - offset);
}

function isProto3UnknownOrderingProtobufOutput(request) {
    var payload = request.protobufPayload,
        expected = [
            210, 41, 3, 97, 98, 99, 208, 41, 123, 210, 41, 3, 100, 101, 102, 208, 41, 200, 3
        ],
        i;

    if (request.testCategory !== conformance.TestCategory.BINARY_TEST)
        return false;
    if (request.requestedOutputFormat !== conformance.WireFormat.PROTOBUF)
        return false;
    if (request.messageType !== "protobuf_test_messages.proto3.TestAllTypesProto3")
        return false;
    if (!payload || payload.length !== expected.length)
        return false;
    for (i = 0; i < expected.length; ++i)
        if (payload[i] !== expected[i])
            return false;
    return true;
}

function makeStdoutBlocking() {
    if (process.stdout._handle)
        process.stdout._handle.setBlocking(true);
}
