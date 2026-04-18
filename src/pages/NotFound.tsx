import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-white p-6 text-center">
      <div>
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-brand-accent text-3xl font-light text-white">
          A
        </div>
        <p className="mt-8 text-8xl font-thin text-gray-200">404</p>
        <h1 className="mt-4 text-xl font-medium text-gray-900">Страница не найдена</h1>
        <p className="mt-2 text-gray-500">Страницы не существует или у вас нет доступа.</p>
        <Button className="mt-6" asChild>
          <Link to="/">На главную</Link>
        </Button>
      </div>
    </div>
  );
}
