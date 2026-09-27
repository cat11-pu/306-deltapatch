import assert from "node:assert";
import { applyPatch, recordOf } from "../patches.js";
import { step, close } from "../patchrun.js";
import { render } from "../app.js";

const base = {
  budget: 1,
  state: { record: [["a", 1]], version: 0, ledger: [], applied: [] },
  events: [{ id: 1, kind: "patch", version: 1, ops: [["set", "b", 2]] }],
  version_error_code: "E_BAD_VERSION", key_error_code: "E_NO_KEY",
  event_error_code: "E_BAD_EVENT"
};

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

check("applyPatch returns a record", () => {
  assert.ok(Array.isArray(applyPatch([["z", 1]], [["set", "z", 2]])));
});

check("recordOf returns pairs", () => {
  assert.ok(Array.isArray(recordOf([["z", 1]])));
});

check("step returns a state", () => {
  assert.strictEqual(typeof step(base).state, "object");
});

check("close returns a state", () => {
  assert.strictEqual(typeof close(base).state, "object");
});

check("render counts events", () => {
  assert.strictEqual(typeof render(base).count, "number");
});

console.log("5 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
