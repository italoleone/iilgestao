import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, Users } from "lucide-react";
import { MeetingRecorder } from "./MeetingRecorder";
import { MeetingsList } from "./MeetingsList";

interface MeetingsSectionProps {
  projectId: string;
  mode: "remoto" | "presencial";
}

export function MeetingsSection({ projectId, mode }: MeetingsSectionProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <Card className="shadow-sm animate-reveal-up delay-5" style={{ animationFillMode: "backwards" }}>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            {mode === "presencial" ? (
              <>
                <Users className="h-4 w-4" /> Reuniões Presenciais / Atas
              </>
            ) : (
              <>
                <Mic className="h-4 w-4" /> Reuniões / Atas
              </>
            )}
          </CardTitle>
          <MeetingRecorder
            projectId={projectId}
            mode={mode}
            onRecordingSaved={() => setRefreshKey((k) => k + 1)}
          />
        </div>
      </CardHeader>
      <CardContent>
        <MeetingsList projectId={projectId} refreshKey={refreshKey} />
      </CardContent>
    </Card>
  );
}
