import { create } from "zustand"

export type SettingsSection =
  | "account"
  | "security"
  | "reputation"
  | "appearance"
  | "users"

interface SettingsState {
  open: boolean
  section: SettingsSection
  /** 打开账户设置 (可指定落到哪个分区) */
  openSettings: (section?: SettingsSection) => void
  setSection: (section: SettingsSection) => void
  close: () => void
}

/**
 * 账户设置的开关状态。
 * 设置面板悬浮在当前页面上 (Discord 那种弹窗), 所以状态放这里而不是路由里,
 * 这样在任何页面点开都不会离开当前内容。
 */
export const useSettingsStore = create<SettingsState>((set) => ({
  open: false,
  section: "account",
  openSettings: (section = "account") => set({ open: true, section }),
  setSection: (section) => set({ section }),
  close: () => set({ open: false }),
}))
