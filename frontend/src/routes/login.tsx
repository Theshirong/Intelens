import { useState } from "react"
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"
import { useLogin, useRegister } from "@/api/auth"
import { useAuthStore } from "@/stores/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Newspaper } from "lucide-react"

export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    if (useAuthStore.getState().accessToken) {
      throw redirect({ to: "/" })
    }
  },
  component: LoginPage,
})

function LoginForm({ onSwitch, defaultUsername }: { onSwitch: () => void; defaultUsername: string }) {
  const navigate = useNavigate()
  const login = useLogin()
  const [username, setUsername] = useState(defaultUsername)
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    login.mutate(
      { username, password },
      {
        onSuccess: (data) => {
          toast.success(data.msg)
          void navigate({ to: "/" })
        },
        onError: (err) => setError(err.message),
      },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <Label htmlFor="login-username">用户名</Label>
        <Input
          id="login-username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="请输入用户名"
          autoComplete="username"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="login-password">密码</Label>
        <Input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="请输入密码"
          autoComplete="current-password"
          required
        />
      </div>
      <Button type="submit" className="w-full font-semibold" disabled={login.isPending}>
        {login.isPending ? "登录中…" : "登录"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        还没有账号?{" "}
        <button type="button" className="font-medium text-primary hover:underline" onClick={onSwitch}>
          立即注册
        </button>
      </p>
    </form>
  )
}

function RegisterForm({ onSwitch }: { onSwitch: (username: string) => void }) {
  const register = useRegister()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [passwordConfirm, setPasswordConfirm] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (password !== passwordConfirm) {
      setError("两次输入的密码不一致")
      return
    }
    register.mutate(
      { username, password, password_confirm: passwordConfirm },
      {
        onSuccess: (data) => {
          toast.success(`用户 ${data.username} 注册成功, 请登录`)
          onSwitch(username)
        },
        onError: (err) => setError(err.message),
      },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <Label htmlFor="register-username">用户名</Label>
        <Input
          id="register-username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="请设置用户名"
          autoComplete="username"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="register-password">密码</Label>
        <Input
          id="register-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="请设置密码"
          autoComplete="new-password"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="register-confirm">确认密码</Label>
        <Input
          id="register-confirm"
          type="password"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          placeholder="请再次输入密码"
          autoComplete="new-password"
          required
        />
      </div>
      <Button type="submit" className="w-full font-semibold" disabled={register.isPending}>
        {register.isPending ? "注册中…" : "注册"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        已有账号?{" "}
        <button
          type="button"
          className="font-medium text-primary hover:underline"
          onClick={() => onSwitch(username)}
        >
          返回登录
        </button>
      </p>
    </form>
  )
}

function LoginPage() {
  const [tab, setTab] = useState("login")
  const [lastUsername, setLastUsername] = useState("")

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* 品牌侧栏 */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-foreground p-12 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-md bg-white font-display text-xl font-black text-foreground">
            N
          </span>
          <span className="font-display text-lg font-black tracking-tight">NEXUS AI NEWS</span>
        </div>

        <div>
          <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/50">
            <Newspaper className="size-4" />
            Better Information, Bigger Perspective
          </p>
          <h1 className="font-display text-7xl font-black leading-[0.95] 2xl:text-8xl">
            AI
            <br />
            NEWS
            <br />
            <span className="text-white/20">INTEL·</span>
          </h1>
          <p className="mt-6 max-w-md text-lg text-white/70">
            从海量信息中，发现真正重要的 AI 动向。
          </p>
        </div>

        <div className="flex items-center justify-between text-xs text-white/40">
          <span>AI 新闻情报 · 研究 · 洞察</span>
          <span>让 AI 发现更多可能</span>
        </div>

        {/* 装饰网格 */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
      </div>

      {/* 表单区 */}
      <div className="flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md border-none shadow-none sm:border sm:shadow-sm">
          <CardHeader className="text-center">
            <CardTitle className="font-display text-2xl font-black tracking-tight">
              欢迎使用 Intelens
            </CardTitle>
            <CardDescription>AI 新闻情报工作台 · 登录后获取实时资讯</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="mb-6 grid w-full grid-cols-2">
                <TabsTrigger value="login">登录</TabsTrigger>
                <TabsTrigger value="register">注册</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <LoginForm
                  defaultUsername={lastUsername}
                  onSwitch={() => setTab("register")}
                />
              </TabsContent>
              <TabsContent value="register">
                <RegisterForm
                  onSwitch={(username) => {
                    setLastUsername(username)
                    setTab("login")
                  }}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
