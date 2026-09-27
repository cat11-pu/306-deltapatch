// patches.js：补丁与记录（记录是按键升序的 [键, 值] 对表）
function byKey(left, right) {
  if (left[0] < right[0]) return -1;
  if (left[0] > right[0]) return 1;
  return 0;
}

function noKey() {
  const error = new Error("E_NO_KEY");
  error.code = "E_NO_KEY";
  throw error;
}

// 把一串操作叠到记录上：set 设键、unset 删键（删没有的键报 E_NO_KEY），按键升序返回新记录
export function applyPatch(record, ops) {
  const table = new Map(Array.isArray(record) ? record : []);
  for (const op of Array.isArray(ops) ? ops : []) {
    if (op[0] === "set") {
      table.set(op[1], op[2]);
    } else if (op[0] === "unset") {
      if (!table.has(op[1])) noKey();
      table.delete(op[1]);
    }
  }
  return recordOf(Array.from(table.entries()));
}

// 把记录整理成按键升序的键值对（返回新表，不动入参）
export function recordOf(record) {
  return (Array.isArray(record) ? record : [])
    .map(function (pair) { return [pair[0], pair[1]]; })
    .sort(byKey);
}
