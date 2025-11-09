import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const sections = [
  {
    id: "responsable",
    title: "Responsable du traitement",
    content: (
      <p className="text-muted-foreground">
        EcoProRenov, société spécialisée dans la gestion de projets de rénovation énergétique, agit en qualité de responsable du traitement pour les données collectées via la plateforme. Vous pouvez nous contacter à l'adresse suivante&nbsp;: confidentialite@ecoprorenov.fr.
      </p>
    ),
  },
  {
    id: "donnees-collectees",
    title: "Données collectées",
    content: (
      <ul className="list-disc list-inside text-muted-foreground space-y-1">
        <li>Données d'identification (nom, prénom, organisation, rôle).</li>
        <li>Coordonnées professionnelles (adresse e-mail, numéro de téléphone, adresse postale).</li>
        <li>Informations liées aux projets, devis, factures et interactions commerciales.</li>
        <li>Données de connexion et de navigation nécessaires à la sécurité et à la maintenance de la plateforme.</li>
      </ul>
    ),
  },
  {
    id: "finalites",
    title: "Finalités du traitement",
    content: (
      <ul className="list-disc list-inside text-muted-foreground space-y-1">
        <li>Fourniture et amélioration du service CRM EcoProRenov.</li>
        <li>Suivi des leads, chantiers et relations clients.</li>
        <li>Production de documents contractuels (devis, factures, rapports).</li>
        <li>Gestion de la facturation et du recouvrement.</li>
        <li>Envoi de communications liées au service et à la sécurité du compte.</li>
      </ul>
    ),
  },
  {
    id: "base-legale",
    title: "Base légale",
    content: (
      <p className="text-muted-foreground">
        Le traitement repose sur l'exécution du contrat conclu avec votre organisation, le respect d'obligations légales (obligations comptables et fiscales) et notre intérêt légitime à assurer la sécurité et l'amélioration continue du service. Le cas échéant, certains traitements peuvent être fondés sur votre consentement explicite.
      </p>
    ),
  },
  {
    id: "duree-conservation",
    title: "Durée de conservation",
    content: (
      <p className="text-muted-foreground">
        Les données sont conservées pendant toute la durée de la relation contractuelle puis archivées pendant la durée de prescription applicable. Les données techniques de connexion sont conservées pour une durée maximale de 12 mois.
      </p>
    ),
  },
  {
    id: "droits",
    title: "Vos droits",
    content: (
      <p className="text-muted-foreground">
        Vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité de vos données. Vous pouvez exercer ces droits en écrivant à confidentialite@ecoprorenov.fr. Vous disposez également du droit d'introduire une réclamation auprès de la CNIL.
      </p>
    ),
  },
  {
    id: "destinataires",
    title: "Destinataires des données",
    content: (
      <p className="text-muted-foreground">
        Les données sont accessibles uniquement par les équipes habilitées d'EcoProRenov et, lorsque nécessaire, par nos sous-traitants techniques et partenaires de services (hébergement, support, outils analytiques). Ces acteurs sont tenus contractuellement de respecter la confidentialité et la sécurité des données traitées.
      </p>
    ),
  },
  {
    id: "securite",
    title: "Sécurité",
    content: (
      <p className="text-muted-foreground">
        Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles adaptées au niveau de sensibilité des données&nbsp;: contrôle d'accès, chiffrement des communications, sauvegardes régulières et tests de sécurité.
      </p>
    ),
  },
  {
    id: "transferts",
    title: "Transferts hors UE",
    content: (
      <p className="text-muted-foreground">
        Les données sont hébergées dans l'Union européenne. Si un transfert vers un pays tiers devait intervenir, il serait encadré par des garanties appropriées conformément au RGPD (clauses contractuelles types ou décision d'adéquation).
      </p>
    ),
  },
  {
    id: "cookies",
    title: "Cookies et traceurs",
    content: (
      <p className="text-muted-foreground">
        La plateforme utilise uniquement des cookies techniques nécessaires à son fonctionnement et à la sécurité des sessions. Aucun cookie publicitaire n'est déposé sans votre consentement préalable.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    content: (
      <p className="text-muted-foreground">
        Pour toute question relative à cette politique ou à vos données personnelles, vous pouvez nous écrire à confidentialite@ecoprorenov.fr ou par courrier à EcoProRenov, Service Protection des Données, 10 rue de l'Énergie, 75000 Paris, France.
      </p>
    ),
  },
];

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Politique de confidentialité</h1>
          <p className="text-muted-foreground">
            Cette politique décrit la manière dont EcoProRenov collecte, utilise et protège vos données personnelles.
          </p>
        </div>

        <Card className="shadow-lg border border-border/50">
          <CardHeader className="space-y-4">
            <CardTitle className="text-2xl">Sommaire</CardTitle>
            <nav className="grid gap-2 sm:grid-cols-2">
              {sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="text-sm text-primary hover:underline"
                >
                  {section.title}
                </a>
              ))}
            </nav>
          </CardHeader>
          <CardContent className="space-y-8">
            {sections.map((section) => (
              <section key={section.id} id={section.id} className="space-y-3 scroll-mt-24">
                <h2 className="text-xl font-semibold text-foreground">{section.title}</h2>
                {section.content}
              </section>
            ))}
            <p className="text-xs text-muted-foreground">
              Dernière mise à jour&nbsp;: {new Date().toLocaleDateString("fr-FR")}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
