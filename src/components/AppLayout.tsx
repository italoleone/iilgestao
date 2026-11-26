import { AppSidebar } from "@/components/AppSidebar";
import { AssistantChat } from "@/components/assistant/AssistantChat";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex w-full">
      <AppSidebar />
      <main className="flex-1 overflow-auto p-6 bg-background">
        {children}
      </main>
      <AssistantChat />
    </div>
  );
}
