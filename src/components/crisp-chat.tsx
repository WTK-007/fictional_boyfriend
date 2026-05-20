'use client';

import { useEffect } from 'react';

export default function CrispChat() {
  useEffect(() => {
    const websiteId = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID;
    if (!websiteId) return;

    (window as any).$crisp = [];
    (window as any).CRISP_WEBSITE_ID = websiteId;

    const script = document.createElement('script');
    script.src = 'https://client.crisp.chat/l.js';
    script.async = true;
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  return null;
}
