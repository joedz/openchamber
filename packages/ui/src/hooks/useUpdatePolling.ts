import React from 'react';

// INTERNAL-NETWORK: external update channel disabled. The hook signature is
// preserved so existing callers (MainLayout, VSCodeLayout, MobileApp) keep
// compiling, but no timer is ever scheduled.
export function useUpdatePolling() {
  React.useEffect(() => {
    return undefined;
  }, []);
}
