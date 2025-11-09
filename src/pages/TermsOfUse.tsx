import { Leaf } from "lucide-react";

const TermsOfUse = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 py-16 px-4">
      <div className="max-w-4xl mx-auto bg-card/70 backdrop-blur-sm border border-border/50 rounded-3xl shadow-elevated">
        <div className="px-6 sm:px-12 py-12 space-y-10">
          <header className="text-center space-y-4">
            <div className="flex items-center justify-center gap-3 text-primary">
              <Leaf className="w-8 h-8" />
              <span className="uppercase tracking-[0.3em] text-xs font-semibold text-primary/80">
                EcoProRenov
              </span>
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
                Conditions d&apos;utilisation
              </h1>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                En accédant à la plateforme EcoProRenov, vous acceptez les modalités
                détaillées ci-dessous. Merci de les lire attentivement.
              </p>
            </div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Dernière mise à jour : 10 avril 2024
            </p>
          </header>

          <section className="space-y-6 text-foreground">
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">1. Objet de la plateforme</h2>
              <p className="text-muted-foreground leading-relaxed">
                EcoProRenov est un outil de gestion destiné aux professionnels de la
                rénovation énergétique. Il permet la gestion de leads, de projets, de
                chantiers, de devis et de factures. Les présentes conditions régissent
                l&apos;utilisation de toutes les fonctionnalités proposées.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-semibold">2. Accès au service</h2>
              <p className="text-muted-foreground leading-relaxed">
                L&apos;accès à la plateforme nécessite la création d&apos;un compte et
                l&apos;utilisation d&apos;identifiants personnels. Vous êtes
                responsables de la confidentialité de ces informations et des actions
                réalisées via votre compte. Toute utilisation frauduleuse doit être
                signalée immédiatement à l&apos;équipe EcoProRenov.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-semibold">3. Utilisation conforme</h2>
              <p className="text-muted-foreground leading-relaxed">
                Vous vous engagez à utiliser la plateforme conformément à la
                réglementation en vigueur et à ne pas porter atteinte aux droits des
                tiers. Il est interdit d&apos;introduire des contenus malveillants,
                d&apos;utiliser le service à des fins illégales ou de tenter d&apos;en
                compromettre la sécurité et la disponibilité.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-semibold">4. Propriété intellectuelle</h2>
              <p className="text-muted-foreground leading-relaxed">
                Tous les éléments visuels, textuels et techniques composant EcoProRenov
                sont protégés par des droits de propriété intellectuelle. Toute
                reproduction, représentation ou adaptation non autorisée est interdite.
                Les données que vous importez dans la plateforme restent votre
                propriété.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-semibold">5. Données personnelles</h2>
              <p className="text-muted-foreground leading-relaxed">
                EcoProRenov traite les données personnelles conformément à sa Politique
                de confidentialité. En utilisant le service, vous reconnaissez avoir
                pris connaissance de cette politique et consentir aux traitements
                nécessaires au fonctionnement de la plateforme.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-semibold">6. Responsabilité</h2>
              <p className="text-muted-foreground leading-relaxed">
                EcoProRenov met tout en œuvre pour assurer la disponibilité et la
                sécurité de la plateforme. Toutefois, la responsabilité de l&apos;éditeur
                ne saurait être engagée en cas de dommages indirects, de perte de
                données ou de préjudice financier résultant de l&apos;utilisation du
                service. Les utilisateurs doivent effectuer des sauvegardes régulières
                de leurs informations.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-semibold">7. Évolution du service</h2>
              <p className="text-muted-foreground leading-relaxed">
                Les fonctionnalités d&apos;EcoProRenov peuvent évoluer afin d&apos;améliorer
                l&apos;expérience utilisateur. Nous nous réservons le droit de modifier ou
                d&apos;interrompre certaines fonctionnalités après vous en avoir informé
                dans un délai raisonnable, sauf urgence technique ou légale.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-semibold">8. Durée et résiliation</h2>
              <p className="text-muted-foreground leading-relaxed">
                Le présent accord est conclu pour une durée indéterminée à compter de
                l&apos;acceptation des conditions d&apos;utilisation. Vous pouvez supprimer votre
                compte à tout moment. EcoProRenov se réserve le droit de suspendre ou de
                résilier un compte en cas de non-respect des présentes conditions.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-semibold">9. Loi applicable</h2>
              <p className="text-muted-foreground leading-relaxed">
                Les présentes conditions sont régies par le droit français. Tout litige
                relatif à leur interprétation ou à leur exécution relève de la
                compétence des tribunaux français compétents.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsOfUse;
