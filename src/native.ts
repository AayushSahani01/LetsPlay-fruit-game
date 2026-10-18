import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { StatusBar, Style } from "@capacitor/status-bar";

export async function setupNative(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: "#3b0d2a" });
  } catch {
    /* web / unsupported */
  }
}

export async function haptic(kind: "light" | "medium" | "heavy", enabled: boolean): Promise<void> {
  if (!enabled) return;
  if (!Capacitor.isNativePlatform()) return;
  const style =
    kind === "heavy" ? ImpactStyle.Heavy : kind === "medium" ? ImpactStyle.Medium : ImpactStyle.Light;
  try {
    await Haptics.impact({ style });
  } catch {
    /* ignore */
  }
}

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform();
