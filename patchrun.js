// patchrun.js：按处理预算处理并留账，收尾不限预算清账
import { applyPatch } from "./patches.js";

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function codes(spec) {
  return {
    event: (spec && spec.event_error_code) || "E_BAD_EVENT",
    version: (spec && spec.version_error_code) || "E_BAD_VERSION",
    key: (spec && spec.key_error_code) || "E_NO_KEY"
  };
}

function validOps(ops) {
  if (!Array.isArray(ops)) return false;
  return ops.every(function (op) {
    return Array.isArray(op) && typeof op[1] === "string" &&
      ((op[0] === "set" && op.length === 3) || (op[0] === "unset" && op.length === 2));
  });
}

function validEvent(event) {
  return !!event && typeof event === "object" &&
    event.kind === "patch" && Number.isInteger(event.version) && validOps(event.ops);
}

function copyRecord(record) {
  return (Array.isArray(record) ? record : []).map(function (pair) { return [pair[0], pair[1]]; });
}

function copyOps(ops) {
  return ops.map(function (op) { return op.slice(); });
}

function hasKey(record, key) {
  return record.some(function (pair) { return pair[0] === key; });
}

// 叠一条补丁：版本必须正好比当前大一，unset 的键必须存在
function runOne(state, item, code) {
  if (item.version !== state.version + 1) fail(code.version);
  for (const op of item.ops) {
    if (op[0] === "unset" && !hasKey(state.record, op[1])) fail(code.key);
  }
  state.record = applyPatch(state.record, item.ops);
  state.version += 1;
  state.applied.push(item.version);
}

function freshState(state) {
  return {
    record: copyRecord(state && state.record),
    version: state && Number.isInteger(state.version) ? state.version : 0,
    ledger: [],
    applied: state && Array.isArray(state.applied) ? state.applied.slice() : []
  };
}

// 按处理预算处理：先校验全部事件结构（与预算无关），再按预算逐条叠，
// 预算用尽的补丁连着载压在账上；已在 applied 里的版本重放时直接跳过
export function step(spec) {
  const code = codes(spec);
  const source = (spec && spec.state) || {};
  const events = Array.isArray(spec.events) ? spec.events : [];
  for (const event of events) {
    if (!validEvent(event)) fail(code.event);
  }
  const state = freshState(source);
  const queue = (Array.isArray(source.ledger) ? source.ledger : []).map(function (entry) {
    return { kind: entry[0], version: entry[1], ops: entry[2], pending: true };
  }).concat(events.map(function (event) {
    return { kind: event.kind, version: event.version, ops: event.ops, pending: false };
  }));
  let left = Number.isFinite(spec && spec.budget) ? Math.max(0, Math.floor(spec.budget)) : 0;
  let served = 0;
  for (const item of queue) {
    if (!item.pending && state.applied.indexOf(item.version) !== -1) continue;
    if (left <= 0) {
      state.ledger.push([item.kind, item.version, copyOps(item.ops)]);
      continue;
    }
    runOne(state, item, code);
    served += 1;
    left -= 1;
  }
  return {
    state: state,
    served: served,
    ledger_before: state.ledger.length,
    ledger: state.ledger,
    judged: served,
    judged_bound: queue.length
  };
}

// 收尾：不限预算把账上的补丁处理完，返回补齐条数
export function close(spec) {
  const code = codes(spec);
  const source = (spec && spec.state) || {};
  const state = freshState(source);
  let catchup = 0;
  for (const entry of Array.isArray(source.ledger) ? source.ledger : []) {
    runOne(state, { kind: entry[0], version: entry[1], ops: entry[2] }, code);
    catchup += 1;
  }
  return { state: state, catchup: catchup };
}
