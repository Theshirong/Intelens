import { useEffect, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Loader2,
  LogOut,
  Monitor,
  Moon,
  Palette,
  Search,
  ShieldCheck,
  Sun,
  Trash2,
  UserRound,
  Users,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useTheme } from "next-themes"
import { useAllUsers, useDeleteUser } from "@/api/admin"
import {
  useChangePassword,
  useDeleteAccount,
  useLogout,
  useMe,
  useUpdateProfile,
} from "@/api/auth"
import { useAuthStore } from "@/stores/auth"
import { useSettingsStore, type SettingsSection } from "@/stores/settings"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"

/* ---------------- 左侧设置目录 ---------------- */

interface SectionMeta {
  id: SettingsSection
  label: string
  icon: LucideIcon
}

const SECTION_GROUPS: Array<{ group: string; adminOnly?: boolean; items: SectionMeta[] }> = [
  {
    group: "账户",
    items: [
      { id: "account", label: "账号信息", icon: UserRound },
      { id: "security", label: "密码和安全中心", icon: KeyRound },
      { id: "reputation", label: "账号信誉", icon: ShieldCheck },
    ],
  },
  {
    group: "管理",
    adminOnly: true,
    items: [{ id: "users", label: "用户管理", icon: Users }],
  },
  {
    group: "体验",
    items: [{ id: "appearance", label: "外观", icon: Palette }],
  },
]

/* ---------------- 通用行 ---------------- */

/** 设置行: 左侧标题 (+说明), 右侧值或操作 */
function SettingRow({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-4">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="mt-1 max-w-md text-xs text-muted-foreground">{hint}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-3 text-sm">{children}</div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-bold tracking-tight">{children}</h2>
}

/* ---------------- 账号信息 ---------------- */

function AccountPane() {
  const navigate = useNavigate()
  const { data: user } = useMe()
  const deleteAccount = useDeleteAccount()
  const updateProfile = useUpdateProfile()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [editingName, setEditingName] = useState(false)
  const [username, setUsername] = useState("")
  const [nameError, setNameError] = useState("")

  const closeDialog = () => {
    setOpen(false)
    setPassword("")
    setError("")
  }

  const handleConfirm = () => {
    setError("")
    deleteAccount.mutate(password, {
      onSuccess: (data) => {
        toast.success(data.msg)
        void navigate({ to: "/login" })
      },
      onError: (err) => setError(err.message),
    })
  }

  const openNameDialog = () => {
    setUsername(user?.username ?? "")
    setNameError("")
    setEditingName(true)
  }

  const closeNameDialog = () => {
    setEditingName(false)
    setNameError("")
  }

  const submitUsername = (event: React.FormEvent) => {
    event.preventDefault()
    const next = username.trim()
    if (next.length < 3 || next.length > 20) {
      setNameError("用户名长度需在 3-20 个字符之间")
      return
    }
    if (next === user?.username) {
      closeNameDialog()
      return
    }
    setNameError("")
    updateProfile.mutate(
      { username: next },
      {
        onSuccess: (data) => {
          toast.success(`用户名已更新为 ${data.username}`)
          closeNameDialog()
        },
        onError: (err) => setNameError(err.message),
      },
    )
  }

  return (
    <div className="divide-y">
      <section className="pb-8">
        <SectionTitle>账号信息</SectionTitle>
        <div className="mt-2 divide-y">
          <SettingRow label="用户名" hint="用于登录, 也是论坛里显示的名字。">
            <span className="font-medium">{user?.username ?? "…"}</span>
            <Button variant="outline" onClick={openNameDialog} disabled={!user}>
              编辑
            </Button>
          </SettingRow>
          <SettingRow label="用户 ID">
            <span className="font-medium tabular-nums">{user?.id ?? "—"}</span>
          </SettingRow>
          <SettingRow label="角色">
            {user?.role === "admin" ? (
              <Badge className="gap-1 font-medium">
                <ShieldCheck className="size-3" />
                管理员
              </Badge>
            ) : (
              <Badge variant="secondary" className="font-medium">
                成员
              </Badge>
            )}
          </SettingRow>
          <SettingRow label="注册时间">
            <span className="tabular-nums">{formatDate(user?.created_at)}</span>
          </SettingRow>
        </div>
      </section>

      <section className="pt-8">
        <SectionTitle>停用您的账号</SectionTitle>
        <div className="divide-y">
          <SettingRow label="注销账号" hint="注销后该用户名及其数据将被永久删除且不可恢复。">
            <Button variant="destructive" onClick={() => setOpen(true)}>
              <Trash2 className="size-4" />
              注销账号
            </Button>
          </SettingRow>
        </div>
      </section>

      <Dialog open={open} onOpenChange={(value) => (value ? setOpen(true) : closeDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认注销账号?</DialogTitle>
            <DialogDescription>此操作不可撤销。请输入当前密码以确认身份。</DialogDescription>
          </DialogHeader>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="delete-password">当前密码</Label>
            <Input
              id="delete-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={deleteAccount.isPending || !password}
            >
              {deleteAccount.isPending && <Loader2 className="size-4 animate-spin" />}
              确认注销
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editingName}
        onOpenChange={(value) => (value ? setEditingName(true) : closeNameDialog())}
      >
        <DialogContent className="max-w-md">
          <form onSubmit={submitUsername} className="grid gap-5">
            <DialogHeader>
              <DialogTitle>更新用户名</DialogTitle>
              <DialogDescription>
                用户名用于登录, 也会显示在论坛的帖子和评论上。
              </DialogDescription>
            </DialogHeader>

            {nameError && (
              <Alert variant="destructive">
                <AlertDescription>{nameError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="profile-username">
                用户名 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="profile-username"
                autoFocus
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                minLength={3}
                maxLength={20}
                autoComplete="username"
                required
              />
            </div>

            <DialogFooter className="gap-2 sm:space-x-0">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={closeNameDialog}
              >
                取消
              </Button>
              <Button type="submit" className="flex-1" disabled={updateProfile.isPending}>
                {updateProfile.isPending && <Loader2 className="size-4 animate-spin" />}
                完成
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ---------------- 密码和安全中心 ---------------- */

function SecurityPane() {
  const navigate = useNavigate()
  const changePassword = useChangePassword()
  const logout = useLogout()
  const [open, setOpen] = useState(false)
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")

  const closeDialog = () => {
    setOpen(false)
    setOldPassword("")
    setNewPassword("")
    setConfirmPassword("")
    setError("")
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setError("")
    if (newPassword !== confirmPassword) {
      setError("两次输入的新密码不一致")
      return
    }
    changePassword.mutate(
      { old_password: oldPassword, new_password: newPassword },
      {
        onSuccess: (data) => {
          closeDialog()
          toast.success(data.msg)
          logout.mutate(undefined, {
            onSettled: () => void navigate({ to: "/login" }),
          })
        },
        onError: (err) => setError(err.message),
      },
    )
  }

  return (
    <section>
      <SectionTitle>密码和安全中心</SectionTitle>
      <div className="mt-2 divide-y">
        <SettingRow label="密码" hint="修改成功后将自动退出登录, 请使用新密码重新登录。">
          <Button variant="outline" onClick={() => setOpen(true)}>
            编辑
          </Button>
        </SettingRow>
      </div>

      <Dialog open={open} onOpenChange={(value) => (value ? setOpen(true) : closeDialog())}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleSubmit} className="grid gap-5">
            <DialogHeader>
              <DialogTitle>更新密码</DialogTitle>
              <DialogDescription>输入当前密码和新密码。</DialogDescription>
            </DialogHeader>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="old-password">
                当前密码 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="old-password"
                type="password"
                autoFocus
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">
                新密码 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-new-password">
                确认新密码 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="confirm-new-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>

            <DialogFooter className="gap-2 sm:space-x-0">
              <Button type="button" variant="secondary" className="flex-1" onClick={closeDialog}>
                取消
              </Button>
              <Button type="submit" className="flex-1" disabled={changePassword.isPending}>
                {changePassword.isPending && <Loader2 className="size-4 animate-spin" />}
                完成
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}

/* ---------------- 账号信誉 ---------------- */

function ReputationPane() {
  const { data: user } = useMe()
  const isAdmin = user?.role === "admin"

  return (
    <section>
      <SectionTitle>账号信誉</SectionTitle>
      <div className="mt-2 divide-y">
        <SettingRow label="账号状态">
          <span className="flex items-center gap-2 text-emerald-500">
            <CheckCircle2 className="size-4" />
            一切正常
          </span>
        </SettingRow>
        <SettingRow
          label="权限范围"
          hint={
            isAdmin
              ? "管理员可以管理用户, 并删除任意论坛帖子与评论。"
              : "成员可以浏览全部公开内容, 并在论坛发帖、评论。"
          }
        >
          <Badge variant="secondary" className="font-medium">
            {isAdmin ? "管理员" : "成员"}
          </Badge>
        </SettingRow>
        <SettingRow label="注册时间">
          <span className="tabular-nums">{formatDate(user?.created_at)}</span>
        </SettingRow>
      </div>
    </section>
  )
}

/* ---------------- 外观 ---------------- */

const THEME_OPTIONS = [
  { value: "light", label: "浅色", icon: Sun },
  { value: "dark", label: "深色", icon: Moon },
  { value: "system", label: "跟随系统", icon: Monitor },
] as const

function AppearancePane() {
  const { theme, setTheme } = useTheme()

  return (
    <section>
      <SectionTitle>外观</SectionTitle>
      <div className="mt-2 divide-y">
        <SettingRow label="主题" hint="选择界面的明暗风格, 深色模式对夜间阅读更友好。">
          <div className="flex flex-wrap gap-2">
            {THEME_OPTIONS.map((option) => {
              const Icon = option.icon
              const active = (theme ?? "system") === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTheme(option.value)}
                  aria-pressed={active}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors",
                    active
                      ? "border-foreground/30 bg-secondary font-medium"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  {option.label}
                </button>
              )
            })}
          </div>
        </SettingRow>
      </div>
    </section>
  )
}

/* ---------------- 用户管理 (管理员) ---------------- */

function UsersPane() {
  const currentUser = useAuthStore((s) => s.user)
  const [page, setPage] = useState(1)
  const pageSize = 10
  const { data, isPending } = useAllUsers(page, pageSize)
  const deleteUser = useDeleteUser()
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; username: string } | null>(null)
  const [adminPassword, setAdminPassword] = useState("")
  const [deleteError, setDeleteError] = useState("")

  const totalPages = data?.pages ?? 0

  const closeDeleteDialog = () => {
    setDeleteTarget(null)
    setAdminPassword("")
    setDeleteError("")
  }

  const submitDelete = (event: React.FormEvent) => {
    event.preventDefault()
    if (!deleteTarget || !adminPassword) return
    setDeleteError("")
    deleteUser.mutate(
      { userId: deleteTarget.id, password: adminPassword },
      {
        onSuccess: (res) => {
          toast.success(res.msg)
          closeDeleteDialog()
        },
        // 密码错误等失败原因留在弹窗里提示, 方便直接重试
        onError: (err) => setDeleteError(err.message),
      },
    )
  }

  return (
    <section>
      <SectionTitle>用户管理</SectionTitle>
      <p className="mt-1 text-xs text-muted-foreground">
        {data ? `共 ${data.total} 个用户` : "加载中…"}
      </p>

      <div className="mt-4 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">ID</TableHead>
              <TableHead>用户名</TableHead>
              <TableHead className="w-24">角色</TableHead>
              <TableHead className="w-32">注册时间</TableHead>
              <TableHead className="w-20 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5} className="h-12">
                      <span className="block h-4 w-full animate-pulse rounded bg-muted" />
                    </TableCell>
                  </TableRow>
                ))
              : data?.items.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="tabular-nums">{user.id}</TableCell>
                    <TableCell className="font-medium">
                      {user.username}
                      {user.id === currentUser?.id && (
                        <span className="ml-2 text-xs text-muted-foreground">(我)</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.role === "admin" ? (
                        <Badge className="font-medium">管理员</Badge>
                      ) : (
                        <Badge variant="secondary" className="font-medium">
                          成员
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {formatDate(user.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={`删除用户 ${user.username}`}
                        disabled={user.id === currentUser?.id}
                        onClick={() => setDeleteTarget({ id: user.id, username: user.username })}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex justify-center">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  aria-disabled={page <= 1}
                  className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                  onClick={(e) => {
                    e.preventDefault()
                    if (page > 1) setPage(page - 1)
                  }}
                />
              </PaginationItem>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <PaginationItem key={p}>
                  <PaginationLink
                    href="#"
                    isActive={p === page}
                    onClick={(e) => {
                      e.preventDefault()
                      setPage(p)
                    }}
                  >
                    {p}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  aria-disabled={page >= totalPages}
                  className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
                  onClick={(e) => {
                    e.preventDefault()
                    if (page < totalPages) setPage(page + 1)
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) closeDeleteDialog()
        }}
      >
        <DialogContent>
          <form onSubmit={submitDelete} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>确认删除用户?</DialogTitle>
              <DialogDescription>
                将永久删除用户 {deleteTarget?.username} (ID: {deleteTarget?.id}), 此操作不可恢复。
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              {deleteError && (
                <Alert variant="destructive">
                  <AlertDescription>{deleteError}</AlertDescription>
                </Alert>
              )}
              <Label htmlFor="admin-password">管理员密码</Label>
              <Input
                id="admin-password"
                type="password"
                autoFocus
                autoComplete="current-password"
                value={adminPassword}
                onChange={(event) => setAdminPassword(event.target.value)}
                placeholder="删除用户需要验证你的密码"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDeleteDialog}>
                取消
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={deleteUser.isPending || !adminPassword}
              >
                {deleteUser.isPending && <Loader2 className="size-4 animate-spin" />}
                确认删除
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}

/* ---------------- 设置面板 ---------------- */

/**
 * 账户设置: 悬浮在当前页面上的大面板 (Discord 的「用户设置」那种),
 * 左侧是可搜索的设置目录, 右侧是分区内容; 窄屏切成「目录 -> 内容」两屏。
 */
export function AccountSettingsDialog() {
  const navigate = useNavigate()
  const logout = useLogout()
  const { data: user } = useMe()
  const isAdmin = user?.role === "admin"
  const open = useSettingsStore((s) => s.open)
  const section = useSettingsStore((s) => s.section)
  const setSection = useSettingsStore((s) => s.setSection)
  const close = useSettingsStore((s) => s.close)
  const [keyword, setKeyword] = useState("")
  const [mobilePane, setMobilePane] = useState<"nav" | "content">("nav")

  // 每次打开都回到目录/默认分区, 不残留上次的窄屏状态
  useEffect(() => {
    if (open) {
      setKeyword("")
      setMobilePane("nav")
    }
  }, [open])

  const needle = keyword.trim()
  const groups = SECTION_GROUPS.filter((group) => !group.adminOnly || isAdmin)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !needle || item.label.includes(needle)),
    }))
    .filter((group) => group.items.length > 0)

  const activeGroup =
    SECTION_GROUPS.find((group) => group.items.some((item) => item.id === section))?.group ?? "账户"

  const selectSection = (id: SettingsSection) => {
    setSection(id)
    setMobilePane("content")
  }

  const handleLogout = () =>
    logout.mutate(undefined, {
      onSuccess: (data) => {
        close()
        toast.success(data.msg)
        void navigate({ to: "/login" })
      },
    })

  return (
    <Dialog open={open} onOpenChange={(value) => (value ? undefined : close())}>
      <DialogContent className="h-[min(100dvh-1.5rem,44rem)] w-[min(100vw-1.5rem,62rem)] max-w-none gap-0 overflow-hidden border bg-card p-0 sm:rounded-xl">
        <DialogTitle className="sr-only">账户设置</DialogTitle>

        <div className="flex h-full min-h-0">
          {/* 设置目录 */}
          <aside
            className={cn(
              "w-full shrink-0 flex-col border-r bg-secondary/30 lg:flex lg:w-60",
              mobilePane === "content" ? "hidden" : "flex",
            )}
          >
            <div className="flex items-center gap-2.5 px-3 pb-2 pt-3">
              <Avatar className="size-9 border">
                <AvatarFallback className="bg-foreground text-sm font-bold text-background">
                  {(user?.username ?? "U").slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{user?.username ?? "…"}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {isAdmin ? "管理员" : "成员"} · UID {user?.id ?? "—"}
                </div>
              </div>
            </div>

            <div className="px-3 pb-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="搜索"
                  aria-label="搜索设置项"
                  className="h-8 bg-background/60 pl-8 text-sm"
                />
              </div>
            </div>

            <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
              {groups.length > 0 ? (
                groups.map((group) => (
                  <div key={group.group} className="mb-2">
                    <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {group.group}
                    </div>
                    {group.items.map((item) => {
                      const Icon = item.icon
                      const active = item.id === section
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => selectSection(item.id)}
                          aria-current={active}
                          className={cn(
                            "flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors",
                            active
                              ? "bg-secondary font-medium text-foreground"
                              : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                          )}
                        >
                          <Icon className="size-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      )
                    })}
                  </div>
                ))
              ) : (
                <p className="px-2 py-4 text-xs text-muted-foreground">没有匹配的设置项</p>
              )}
            </nav>

            <div className="border-t p-2">
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-destructive transition-colors hover:bg-destructive/10"
              >
                <LogOut className="size-4" />
                退出
              </button>
            </div>
          </aside>

          {/* 设置内容 */}
          <section
            className={cn(
              "min-w-0 flex-1 flex-col",
              mobilePane === "nav" ? "hidden lg:flex" : "flex",
            )}
          >
            <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 sm:px-5">
              <button
                type="button"
                onClick={() => setMobilePane("nav")}
                aria-label="回到设置目录"
                className="-ml-1 rounded p-1 text-muted-foreground transition-colors hover:text-foreground lg:hidden"
              >
                <ArrowLeft className="size-4" />
              </button>
              <span className="text-sm font-semibold">{activeGroup}</span>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-10 sm:py-8">
              {section === "account" && <AccountPane />}
              {section === "security" && <SecurityPane />}
              {section === "reputation" && <ReputationPane />}
              {section === "appearance" && <AppearancePane />}
              {section === "users" && isAdmin && <UsersPane />}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
