'use client';

import React, { createContext, useContext, ReactNode } from 'react';

interface BrandingSettings {
  primary_color: string;
  logo_light_url: string;
  logo_dark_url: string;
  favicon_light_url: string;
  favicon_dark_url: string;
}

const BrandingContext = createContext<BrandingSettings | null>(null);

export const BrandingProvider = ({ settings, children }: { settings: BrandingSettings; children: ReactNode }) => {
  return (
    <BrandingContext.Provider value={settings}>
      {children}
    </BrandingContext.Provider>
  );
};

export const useBranding = () => {
  const context = useContext(BrandingContext);
  return context;
};
