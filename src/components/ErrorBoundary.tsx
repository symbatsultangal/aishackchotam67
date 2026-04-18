import React from "react";
import { Button } from "@/components/ui/button";

type State = { error: Error | null };

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-dvh items-center justify-center bg-white p-6">
        <div className="max-w-xl text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand-accent text-2xl font-light text-white">
            A
          </div>
          <h1 className="mt-5 text-xl font-medium">Что-то пошло не так</h1>
          <p className="mt-2 text-gray-500">Данные не сохранились. Попробуй обновить страницу.</p>
          <Button className="mt-5" onClick={() => window.location.reload()}>
            Обновить страницу
          </Button>
          <details className="mt-5 text-left text-xs text-gray-500">
            <summary>Технические детали</summary>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-3">
              {this.state.error.message}
              {"\n"}
              {this.state.error.stack}
            </pre>
          </details>
          <p className="mt-4 text-xs text-gray-400">
            Если повторится, передай детали администратору
          </p>
        </div>
      </div>
    );
  }
}
