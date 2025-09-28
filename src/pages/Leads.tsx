import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  Phone, 
  Mail, 
  MapPin,
  Building,
  FileX
} from "lucide-react";

interface Lead {
  id: string;
  full_name: string;
  company?: string;
  email: string;
  phone_raw: string;
  city: string;
  postal_code: string;
  product_name?: string;
  surface_m2?: number;
  utm_source?: string;
  status: "NEW" | "QUALIFIED" | "RDV_PLANIFIE" | "CONVERTED" | "ARCHIVED";
  date_rdv?: string;
  heure_rdv?: string;
  commentaire?: string;
  created_at: string;
}

const mockLeads: Lead[] = [
  {
    id: "1",
    full_name: "Marie Dupont",
    company: "SARL Dupont",
    email: "marie.dupont@email.com",
    phone_raw: "06 12 34 56 78",
    city: "Paris",
    postal_code: "75015",
    product_name: "Isolation Combles",
    surface_m2: 120,
    utm_source: "Google Ads",
    status: "NEW",
    commentaire: "Maison de 1970, intéressée par les aides CEE",
    created_at: "2024-03-15T10:30:00Z"
  },
  {
    id: "2",
    full_name: "Jean Martin",
    email: "j.martin@gmail.com",
    phone_raw: "07 98 76 54 32",
    city: "Lyon",
    postal_code: "69003",
    product_name: "Pompe à Chaleur",
    surface_m2: 85,
    utm_source: "Site Web",
    status: "RDV_PLANIFIE",
    date_rdv: "2024-03-20",
    heure_rdv: "14:30",
    commentaire: "Remplacement chaudière fioul",
    created_at: "2024-03-14T15:20:00Z"
  },
  {
    id: "3",
    full_name: "Sophie Bernard",
    company: "Cabinet Bernard",
    email: "sophie@cabinet-bernard.fr",
    phone_raw: "05 43 21 98 76",
    city: "Toulouse",
    postal_code: "31000",
    product_name: "Panneaux Solaires",
    surface_m2: 200,
    utm_source: "Facebook",
    status: "QUALIFIED",
    commentaire: "Projet pour bureaux, budget 50k€",
    created_at: "2024-03-13T09:15:00Z"
  }
];

const getStatusLabel = (status: Lead["status"]) => {
  const labels = {
    NEW: "Nouveau",
    QUALIFIED: "Qualifié",
    RDV_PLANIFIE: "RDV Planifié",
    CONVERTED: "Converti",
    ARCHIVED: "Archivé"
  };
  return labels[status];
};

const getStatusColor = (status: Lead["status"]) => {
  const colors = {
    NEW: "bg-blue-500/10 text-blue-700 border-blue-200",
    QUALIFIED: "bg-orange-500/10 text-orange-700 border-orange-200",
    RDV_PLANIFIE: "bg-purple-500/10 text-purple-700 border-purple-200",
    CONVERTED: "bg-green-500/10 text-green-700 border-green-200",
    ARCHIVED: "bg-gray-500/10 text-gray-700 border-gray-200"
  };
  return colors[status];
};

const Leads = () => {
  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Gestion des Leads
            </h1>
            <p className="text-muted-foreground mt-1">
              Prospection et qualification des demandes entrantes
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <FileX className="w-4 h-4 mr-2" />
              Importer CSV
            </Button>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nouveau Lead
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="shadow-card bg-gradient-card border-0">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Rechercher par nom, email, téléphone..." 
                  className="pl-10"
                />
              </div>
              <Button variant="outline">
                <Filter className="w-4 h-4 mr-2" />
                Filtres
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Leads Table */}
        <Card className="shadow-card bg-gradient-card border-0">
          <CardHeader>
            <CardTitle>Leads Récents ({mockLeads.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockLeads.map((lead) => (
                <div 
                  key={lead.id} 
                  className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                        <span className="font-semibold text-primary">
                          {lead.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">
                          {lead.full_name}
                        </h3>
                        {lead.company && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Building className="w-3 h-3" />
                            {lead.company}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge className={getStatusColor(lead.status)}>
                      {getStatusLabel(lead.status)}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        {lead.phone_raw}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        {lead.email}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        {lead.city} ({lead.postal_code})
                      </div>
                      {lead.product_name && (
                        <div className="text-sm">
                          <span className="font-medium">{lead.product_name}</span>
                          {lead.surface_m2 && <span className="text-muted-foreground"> • {lead.surface_m2} m²</span>}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      {lead.date_rdv && lead.heure_rdv && (
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4 text-primary" />
                          <span className="text-primary font-medium">
                            {new Date(lead.date_rdv).toLocaleDateString('fr-FR')} à {lead.heure_rdv}
                          </span>
                        </div>
                      )}
                      {lead.utm_source && (
                        <div className="text-sm text-muted-foreground">
                          Source: {lead.utm_source}
                        </div>
                      )}
                    </div>
                  </div>

                  {lead.commentaire && (
                    <div className="mb-3 p-3 bg-muted/50 rounded text-sm">
                      {lead.commentaire}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t">
                    <span className="text-xs text-muted-foreground">
                      Créé le {new Date(lead.created_at).toLocaleDateString('fr-FR')}
                    </span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        <Calendar className="w-4 h-4 mr-1" />
                        Planifier RDV
                      </Button>
                      <Button size="sm">
                        Créer Projet
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Leads;