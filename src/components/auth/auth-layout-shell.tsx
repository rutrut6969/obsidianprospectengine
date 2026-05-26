import { Gem } from "lucide-react";

export function AuthLayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0f] prospect-grid flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-600/20 border border-purple-500/30 mb-4">
            <Gem className="h-6 w-6 text-purple-400" />
          </div>
          <h1 className="text-xl font-bold text-slate-100">Obsidian Prospect Engine</h1>
          <p className="text-sm text-slate-500 mt-1">Obsidian Systems LLC — Internal access only</p>
        </div>
        {children}
      </div>
    </div>
  );
}
