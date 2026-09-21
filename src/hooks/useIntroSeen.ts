import { useState } from "react";

const STORAGE_KEY = "resqbot-intro-seen";

export function useIntroSeen() {
  const [seen, setSeen] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  const markSeen = () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* storage unavailable, ignore */
    }
    setSeen(true);
  };

  return { seen, markSeen };
}
