import { useCallback, useState } from "react";
import { wallet } from "@/container";

/** The pull indicator belongs to the gesture, not every automatic background update. */
export function usePullRefresh() {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // WalletService records connection errors in the store for SyncStatus to display.
    void wallet.refresh().finally(() => setRefreshing(false));
  }, []);
  return { refreshing, onRefresh };
}
