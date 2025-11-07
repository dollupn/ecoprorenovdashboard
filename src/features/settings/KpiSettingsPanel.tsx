import { Target } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiGoalList } from "@/components/kpi/KpiGoalList";
import { useOrg } from "@/features/organizations/OrgContext";

export function KpiSettingsPanel() {
  const { currentOrgId } = useOrg();

  return (
    <div className="space-y-6">
      <Card className="border border-border/60 bg-card/70 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Target className="h-5 w-5 text-primary" />
            Objectifs KPI
          </CardTitle>
          <CardDescription>
            Configurez les objectifs stratégiques suivis dans les tableaux de bord et mesurez votre progression.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <KpiGoalList orgId={currentOrgId} />
        </CardContent>
      </Card>
    </div>
  );
}
