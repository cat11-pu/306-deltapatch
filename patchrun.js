// patchrun.js：按处理预算处理补丁，用尽的补丁压账，收尾时不限预算清账
import { applyPatch } from "./patches.js";

const DEFAULT_CODES = {
  version_error_code: "E_BAD_VERSION",
  key_error_code: "E_NO_KEY",
  event_error_code: "E_BAD_EVENT"
};

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function codeOf(spec, name) {
  return spec && spec[name] ? spec[name] : DEFAULT_CODES[name];
}

function isInt(value) {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function validateEvents(events, badEventCode) {
  if (!Array.isArray(events)) fail(badEventCode, "事件表必须是数组");
  events.forEach(function (event) {
    if (!event || typeof event !== "object" || Array.isArray(event)) {
      fail(badEventCode, "事件必须是对象");
    }
    if (event.kind !== "patch" || !isInt(event.version)) {
      fail(badEventCode, "事件必须是带整数 version 的 patch");
    }
    if (!Array.isArray(event.ops)) fail(badEventCode, "ops 必须是数组");
    event.ops.forEach(function (op) {
      if (!Array.isArray(op) || (op[0] !== "set" && op[0] !== "unset")) {
        fail(badEventCode, "操作必须是 set 或 unset");
      }
      if (op[0] === "set" && op.length !== 3) {
        fail(badEventCode, "set 操作必须带键与值");
      }
      if (op[0] === "unset" && op.length !== 2) {
        fail(badEventCode, "unset 操作必须带键");
      }
    });
  });
}

function normalizeState(state) {
  const source = state || {};
  return {
    record: Array.isArray(source.record) ? source.record.map(function (pair) {
      return [pair[0], pair[1]];
    }) : [],
    version: isInt(source.version) ? source.version : 0,
    ledger: Array.isArray(source.ledger) ? source.ledger.map(function (row) {
      return [row[0], row[1], row[2]];
    }) : [],
    applied: Array.isArray(source.applied) ? source.applied.slice() : []
  };
}

function applyOne(state, row, spec) {
  const version = row[1];
  if (version !== state.version + 1) {
    fail(codeOf(spec, "version_error_code"),
      "补丁版本必须正好比当前版本大一个: 期望 " + (state.version + 1) + " 实际 " + version);
  }
  let record;
  try {
    record = applyPatch(state.record, row[2]);
  } catch (error) {
    if (error && error.code === "E_NO_KEY") {
      fail(codeOf(spec, "key_error_code"), error.message);
    }
    throw error;
  }
  state.record = record;
  state.version = version;
  if (state.applied.indexOf(version) === -1) state.applied.push(version);
}

// 按处理预算处理：账上旧账优先，然后新事件；用尽预算的补丁整条压账
export function step(spec) {
  const source = spec || {};
  const events = Array.isArray(source.events) ? source.events : [];
  validateEvents(events, codeOf(source, "event_error_code"));

  const state = normalizeState(source.state);
  const budget = isInt(source.budget) && source.budget > 0 ? source.budget : 0;

  const appliedSet = new Set(state.applied);
  const queued = new Set();
  const queue = [];
  state.ledger.forEach(function (row) {
    queue.push([row[0], row[1], row[2]]);
    queued.add(row[1]);
  });
  events.forEach(function (event) {
    if (appliedSet.has(event.version) || queued.has(event.version)) return;
    queue.push(["patch", event.version, event.ops]);
    queued.add(event.version);
  });

  let served = 0;
  let index = 0;
  while (served < budget && index < queue.length) {
    applyOne(state, queue[index], source);
    served += 1;
    index += 1;
  }
  const remaining = queue.slice(index).map(function (row) {
    return [row[0], row[1], row[2]];
  });

  state.applied.sort(function (a, b) { return a - b; });
  state.ledger = remaining;

  return {
    state: state,
    served: served,
    ledger_before: remaining.length,
    ledger: remaining,
    judged: served,
    judged_bound: events.length
  };
}

// 收尾：不限预算把账上的补丁依次处理完
export function close(spec) {
  const source = spec || {};
  const state = normalizeState(source.state);
  let catchup = 0;
  state.ledger.forEach(function (row) {
    applyOne(state, row, source);
    catchup += 1;
  });
  state.applied.sort(function (a, b) { return a - b; });
  state.ledger = [];
  return { state: state, catchup: catchup };
}
