/**
 * Orders workspaces in a pre-order depth-first tree based on parentWorkspaceId.
 * Safeguards against missing parent references and cycles.
 */
export function buildWorkspaceHierarchy(workspaces = []) {
  if (!Array.isArray(workspaces) || workspaces.length === 0) return [];

  const byId = new Map();
  workspaces.forEach((ws) => {
    if (ws?.id) byId.set(ws.id, ws);
  });

  const childrenMap = new Map();
  const roots = [];

  workspaces.forEach((ws) => {
    if (!ws?.id) return;
    const pid = ws.parentWorkspaceId;
    if (pid && pid !== ws.id && byId.has(pid)) {
      if (!childrenMap.has(pid)) childrenMap.set(pid, []);
      childrenMap.get(pid).push(ws);
    } else {
      roots.push(ws);
    }
  });

  const ordered = [];
  const visited = new Set();

  const walk = (ws, depth, parent) => {
    if (!ws?.id || visited.has(ws.id)) return;
    visited.add(ws.id);
    const children = childrenMap.get(ws.id) || [];
    ordered.push({
      workspace: ws,
      depth,
      parentWorkspace: parent,
      childrenCount: children.length,
    });
    children.forEach((child) => walk(child, depth + 1, ws));
  };

  roots.forEach((rootWs) => {
    const parentPlaceholder = rootWs.parentWorkspaceId
      ? { id: rootWs.parentWorkspaceId, name: 'Parent Workspace' }
      : null;
    walk(rootWs, 0, parentPlaceholder);
  });

  workspaces.forEach((ws) => {
    if (ws?.id && !visited.has(ws.id)) {
      walk(ws, 0, null);
    }
  });

  return ordered;
}
