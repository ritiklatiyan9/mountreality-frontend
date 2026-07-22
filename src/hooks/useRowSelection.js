import { useCallback, useState } from 'react';

// ponytail: selection is a plain Set of row ids in component state. Pages
// must NOT clear it on pagination/filter changes for "persist across
// pagination/filters" to hold — same convention PlotCommissionList.jsx
// already used for its selectedPlots Set before this hook existed.
export function useRowSelection() {
  const [selected, setSelected] = useState(() => new Set());

  const isSelected = useCallback((id) => selected.has(id), [selected]);

  const toggle = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // Selects every id in `ids` unless they're all already selected, in which
  // case it deselects them — matches native "select all" checkbox tri-state
  // behavior and only touches ids currently visible under the active filter.
  const toggleAll = useCallback((ids) => {
    setSelected((prev) => {
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id));
      const next = new Set(prev);
      ids.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  const remove = useCallback((ids) => {
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  const isAllSelected = useCallback(
    (ids) => ids.length > 0 && ids.every((id) => selected.has(id)),
    [selected]
  );

  return { selected, isSelected, toggle, toggleAll, clear, remove, isAllSelected, count: selected.size };
}
