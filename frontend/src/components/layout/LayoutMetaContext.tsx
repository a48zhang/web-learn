import React, { createContext, useCallback, useContext, useState } from 'react';

export interface BreadcrumbSegment {
  label: string;
  to?: string;
}

export interface LayoutMeta {
  pageTitle: string;
  breadcrumbSegments: BreadcrumbSegment[];
  sideNavSlot: React.ReactNode;
  actions: Array<{ label: string; onClick: () => void }>;
}

const defaultMeta: LayoutMeta = {
  pageTitle: '',
  breadcrumbSegments: [],
  sideNavSlot: null,
  actions: [],
};

interface LayoutMetaContextValue {
  meta: LayoutMeta;
  setMeta: (partial: Partial<LayoutMeta>) => void;
}

const LayoutMetaContext = createContext<LayoutMetaContextValue>({
  meta: defaultMeta,
  setMeta: () => {},
});

export function LayoutMetaProvider({ children }: { children: React.ReactNode }) {
  const [meta, setMetaState] = useState<LayoutMeta>(defaultMeta);

  const setMeta = useCallback((partial: Partial<LayoutMeta>) => {
    setMetaState((prev) => ({ ...prev, ...partial }));
  }, []);

  return (
    <LayoutMetaContext.Provider value={{ meta, setMeta }}>
      {children}
    </LayoutMetaContext.Provider>
  );
}

export function useLayoutMeta() {
  return useContext(LayoutMetaContext);
}
