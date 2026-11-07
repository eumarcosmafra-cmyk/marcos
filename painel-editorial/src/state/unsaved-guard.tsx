"use client";

import NextLink from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type MouseEvent,
  type ReactNode,
} from "react";

const MESSAGE = "Existem alterações não salvas. Sair desta tela agora? O rascunho fica guardado neste navegador, mas não vira versão.";

interface GuardContext {
  setDirty: (key: string, dirty: boolean) => void;
  isDirty: boolean;
  confirmLeave: () => boolean;
}

const Ctx = createContext<GuardContext | null>(null);

export function UnsavedGuardProvider({ children }: { children: ReactNode }) {
  const dirtyKeys = useRef(new Set<string>());
  const [isDirty, setIsDirty] = useState(false);

  const setDirty = useCallback((key: string, dirty: boolean) => {
    if (dirty) dirtyKeys.current.add(key);
    else dirtyKeys.current.delete(key);
    setIsDirty(dirtyKeys.current.size > 0);
  }, []);

  const confirmLeave = useCallback(() => {
    if (dirtyKeys.current.size === 0) return true;
    return window.confirm(MESSAGE);
  }, []);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyKeys.current.size === 0) return;
      e.preventDefault();
      e.returnValue = MESSAGE;
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const value = useMemo(() => ({ setDirty, isDirty, confirmLeave }), [setDirty, isDirty, confirmLeave]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUnsavedGuard(): GuardContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useUnsavedGuard fora do provider");
  return ctx;
}

/** Link interno que pede confirmação quando há alterações não salvas. */
export function Link(props: ComponentProps<typeof NextLink>) {
  const { confirmLeave } = useUnsavedGuard();
  const { onClick, ...rest } = props;
  return (
    <NextLink
      {...rest}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
        if (!confirmLeave()) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
    />
  );
}

export function useGuardedRouter() {
  const router = useRouter();
  const { confirmLeave } = useUnsavedGuard();
  return useMemo(
    () => ({
      push: (href: string) => {
        if (confirmLeave()) router.push(href);
      },
      /** Navega sem perguntar (usar logo após salvar). */
      pushUnchecked: (href: string) => router.push(href),
      replace: (href: string) => router.replace(href),
    }),
    [router, confirmLeave],
  );
}
