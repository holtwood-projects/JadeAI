import { create } from 'zustand';
import { toast } from 'sonner';
import type { Resume, ResumeSection, SectionContent } from '@/types/resume';
import type { ResumeVersionSource } from '@/types/editor';
import { AUTOSAVE_DELAY } from '@/lib/constants';
import { generateId } from '@/lib/utils';
import {
  areResumeDraftSnapshotsEqual,
  createResumeDraftSnapshot,
} from '@/lib/editor/resume-draft';
import { saveResumeVersion } from '@/lib/editor/resume-version-history';
import {
  getAutoSaveFailureCopy,
  getLocalVersionHistoryFailureCopy,
} from '@/lib/editor/resume-version-history-status';
import { useEditorStore } from '@/stores/editor-store';
import { useSettingsStore } from '@/stores/settings-store';
import { normalizeSectionContent } from '@/lib/resume/normalize-content';

/**
 * Best-effort PUT of a captured draft, independent of the current store
 * state. Used by reset() so an unmount cannot discard edits, even while a
 * previous save is still in flight.
 */
async function putResumeDraft(resume: Resume, sections: ResumeSection[]): Promise<void> {
  const fingerprint = typeof window !== 'undefined'
    ? localStorage.getItem('jade_fingerprint')
    : null;
  const response = await fetch(`/api/resume/${resume.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(fingerprint ? { 'x-fingerprint': fingerprint } : {}),
    },
    body: JSON.stringify({
      title: resume.title,
      template: resume.template,
      themeConfig: resume.themeConfig,
      language: resume.language,
      sections: sections.map((section, index) => ({
        id: section.id,
        type: section.type,
        title: section.title,
        sortOrder: index,
        visible: section.visible,
        content: section.content,
      })),
    }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(
      typeof data?.error === 'string' ? data.error : 'Failed to save resume'
    );
  }
}

interface ResumeStore {
  currentResume: Resume | null;
  sections: ResumeSection[];
  isDirty: boolean;
  isSaving: boolean;
  _saveTimeout: ReturnType<typeof setTimeout> | null;
  /** 正在飞的那次 PUT。用来串行化，避免两次保存乱序落库 */
  _savePromise: Promise<void> | null;

  setResume: (resume: Resume) => void;
  updateSection: (sectionId: string, content: Partial<SectionContent>) => void;
  updateSectionTitle: (sectionId: string, title: string) => void;
  addSection: (section: ResumeSection) => void;
  removeSection: (sectionId: string) => void;
  reorderSections: (sections: ResumeSection[]) => void;
  toggleSectionVisibility: (sectionId: string) => void;
  setTemplate: (template: string) => void;
  setTitle: (title: string) => void;
  save: (options?: { source?: ResumeVersionSource; forceVersion?: boolean }) => Promise<void>;
  flushSave: () => Promise<void>;
  _scheduleSave: () => void;
  reset: () => void;
}

function pushUndoSnapshot(resume: Resume | null) {
  if (!resume) return;
  useEditorStore.getState().pushSnapshot(createResumeDraftSnapshot(resume));
}

let hasWarnedAboutLocalVersionHistoryFailure = false;
let hasWarnedAboutAutoSaveFailure = false;

function handleLocalVersionHistoryFailure(error: unknown) {
  console.error('Failed to save local resume version:', error);

  if (typeof window === 'undefined' || hasWarnedAboutLocalVersionHistoryFailure) {
    return;
  }

  hasWarnedAboutLocalVersionHistoryFailure = true;
  const copy = getLocalVersionHistoryFailureCopy(navigator.language);
  toast.warning(copy.title, { description: copy.description });
}

function handleAutoSaveFailure(error: unknown) {
  console.error('Failed to auto-save resume:', error);

  if (typeof window === 'undefined' || hasWarnedAboutAutoSaveFailure) {
    return;
  }

  hasWarnedAboutAutoSaveFailure = true;
  const copy = getAutoSaveFailureCopy(navigator.language);
  toast.error(copy.title, { description: copy.description });
}

function parseDateInput(value: unknown, fallback: Date): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return fallback;
}

function normalizeServerResume(
  raw: unknown,
  fallbackResume: Resume,
  fallbackSections: ResumeSection[]
): Resume | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const value = raw as Partial<Resume> & { sections?: unknown };
  const sectionSource = Array.isArray(value.sections) ? value.sections : fallbackSections;

  const sections = sectionSource.map((sectionLike, index) => {
    const section = sectionLike as Partial<ResumeSection>;
    const now = new Date();
    return {
      id: typeof section.id === 'string' && section.id ? section.id : generateId(),
      resumeId:
        typeof section.resumeId === 'string' && section.resumeId
          ? section.resumeId
          : fallbackResume.id,
      type: typeof section.type === 'string' && section.type ? section.type : 'custom',
      title: typeof section.title === 'string' ? section.title : '',
      sortOrder:
        typeof section.sortOrder === 'number' && Number.isFinite(section.sortOrder)
          ? section.sortOrder
          : index,
      visible: section.visible !== false,
      content: (section.content ?? {}) as SectionContent,
      createdAt: parseDateInput(section.createdAt, now),
      updatedAt: parseDateInput(section.updatedAt, now),
    } satisfies ResumeSection;
  });

  return {
    id: typeof value.id === 'string' && value.id ? value.id : fallbackResume.id,
    userId:
      typeof value.userId === 'string' && value.userId
        ? value.userId
        : fallbackResume.userId,
    title: typeof value.title === 'string' ? value.title : fallbackResume.title,
    template:
      typeof value.template === 'string' ? value.template : fallbackResume.template,
    themeConfig: (value.themeConfig ?? fallbackResume.themeConfig) as Resume['themeConfig'],
    isDefault:
      typeof value.isDefault === 'boolean' ? value.isDefault : fallbackResume.isDefault,
    language:
      typeof value.language === 'string' ? value.language : fallbackResume.language,
    sections,
    createdAt: parseDateInput(value.createdAt, fallbackResume.createdAt),
    updatedAt: parseDateInput(value.updatedAt, fallbackResume.updatedAt),
  };
}

export const useResumeStore = create<ResumeStore>((set, get) => ({
  currentResume: null,
  sections: [],
  isDirty: false,
  isSaving: false,
  _saveTimeout: null,
  _savePromise: null,

  setResume: (resume) => {
    // Cancel any pending autosave to prevent stale data overwriting server changes (e.g., from AI tool calls)
    const { _saveTimeout } = get();
    if (_saveTimeout) clearTimeout(_saveTimeout);

    // Normalize section content into the shape the renderers expect. Beyond adding
    // missing item/category ids, this coerces list fields (highlights/technologies/
    // skills) back into arrays so a resume that the AI corrupted (issue #87) can be
    // opened and repaired instead of crashing the editor on render.
    const sections = (resume.sections || []).map((s) => ({
      ...s,
      content: normalizeSectionContent(s.type, structuredClone(s.content)) as unknown as typeof s.content,
    }));

    set({
      currentResume: { ...resume, sections },
      sections,
      isDirty: false,
      // The store now shows a different resume; the old save may still be in
      // flight, but its "saving" UI state no longer applies. `_savePromise`
      // stays until that request settles so saves remain serialized.
      isSaving: false,
      _saveTimeout: null,
    });
  },

  updateSection: (sectionId, content) => {
    set((state) => {
      pushUndoSnapshot(state.currentResume);
      const sections = state.sections.map((s) =>
        s.id === sectionId ? { ...s, content: { ...s.content, ...content } as SectionContent } : s
      );
      return {
        sections,
        currentResume: state.currentResume ? { ...state.currentResume, sections } : null,
        isDirty: true,
      };
    });
    get()._scheduleSave();
  },

  updateSectionTitle: (sectionId, title) => {
    set((state) => {
      pushUndoSnapshot(state.currentResume);
      const sections = state.sections.map((s) =>
        s.id === sectionId ? { ...s, title } : s
      );
      return {
        sections,
        currentResume: state.currentResume ? { ...state.currentResume, sections } : null,
        isDirty: true,
      };
    });
    get()._scheduleSave();
  },

  addSection: (section) => {
    set((state) => {
      pushUndoSnapshot(state.currentResume);
      const sections = [...state.sections, section];
      return {
        sections,
        currentResume: state.currentResume ? { ...state.currentResume, sections } : null,
        isDirty: true,
      };
    });
    get()._scheduleSave();
  },

  removeSection: (sectionId) => {
    set((state) => {
      pushUndoSnapshot(state.currentResume);
      const sections = state.sections.filter((s) => s.id !== sectionId);
      return {
        sections,
        currentResume: state.currentResume ? { ...state.currentResume, sections } : null,
        isDirty: true,
      };
    });
    get()._scheduleSave();
  },

  reorderSections: (sections) => {
    set((state) => {
      pushUndoSnapshot(state.currentResume);
      return {
        sections,
        currentResume: state.currentResume ? { ...state.currentResume, sections } : null,
        isDirty: true,
      };
    });
    get()._scheduleSave();
  },

  toggleSectionVisibility: (sectionId) => {
    set((state) => {
      pushUndoSnapshot(state.currentResume);
      const sections = state.sections.map((s) =>
        s.id === sectionId ? { ...s, visible: !s.visible } : s
      );
      return {
        sections,
        currentResume: state.currentResume ? { ...state.currentResume, sections } : null,
        isDirty: true,
      };
    });
    get()._scheduleSave();
  },

  setTemplate: (template) => {
    set((state) => {
      pushUndoSnapshot(state.currentResume);
      return {
        currentResume: state.currentResume
          ? { ...state.currentResume, template }
          : null,
        isDirty: true,
      };
    });
    get()._scheduleSave();
  },

  setTitle: (title) => {
    set((state) => {
      pushUndoSnapshot(state.currentResume);
      return {
        currentResume: state.currentResume
          ? { ...state.currentResume, title }
          : null,
        isDirty: true,
      };
    });
    get()._scheduleSave();
  },

  save: async (options) => {
    const source = options?.source ?? 'manual';
    // Serialize saves. Two concurrent PUTs can land out of order and let the
    // older body win; waiting in a loop (not a single read) also covers the
    // case where another caller starts a save while we are waiting. The old
    // `isSaving` early-return silently dropped queued saves (upstream #96).
    while (true) {
      const inFlight = get()._savePromise;
      if (!inFlight) break;
      await inFlight.catch(() => {});
    }

    const { currentResume, sections, isDirty } = get();
    if (!currentResume) return;
    const requestedDraftSnapshot = createResumeDraftSnapshot({
      ...currentResume,
      sections,
    });

    if (!isDirty) {
      if (!options?.forceVersion) return;

      try {
        await saveResumeVersion({
          resumeId: currentResume.id,
          snapshot: createResumeDraftSnapshot({
            ...currentResume,
            sections,
          }),
          source,
        });
      } catch (error) {
        handleLocalVersionHistoryFailure(error);
      }
      return;
    }

    const { _saveTimeout } = get();
    if (_saveTimeout) {
      clearTimeout(_saveTimeout);
      set({ _saveTimeout: null });
    }

    const request = (async () => {
      const fingerprint = typeof window !== 'undefined'
        ? localStorage.getItem('jade_fingerprint')
        : null;

      const response = await fetch(`/api/resume/${currentResume.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(fingerprint ? { 'x-fingerprint': fingerprint } : {}),
        },
        body: JSON.stringify({
          title: currentResume.title,
          template: currentResume.template,
          themeConfig: currentResume.themeConfig,
          language: currentResume.language,
          sections: sections.map((s, i) => ({
            id: s.id,
            type: s.type,
            title: s.title,
            sortOrder: i,
            visible: s.visible,
            content: s.content,
          })),
        }),
      });

      // Guard against a stale save applying its response to the wrong resume:
      // if the store was cleared (unmount) or now shows a different resume
      // (the user navigated while this PUT was in flight), don't write state
      // back — doing so would dirty/corrupt the other resume's view.
      const storeResumeAfterSave = get().currentResume;
      if (!storeResumeAfterSave || storeResumeAfterSave.id !== currentResume.id) return;

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        // Store was reset while the save was in flight — no one is listening.
        if (!get().currentResume) return;
        throw new Error(
          typeof data?.error === 'string' ? data.error : 'Failed to save resume'
        );
      }

      const persistedPayload = await response.json().catch(() => null);
      const persistedResume = normalizeServerResume(
        persistedPayload,
        currentResume,
        sections
      );
      const latestState = get();
      const latestDraftSnapshot = latestState.currentResume
        ? createResumeDraftSnapshot({
          ...latestState.currentResume,
          sections: latestState.sections,
        })
        : null;
      const unchangedSinceRequest =
        latestDraftSnapshot !== null &&
        areResumeDraftSnapshotsEqual(latestDraftSnapshot, requestedDraftSnapshot);

      hasWarnedAboutAutoSaveFailure = false;
      hasWarnedAboutLocalVersionHistoryFailure = false;
      if (unchangedSinceRequest) {
        if (persistedResume) {
          get().setResume(persistedResume);
        } else {
          set({ isDirty: false });
        }
      } else {
        set((state) => {
          // Store was reset while the save was in flight (e.g. editor unmount) —
          // nothing left to re-save, and marking dirty would leave residue.
          if (!state.currentResume) {
            return {};
          }
          return {
            currentResume: persistedResume
              ? {
                ...state.currentResume,
                updatedAt: persistedResume.updatedAt,
              }
              : state.currentResume,
            isDirty: true,
          };
        });
        if (get().currentResume) {
          get()._scheduleSave();
        }
      }

      const snapshotForVersion = unchangedSinceRequest
        ? (() => {
          const syncedState = get();
          if (!syncedState.currentResume) {
            return requestedDraftSnapshot;
          }
          return createResumeDraftSnapshot({
            ...syncedState.currentResume,
            sections: syncedState.sections,
          });
        })()
        : requestedDraftSnapshot;

      try {
        await saveResumeVersion({
          resumeId: currentResume.id,
          snapshot: snapshotForVersion,
          source,
        });
      } catch (error) {
        handleLocalVersionHistoryFailure(error);
      }
    })();

    set({ isSaving: true, _savePromise: request });
    try {
      await request;
    } catch (error) {
      console.error('Failed to save resume:', error);
    } finally {
      // A newer save may already have replaced the in-flight slot; only clear
      // the one this call owns. Checking the promise (not the resume id) also
      // clears isSaving after navigation, which otherwise stayed true forever.
      if (get()._savePromise === request) {
        set({ isSaving: false, _savePromise: null });
      }
    }
  },

  /**
   * 立刻把未保存的改动写回服务端，等写完再返回。
   *
   * 所有 AI 功能（对话、JD 匹配、求职信、语法检查、翻译、模拟面试）在服务端都是
   * 拿 resumeId 回库里读简历的，客户端不上传正文。所以只要防抖保存还没触发，
   * AI 看到的就是上一版——间隔最长能调到 5 秒，关掉自动保存更是永远不会写。
   * 这就是 issue #96：手动改完立刻问 AI，AI 在旧简历上改。
   *
   * 不看 autoSave 开关：用户主动把简历交给 AI 处理，本身就意味着要用当前这一版。
   */
  flushSave: async () => {
    const { _saveTimeout } = get();
    if (_saveTimeout) {
      clearTimeout(_saveTimeout);
      set({ _saveTimeout: null });
    }
    await get().save();
    // save() swallows background failures to keep autosave quiet. Callers use
    // flushSave before handing the resume to the server, so they must know
    // when the flush did not actually persist anything.
    const state = get();
    if (state.isDirty && !state.isSaving) {
      throw new Error('Failed to save the latest resume before the AI request.');
    }
  },

  _scheduleSave: () => {
    const { _saveTimeout } = get();
    if (_saveTimeout) clearTimeout(_saveTimeout);

    const { autoSave, autoSaveInterval, _hydrated } = useSettingsStore.getState();

    // If settings are hydrated and autoSave is off, only mark dirty, don't auto-save
    if (_hydrated && !autoSave) {
      set({ _saveTimeout: null });
      return;
    }

    const delay = _hydrated ? autoSaveInterval : AUTOSAVE_DELAY;
    const timeout = setTimeout(() => {
      void get().save({ source: 'autosave' }).catch((error) => {
        handleAutoSaveFailure(error);
      });
    }, delay);

    set({ _saveTimeout: timeout });
  },

  reset: () => {
    const state = get();
    if (state._saveTimeout) clearTimeout(state._saveTimeout);
    // Flush any edits still pending in the autosave window before clearing the
    // store — the editor page unmounts right after reset(), so cancelling the
    // timer would otherwise silently discard them. Capture the draft now and
    // queue the PUT behind any in-flight save; calling save() here would read
    // the cleared store after waiting.
    if (state.currentResume && state.isDirty) {
      const draftResume = state.currentResume;
      const draftSections = state.sections;
      const inFlight = state._savePromise;
      void (async () => {
        try {
          if (inFlight) await inFlight.catch(() => {});
          await putResumeDraft(draftResume, draftSections);
        } catch (error) {
          console.error('Failed to flush resume before reset:', error);
        }
      })();
    }
    set({
      currentResume: null,
      sections: [],
      isDirty: false,
      isSaving: false,
      _saveTimeout: null,
      // Do not clear _savePromise: an older PUT may still be in flight and
      // must remain serialized. Its finally block clears the slot.
    });
  },
}));
