export interface Project {
  id: string;
  project_ref: string;
  client_name: string;
  client_first_name?: string;
  client_last_name?: string;
  company?: string;
  phone: string;
  email?: string;
  product_name: string;
  city: string;
  postal_code: string;
  address?: string;
  surface_batiment_m2?: number;
  surface_isolee_m2?: number;
  status: string;
  assigned_to: string;
  source?: string;
  date_debut_prevue?: string;
  date_fin_prevue?: string;
  project_cost?: number;
  estimated_value?: number;
  created_at: string;
}

export const mockProjects: Project[] = [
  {
    id: "1",
    project_ref: "PRJ-2024-0089",
    client_name: "Sophie Bernard",
    client_first_name: "Sophie",
    client_last_name: "Bernard",
    company: "Cabinet Bernard",
    phone: "+33 6 12 34 56 78",
    email: "sophie.bernard@example.com",
    product_name: "Isolation Façade",
    city: "Toulouse",
    postal_code: "31000",
    address: "12 Rue du Languedoc",
    surface_batiment_m2: 200,
    surface_isolee_m2: 150,
    status: "ACCEPTE",
    assigned_to: "Jean Commercial",
    source: "Jean Commercial",
    date_debut_prevue: "2024-04-01",
    date_fin_prevue: "2024-04-15",
    project_cost: 45000,
    estimated_value: 45000,
    created_at: "2024-03-10T09:00:00Z"
  },
  {
    id: "2",
    project_ref: "PRJ-2024-0090",
    client_name: "Marie Dupont",
    client_first_name: "Marie",
    client_last_name: "Dupont",
    phone: "+33 6 98 76 54 32",
    email: "marie.dupont@example.com",
    product_name: "Pompe à Chaleur",
    city: "Paris",
    postal_code: "75015",
    address: "5 Avenue Victor Hugo",
    surface_batiment_m2: 120,
    status: "DEVIS_ENVOYE",
    assigned_to: "Sophie Commercial",
    source: "Sophie Commercial",
    date_debut_prevue: "2024-04-10",
    project_cost: 18000,
    estimated_value: 18000,
    created_at: "2024-03-12T14:30:00Z"
  },
  {
    id: "3",
    project_ref: "PRJ-2024-0091",
    client_name: "Jean Martin",
    client_first_name: "Jean",
    client_last_name: "Martin",
    phone: "+33 7 11 22 33 44",
    email: "jean.martin@example.com",
    product_name: "Panneaux Solaires",
    city: "Lyon",
    postal_code: "69003",
    address: "22 Rue Garibaldi",
    surface_batiment_m2: 85,
    status: "EN_COURS",
    assigned_to: "Marc Technicien",
    source: "Marc Technicien",
    date_debut_prevue: "2024-03-20",
    date_fin_prevue: "2024-03-25",
    project_cost: 25000,
    estimated_value: 25000,
    created_at: "2024-03-08T11:15:00Z"
  }
];
