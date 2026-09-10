import { useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"
import { KeyRound, Loader2, LogOut, ShieldCheck, Trash2, UserRound } from "lucide-react"
import { useAllUsers, useDeleteUser } from "@/api/admin"
import { useChangePassword, useDeleteAccount, useLogout, useMe } from "@/api/auth"
import { useAuthStore } from "@/stores/auth"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { SectionHeader } from "@/components/home/hero"
import { formatDate } from "@/lib/format"

export const Route = createFileRoute("/_app/workspace")({
  component: WorkspacePage,
})

/* ---------------- 个人资料 ---------------- */

function ProfileCard() {
  const { data: user } = useMe()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserRound className="size-4 text-muted-foreground" />
          个人资料
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar className="size-14 border">
            <AvatarFallback className="bg-foreground text-lg font-bold text-background">
              {(user?.username ?? "U").slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-lg font-bold">{user?.username ?? "…"}</span>
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
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">
              UID {user?.id ?? "—"} · 注册于 {formatDate(user?.created_at)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/* ---------------- 修改密码 ---------------- */

function PasswordCard() {
  const navigate = useNavigate()
  const changePassword = useChangePassword()
  const logout = useLogout()
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (newPassword !== confirmPassword) {
      setError("两次输入的新密码不一致")
      return
    }
    changePassword.mutate(
      { old_password: oldPassword, new_password: newPassword },
      {
        onSuccess: (data) => {
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="size-4 text-muted-foreground" />
          修改密码
        </CardTitle>
        <CardDescription>修改成功后将自动退出登录, 请使用新密码重新登录</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="old-password">当前密码</Label>
            <Input
              id="old-password"
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">新密码</Label>
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
            <Label htmlFor="confirm-new-password">确认新密码</Label>
            <Input
              id="confirm-new-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          <Button type="submit" disabled={changePassword.isPending}>
            {changePassword.isPending && <Loader2 className="size-4 animate-spin" />}
            确认修改
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

/* ---------------- 注销账号 ---------------- */

function DangerZoneCard() {
  const navigate = useNavigate()
  const deleteAccount = useDeleteAccount()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

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

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-destructive">
          <Trash2 className="size-4" />
          危险操作
        </CardTitle>
        <CardDescription>注销账号后, 该用户名及其数据将被永久删除且不可恢复</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          注销账号
        </Button>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>确认注销账号?</DialogTitle>
              <DialogDescription>
                此操作不可撤销。请输入当前密码以确认身份。
              </DialogDescription>
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
              <Button variant="outline" onClick={() => setOpen(false)}>
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
      </CardContent>
    </Card>
  )
}

/* ---------------- 管理员: 用户管理 ---------------- */

function AdminUsersCard() {
  const currentUser = useAuthStore((s) => s.user)
  const [page, setPage] = useState(1)
  const pageSize = 10
  const { data, isPending } = useAllUsers(page, pageSize)
  const deleteUser = useDeleteUser()
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; username: string } | null>(null)

  const totalPages = data?.pages ?? 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="size-4 text-muted-foreground" />
          用户管理
        </CardTitle>
        <CardDescription>
          {data ? `共 ${data.total} 个用户` : "加载中…"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
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
            if (!open) setDeleteTarget(null)
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>确认删除用户?</DialogTitle>
              <DialogDescription>
                将永久删除用户 {deleteTarget?.username} (ID: {deleteTarget?.id}), 此操作不可恢复。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                取消
              </Button>
              <Button
                variant="destructive"
                disabled={deleteUser.isPending}
                onClick={() => {
                  if (!deleteTarget) return
                  deleteUser.mutate(deleteTarget.id, {
                    onSuccess: (res) => {
                      toast.success(res.msg)
                      setDeleteTarget(null)
                    },
                    onError: (err) => toast.error(err.message),
                  })
                }}
              >
                {deleteUser.isPending && <Loader2 className="size-4 animate-spin" />}
                确认删除
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

/* ---------------- 页面 ---------------- */

function WorkspacePage() {
  const { data: user } = useMe()
  const isAdmin = user?.role === "admin"

  return (
    <div className="container py-10 lg:py-12">
      <SectionHeader eyebrow="Workspace" title="工作台" />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <ProfileCard />
          <PasswordCard />
          <DangerZoneCard />
        </div>
        {isAdmin ? (
          <AdminUsersCard />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <LogOut className="size-4 text-muted-foreground" />
                提示
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              用户管理功能仅对管理员开放。如需管理用户, 请联系管理员。
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
