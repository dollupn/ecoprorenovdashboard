import {
  BellIcon,
  CalendarIcon,
  FileTextIcon,
  GlobeIcon,
  InputIcon,
} from "@radix-ui/react-icons";

import { BentoCard, BentoGrid } from "@/components/ui/bento-grid";

const features = [
  {
    Icon: FileTextIcon,
    name: "Suivi documentaire",
    description: "Tous vos devis, contrats et rapports sont sauvegardés automatiquement.",
    href: "/projects",
    cta: "Ouvrir la bibliothèque",
    background: (
      <img
        src="https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=800&q=80"
        alt="Documents de projet organisés sur un bureau"
        className="absolute -right-20 -top-20 h-64 w-64 rounded-full object-cover opacity-60"
        loading="lazy"
      />
    ),
    className: "lg:row-start-1 lg:row-end-4 lg:col-start-2 lg:col-end-3",
  },
  {
    Icon: InputIcon,
    name: "Recherche plein texte",
    description: "Retrouvez instantanément un dossier ou une note en tapant quelques mots-clés.",
    href: "/projects",
    cta: "Rechercher un dossier",
    background: (
      <img
        src="https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=800&q=80"
        alt="Recherche de projets sur un ordinateur portable"
        className="absolute -right-20 -top-20 h-64 w-64 rounded-full object-cover opacity-60"
        loading="lazy"
      />
    ),
    className: "lg:col-start-1 lg:col-end-2 lg:row-start-1 lg:row-end-3",
  },
  {
    Icon: GlobeIcon,
    name: "Collaboration multisite",
    description: "Coordonnez vos équipes sur plusieurs chantiers et partagez les mises à jour en temps réel.",
    href: "/projects",
    cta: "Voir les équipes",
    background: (
      <img
        src="https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80"
        alt="Équipe collaborant autour d'un ordinateur"
        className="absolute -right-20 -top-20 h-64 w-64 rounded-full object-cover opacity-60"
        loading="lazy"
      />
    ),
    className: "lg:col-start-1 lg:col-end-2 lg:row-start-3 lg:row-end-4",
  },
  {
    Icon: CalendarIcon,
    name: "Calendrier intelligent",
    description: "Filtrez vos projets par jalons clés et visualisez les prochaines échéances.",
    href: "/projects",
    cta: "Ouvrir le planning",
    background: (
      <img
        src="https://images.unsplash.com/photo-1506784242126-2a0b0b89c56a?auto=format&fit=crop&w=800&q=80"
        alt="Calendrier numérique avec des rappels"
        className="absolute -right-20 -top-20 h-56 w-56 rounded-full object-cover opacity-60"
        loading="lazy"
      />
    ),
    className: "lg:col-start-3 lg:col-end-3 lg:row-start-1 lg:row-end-2",
  },
  {
    Icon: BellIcon,
    name: "Alertes automatiques",
    description:
      "Recevez une notification quand un chantier change de statut ou lorsqu'un document est partagé.",
    href: "/projects",
    cta: "Configurer les alertes",
    background: (
      <img
        src="https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80"
        alt="Notification sur smartphone"
        className="absolute -right-20 -top-20 h-64 w-64 rounded-full object-cover opacity-60"
        loading="lazy"
      />
    ),
    className: "lg:col-start-3 lg:col-end-3 lg:row-start-2 lg:row-end-4",
  },
];

function BentoDemo() {
  return (
    <BentoGrid className="lg:grid-rows-3">
      {features.map((feature) => (
        <BentoCard key={feature.name} {...feature} />
      ))}
    </BentoGrid>
  );
}

export { BentoDemo };
