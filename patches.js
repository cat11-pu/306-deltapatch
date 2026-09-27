// patches.js：补丁与记录（键值对一律按键升序；操作不就地改入参）
export function recordOf(record) {
  const map = new Map();
  (record || []).forEach(function (pair) {
    map.set(pair[0], pair[1]);
  });
  return [...map.entries()].sort(function (a, b) {
    return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
  });
}

export function applyPatch(record, ops) {
  const map = new Map();
  (record || []).forEach(function (pair) {
    map.set(pair[0], pair[1]);
  });
  (ops || []).forEach(function (op) {
    if (op[0] === "set") {
      map.set(op[1], op[2]);
    } else if (op[0] === "unset") {
      if (!map.has(op[1])) {
        const error = new Error("删除的键不存在: " + String(op[1]));
        error.code = "E_NO_KEY";
        throw error;
      }
      map.delete(op[1]);
    }
  });
  return [...map.entries()].sort(function (a, b) {
    return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
  });
}
