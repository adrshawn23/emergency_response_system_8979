import { useEffect } from 'react';

/**
 * Close a modal/popover on the Escape key (audit U-05).
 * Usage: useEscapeKey(open && (() => setOpen(false)))
 * or:    useEscapeKey(() => setSelected(null), !!selected)
 */
export default function useEscapeKey(handler, active = true) {
  useEffect(() => {
    if (!active || !handler) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') handler(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handler, active]);
}
