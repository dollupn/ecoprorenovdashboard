import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";

const mockData = [
  { month: "Jan", facture: 85000, encaisse: 78000 },
  { month: "Fév", facture: 92000, encaisse: 85000 },
  { month: "Mar", facture: 78000, encaisse: 92000 },
  { month: "Avr", facture: 106000, encaisse: 78000 },
  { month: "Mai", facture: 125000, encaisse: 106000 },
  { month: "Juin", facture: 118000, encaisse: 125000 },
];

export function RevenueChart() {
  return (
    <Card className="shadow-card bg-gradient-card border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Chiffre d'Affaires
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mockData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis 
                dataKey="month" 
                className="text-muted-foreground"
                fontSize={12}
              />
              <YAxis 
                className="text-muted-foreground"
                fontSize={12}
                tickFormatter={(value) => `${value / 1000}k€`}
              />
              <Tooltip 
                formatter={(value: number) => [`${value.toLocaleString()}€`, ""]}
                labelFormatter={(label) => `Mois: ${label}`}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Bar 
                dataKey="facture" 
                name="CA Facturé"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
              />
              <Bar 
                dataKey="encaisse" 
                name="CA Encaissé"
                fill="hsl(var(--accent))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <div className="w-3 h-3 rounded bg-primary" />
              <span className="text-sm text-muted-foreground">CA Facturé</span>
            </div>
            <p className="text-lg font-bold text-foreground mt-1">125 000€</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <div className="w-3 h-3 rounded bg-accent" />
              <span className="text-sm text-muted-foreground">CA Encaissé</span>
            </div>
            <p className="text-lg font-bold text-foreground mt-1">106 000€</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}