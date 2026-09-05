"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { deleteRubricCopy } from "@/lib/rubric-copy";
import type { Rubric } from "@/lib/types";

type RubricManageApi = {
  openRename: (rubric: Rubric) => void;
  openDelete: (rubric: Rubric) => void;
};

const RubricManageContext = createContext<RubricManageApi | null>(null);

export function useRubricManage() {
  const ctx = useContext(RubricManageContext);
  if (!ctx) throw new Error("useRubricManage must be used within RubricManageProvider");
  return ctx;
}

export function RubricManageProvider({ children }: { children: ReactNode }) {
  const store = useStore();
  const [rename, setRename] = useState<Rubric | null>(null);
  const [name, setName] = useState("");
  const [remove, setRemove] = useState<Rubric | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const renameFieldId = useId();

  const openRename = useCallback((rubric: Rubric) => {
    setRemove(null);
    setRename(rubric);
    setName(rubric.name);
    setError("");
  }, []);

  const openDelete = useCallback((rubric: Rubric) => {
    setRename(null);
    setRemove(rubric);
    setError("");
  }, []);

  const workCount = remove
    ? store.archive.filter((item) => item.rubricId === remove.id).length
    : 0;

  async function saveRename(e: React.FormEvent) {
    e.preventDefault();
    if (!rename) return;
    const next = name.trim();
    if (!next) {
      setError("Введите название");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await store.updateRubric(rename.id, { name: next });
      setRename(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!remove) return;
    setBusy(true);
    setError("");
    try {
      await store.deleteRubric(remove.id);
      setRemove(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить");
    } finally {
      setBusy(false);
    }
  }

  return (
    <RubricManageContext.Provider value={{ openRename, openDelete }}>
      {children}
      {rename && (
        <div className="popup-overlay" onClick={() => !busy && setRename(null)}>
          <form
            className="popup-card"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => void saveRename(e)}
            role="dialog"
            aria-labelledby="rename-rubric-title"
          >
            <h2 id="rename-rubric-title">Переименовать рубрику</h2>
            <p className="popup-subtitle">Название видно на главной и в архиве.</p>
            <div className="field">
              <label htmlFor={renameFieldId}>Название</label>
              <input
                id={renameFieldId}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                disabled={busy}
              />
            </div>
            {error && <p className="flow-error" role="alert">{error}</p>}
            <div className="popup-actions">
              <button type="button" className="btn-secondary" disabled={busy} onClick={() => setRename(null)}>
                Отмена
              </button>
              <button type="submit" className="btn-primary" disabled={busy}>Сохранить</button>
            </div>
          </form>
        </div>
      )}
      {remove && (
        <div className="popup-overlay" onClick={() => !busy && setRemove(null)}>
          <div
            className="popup-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="delete-rubric-title"
          >
            <h2 id="delete-rubric-title">Удалить рубрику?</h2>
            <p className="popup-subtitle">{deleteRubricCopy(remove.name, workCount)}</p>
            {error && <p className="flow-error" role="alert">{error}</p>}
            <div className="popup-actions">
              <button type="button" className="btn-secondary" disabled={busy} onClick={() => setRemove(null)}>
                Отмена
              </button>
              <button type="button" className="btn-danger" disabled={busy} onClick={() => void confirmDelete()}>
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </RubricManageContext.Provider>
  );
}

export function RubricOverflow({
  rubric,
  variant = "corner",
}: {
  rubric: Rubric;
  variant?: "corner" | "inline";
}) {
  const { openRename, openDelete } = useRubricManage();
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const placeMenu = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const width = 188;
    const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8);
    setMenuStyle({ top: rect.bottom + 4, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    placeMenu();
    function onPointer(event: PointerEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onReposition() {
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReposition);
    document.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReposition);
      document.removeEventListener("scroll", onReposition, true);
    };
  }, [open, placeMenu]);

  return (
    <div className={`rubric-overflow ${variant}`} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="rubric-overflow-btn"
        aria-label={`Действия с рубрикой ${rubric.name}`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (open) {
            setOpen(false);
            return;
          }
          placeMenu();
          setOpen(true);
        }}
      >
        <MoreHorizontal size={16} aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div
            className="rubric-overflow-menu"
            id={menuId}
            ref={menuRef}
            role="menu"
            style={menuStyle}
          >
            <button
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
                openRename(rubric);
              }}
            >
              <Pencil size={14} aria-hidden="true" /> Переименовать
            </button>
            <button
              type="button"
              role="menuitem"
              className="danger"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
                openDelete(rubric);
              }}
            >
              <Trash2 size={14} aria-hidden="true" /> Удалить
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}
