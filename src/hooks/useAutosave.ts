import { useEffect } from 'react';
import { useProject } from '../context/ProjectContext';

/**
 * Custom hook for continuous debounced autosaving of the active project.
 */
export function useAutosave(debounceMs = 2000) {
  const { project, saveProject, hasUnsavedChanges, saveStatus } = useProject();

  useEffect(() => {
    if (!project || !hasUnsavedChanges || saveStatus === 'saving') return;

    const timer = setTimeout(async () => {
      try {
        await saveProject();
      } catch (err) {
        console.error('[useAutosave] Autosave failed:', err);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [project, hasUnsavedChanges, saveStatus, debounceMs, saveProject]);
}
