import assert from "node:assert/strict";
import test from "node:test";

import {
  encodeAmiAction,
  parseAmiMessage,
  takeAmiMessages,
} from "./ami-protocol.mjs";

test("parses AMI headers and ignores the banner line", () => {
  assert.deepEqual(parseAmiMessage("Asterisk Call Manager/5.0\r\nEvent: Hangup\r\nCause: 16"), {
    Event: "Hangup",
    Cause: "16",
  });
});

test("takes complete messages and keeps a partial message for the next packet", () => {
  const result = takeAmiMessages("Event: Newchannel\r\nUniqueid: 1\r\n\r\nEvent: Hangup\r\nUniqueid: ");

  assert.deepEqual(result.messages, [{ Event: "Newchannel", Uniqueid: "1" }]);
  assert.equal(result.remaining, "Event: Hangup\r\nUniqueid: ");
});

test("encodes an AMI action with the required blank line terminator", () => {
  assert.equal(
    encodeAmiAction({ Action: "CoreShowChannels", ActionID: "test-1" }),
    "Action: CoreShowChannels\r\nActionID: test-1\r\n\r\n",
  );
});
