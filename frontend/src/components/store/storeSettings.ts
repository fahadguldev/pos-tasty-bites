import { useEffect, useState } from 'react';
import { http, unwrap } from '../../lib/api';
import type { Settings } from '../../lib/types';

/** the cafe's WhatsApp chat link, built from whatever number the settings hold */
export const waLink = (settings: Settings | null) =>
  `https://wa.me/${(settings?.whatsappNumber || '').replace(/\D/g, '')}`;

/** loads the public shop settings once for the whole storefront */
export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    unwrap<Settings>(http.get('/settings'))
      .then(setSettings)
      .catch(() => setSettings(null));
  }, []);

  return settings;
}
