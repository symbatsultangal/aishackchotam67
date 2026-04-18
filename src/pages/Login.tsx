import { useState } from "react";
import { Buildings, Eye, EyeSlash } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEMO_ACCOUNTS, login } from "@/lib/auth";
import { routeForRole } from "@/lib/utils";

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = login(email, password);
      toast.success(`Добро пожаловать, ${user.name}!`);
      navigate(routeForRole(user.role), { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Заполни все обязательные поля");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-dvh bg-white md:grid-cols-2">
      <section className="hidden items-center justify-center bg-gradient-to-br from-brand-purple to-[#3B1757] p-10 md:flex">
        <div>
          <Buildings className="mb-8 size-24 text-white/20" aria-hidden />
          <h1 className="text-5xl font-light text-white">Digital Vice Principal</h1>
          <p className="mt-4 text-white/60">AI-powered school operations</p>
        </div>
      </section>
      <section className="flex items-center justify-center p-6">
        <form className="w-full max-w-sm" onSubmit={(event) => void submit(event)}>
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-accent text-2xl font-light text-white">
            A
          </div>
          <h2 className="mt-6 text-center text-2xl font-medium text-gray-900">С возвращением</h2>
          <p className="mt-2 text-center text-sm text-gray-500">
            Войдите в систему управления школой
          </p>
          <div className="mt-8 flex flex-col gap-4">
            <label className="flex flex-col gap-2 text-sm font-medium text-gray-700">
              Email
              <motion.div animate={{ scale: email ? 1.01 : 1 }}>
                <Input value={email} onChange={(event) => setEmail(event.target.value)} />
              </motion.div>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-gray-700">
              Пароль
              <span className="relative">
                <Input
                  className="pr-12"
                  value={password}
                  type={showPassword ? "text" : "password"}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  className="absolute right-1 top-0 flex size-11 items-center justify-center rounded-lg text-gray-400"
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeSlash aria-hidden /> : <Eye aria-hidden />}
                  <span className="sr-only">Показать пароль</span>
                </button>
              </span>
            </label>
            <Button className="h-11 w-full" disabled={loading}>
              {loading ? "Проверяем доступ..." : "Войти в систему"}
            </Button>
            {error ? <p className="text-sm text-error">{error}</p> : null}
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {DEMO_ACCOUNTS.slice(0, 4).map((account) => (
              <button
                key={account.email}
                className="inline-flex min-h-9 items-center gap-2 rounded-full border border-gray-200 px-3 text-xs text-gray-600 hover:border-brand-accent hover:text-brand-accent"
                type="button"
                onClick={() => {
                  setEmail(account.email);
                  setPassword(account.password);
                }}
              >
                <span className="size-2 rounded-full bg-brand-accent" />
                {account.role === "director"
                  ? "Директор"
                  : account.role === "viceprincipal"
                    ? "Завуч"
                    : account.role === "teacher"
                      ? "Учитель"
                      : "Администратор"}
              </button>
            ))}
          </div>
        </form>
      </section>
    </div>
  );
}
