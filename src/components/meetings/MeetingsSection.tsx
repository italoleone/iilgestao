import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic } from "lucide-react";
import { MeetingRecorder } from "./MeetingRecorder";
import { MeetingsList } from "./MeetingsList";

interface MeetingsSectionProps {
  projectId: string;
}

export function MeetingsSection({ projectId }: MeetingsSectionProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <Card className="shadow-sm animate-reveal-up delay-5" style={{ animationFillMode: "backwards" }}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Mic className="h-4 w-4" /> Reuniões / Atas
          </CardTitle>
          <MeetingRecorder
            projectId={projectId}
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
