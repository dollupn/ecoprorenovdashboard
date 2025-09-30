import type { FC } from "react";

const labelClass = "text-[10px] uppercase tracking-[0.16em] text-slate-500";

const tableHeaderClass =
  "bg-slate-100 text-[10px] uppercase tracking-[0.12em] text-slate-600 py-2 px-3 text-left";
const tableCellClass = "text-[12px] text-slate-800 py-3 px-3 border-t border-slate-200 align-top";

const secondaryTableCellClass =
  "text-[12px] text-slate-800 py-2 px-3 border border-slate-200 align-top";

const SectionTitle: FC<{ title: string }> = ({ title }) => (
  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-700">
    {title}
  </p>
);

const SectionValue: FC<{ value: string }> = ({ value }) => (
  <p className="text-[12px] leading-relaxed text-slate-900 whitespace-pre-line">{value}</p>
);

export const InvoicePreview: FC = () => {
  return (
    <div className="flex flex-col gap-10 bg-slate-50 p-6">
      <div className="flex flex-col gap-6 text-slate-900">
        <div className="flex flex-col gap-8 lg:flex-row">
          <article className="bg-white shadow-lg ring-1 ring-slate-200 w-full lg:max-w-[45rem]">
            <div className="px-8 py-10 flex flex-col gap-8">
              <header className="flex items-start justify-between">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-emerald-500" />
                    <div>
                      <p className="text-[20px] font-semibold tracking-tight text-slate-900">
                        ecoprorenove
                      </p>
                      <p className="text-[12px] tracking-[0.24em] uppercase text-emerald-600">
                        Ensemble, construisons durable
                      </p>
                    </div>
                  </div>
                  <div className="text-[12px] text-slate-700 leading-relaxed">
                    <p>ECOPRORÉNOVE</p>
                    <p>74C Avenue Léonide de Lézie</p>
                    <p>97438 SAINT-LOUIS</p>
                    <p>SIRET 949 287 567 00013</p>
                    <p>contact@ecoprorenover.fr</p>
                    <p>0262 94 94 57</p>
                  </div>
                </div>
                <div className="text-right space-y-2">
                  <p className="text-[24px] font-semibold uppercase tracking-[0.24em] text-slate-900">
                    Facture
                  </p>
                  <div className="text-[12px] text-slate-700 space-y-1">
                    <p>F202509-10020</p>
                    <p>Saint-Denis, le 10/02/2025</p>
                  </div>
                </div>
              </header>

              <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 border border-slate-200 p-4">
                  <p className={labelClass}>Facturée à</p>
                  <p className="text-[13px] font-semibold text-slate-900 leading-snug">
                    SARL REUNION LOMBRERE PRO
                  </p>
                  <p className="text-[12px] text-slate-700 leading-relaxed">
                    3 RUE AUREL MONGOLFI
                    <br /> 3 RUE JEAN MICHEL CLARET
                    <br /> 97216 SAINT-PIERRE
                  </p>
                </div>
                <div className="space-y-3 border border-slate-200 p-4">
                  <div>
                    <p className={labelClass}>Projet</p>
                    <p className="text-[13px] font-semibold text-slate-900 leading-snug">BAT N° 08-106</p>
                  </div>
                  <div>
                    <p className={labelClass}>Conditions</p>
                    <p className="text-[12px] text-slate-700 leading-relaxed">
                      Paiement à 30 jours fin de mois
                      <br /> Escompte 2% pour paiement anticipé
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-1">
                <table className="w-full border border-slate-200">
                  <thead>
                    <tr>
                      <th className={`${tableHeaderClass} w-16`}>Réf.</th>
                      <th className={`${tableHeaderClass}`}>Description</th>
                      <th className={`${tableHeaderClass} text-right w-24`}>Quantité</th>
                      <th className={`${tableHeaderClass} text-right w-28`}>Prix unitaire</th>
                      <th className={`${tableHeaderClass} text-right w-28`}>Montant HT</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className={`${tableCellClass} font-medium text-slate-900`}>BAT-08-106</td>
                      <td className={tableCellClass}>
                        Mise en place d&apos;un système de toiture, consulte techniques, dimensionnements et renforts de supports.
                        <div className="mt-2 text-[11px] text-slate-600">
                          <p>Dépose complète de la toiture existante</p>
                          <p>Installation de panneaux sandwich isolants</p>
                          <p>Étanchéité et finition acrotères</p>
                        </div>
                      </td>
                      <td className={`${tableCellClass} text-right`}>1</td>
                      <td className={`${tableCellClass} text-right`}>15 320,40 €</td>
                      <td className={`${tableCellClass} text-right font-semibold text-slate-900`}>15 320,40 €</td>
                    </tr>
                    <tr>
                      <td className={`${tableCellClass} font-medium text-slate-900`}>BAT-08-107</td>
                      <td className={tableCellClass}>
                        Mise en place d&apos;une platine inox pour isolant thermique.
                        <div className="mt-2 text-[11px] text-slate-600">
                          <p>Fourniture et pose de platines thermiques</p>
                          <p>Traitement des points singuliers</p>
                        </div>
                      </td>
                      <td className={`${tableCellClass} text-right`}>1</td>
                      <td className={`${tableCellClass} text-right`}>990,60 €</td>
                      <td className={`${tableCellClass} text-right font-semibold text-slate-900`}>990,60 €</td>
                    </tr>
                    <tr>
                      <td className={`${tableCellClass} font-medium text-slate-900`}>BAT-08-108</td>
                      <td className={tableCellClass}>
                        Mise en place d&apos;un système de fermeture conformes aux normes ERP.
                        <div className="mt-2 text-[11px] text-slate-600">
                          <p>Fourniture de portes coupe-feu</p>
                          <p>Installation de contrôle d&apos;accès</p>
                          <p>Tests et certifications</p>
                        </div>
                      </td>
                      <td className={`${tableCellClass} text-right`}>1</td>
                      <td className={`${tableCellClass} text-right`}>6 800,00 €</td>
                      <td className={`${tableCellClass} text-right font-semibold text-slate-900`}>6 800,00 €</td>
                    </tr>
                  </tbody>
                  <tfoot className="bg-slate-100">
                    <tr>
                      <td className="px-3 py-2 text-[11px] text-slate-600" colSpan={3}>
                        Conditions particulières : livraison sous 8 semaines après validation.
                      </td>
                      <td className="px-3 py-2 text-[12px] text-slate-600 text-right">Sous-total</td>
                      <td className="px-3 py-2 text-[12px] text-slate-900 text-right font-semibold">
                        23 111,00 €
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={3}></td>
                      <td className="px-3 py-2 text-[12px] text-slate-600 text-right">TVA 8.5%</td>
                      <td className="px-3 py-2 text-[12px] text-slate-900 text-right font-semibold">
                        1 964,44 €
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={3}></td>
                      <td className="px-3 py-2 text-[12px] text-slate-600 text-right">Total TTC</td>
                      <td className="px-3 py-2 text-[13px] text-slate-900 text-right font-semibold">
                        25 075,44 €
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </section>

              <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border border-slate-200 p-4 space-y-2">
                  <SectionTitle title="Coordonnées bancaires" />
                  <SectionValue value={`Banque Populaire de l'Île de La Réunion\nIBAN FR76 1350 1000 0000 5678 9000 123\nBIC BMCIFR2T`} />
                </div>
                <div className="border border-slate-200 p-4 space-y-2">
                  <SectionTitle title="Observations" />
                  <SectionValue value={`Nous vous remercions pour votre confiance.\nMerci d'indiquer la référence de la facture lors du règlement.`} />
                </div>
              </section>
            </div>
            <footer className="border-t border-slate-200 px-8 py-4 text-[10px] text-slate-500 flex items-center justify-between">
              <p>ECOPRORÉNOVE - SIRET 949 287 567 00013</p>
              <p>TVA intracommunautaire FR72 949 287 567</p>
              <p>www.ecoprorenover.fr</p>
            </footer>
          </article>

          <article className="bg-white shadow-lg ring-1 ring-slate-200 w-full lg:max-w-[24rem]">
            <div className="px-8 py-10 space-y-8">
              <div className="space-y-2">
                <p className="text-[14px] font-semibold text-slate-900">BAT N° 08-106</p>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Mise en place d&apos;un système de toiture conforme aux normes ERP.
                </p>
              </div>

              <section className="space-y-4">
                <div className="border border-slate-200">
                  <div className="grid grid-cols-[1.4fr,1fr]">
                    <div className="border-b border-r border-slate-200 px-4 py-3 space-y-2">
                      <p className={labelClass}>Système</p>
                      <p className="text-[12px] text-slate-900 leading-snug">
                        Système complet : ATI - ERP / Pluie à l&apos;abri
                      </p>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Modèle XP ERP 110 - Pente 8° - Réf. BAT 08-106
                      </p>
                    </div>
                    <div className="border-b border-slate-200 px-4 py-3 space-y-2">
                      <p className={labelClass}>Délais</p>
                      <p className="text-[12px] text-slate-900 leading-snug">6 semaines</p>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Après validation BAT et réception acompte
                      </p>
                    </div>
                    <div className="border-r border-slate-200 px-4 py-3 space-y-2">
                      <p className={labelClass}>Certification</p>
                      <p className="text-[12px] text-slate-900 leading-snug">
                        Conforme normes EN 15026 et DTU 40.35
                      </p>
                    </div>
                    <div className="px-4 py-3 space-y-2">
                      <p className={labelClass}>Garantie</p>
                      <p className="text-[12px] text-slate-900 leading-snug">10 ans pièces et main d&apos;œuvre</p>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Extensions possibles sur devis
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border border-slate-200">
                  <div className="grid grid-cols-[1.3fr,1fr]">
                    <div className="border-b border-r border-slate-200 px-4 py-3 space-y-2">
                      <p className={labelClass}>Matériaux</p>
                      <p className="text-[12px] text-slate-900 leading-snug">
                        Tôles acier galvanisé 80/100e, isolant PIR 140mm, membranes EPDM
                      </p>
                    </div>
                    <div className="border-b border-slate-200 px-4 py-3 space-y-2">
                      <p className={labelClass}>Fournisseurs</p>
                      <p className="text-[12px] text-slate-900 leading-snug">
                        ALTI Batiment, Couverture Réunion, LITTORAL acier
                      </p>
                    </div>
                    <div className="border-r border-slate-200 px-4 py-3 space-y-2">
                      <p className={labelClass}>Coordination</p>
                      <p className="text-[12px] text-slate-900 leading-snug">
                        Ing. Claude Mondon (OPC)
                      </p>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Coordination sécurité SPS niveau 2
                      </p>
                    </div>
                    <div className="px-4 py-3 space-y-2">
                      <p className={labelClass}>Suivi</p>
                      <p className="text-[12px] text-slate-900 leading-snug">Audits hebdomadaires</p>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Rapport de conformité et DOE complet
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border border-slate-200">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className={`${tableHeaderClass} text-left`}>Répartition</th>
                        <th className={`${tableHeaderClass} text-right w-24`}>Montant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: "Matériaux", amount: "9 650,00 €" },
                        { label: "Main d'oeuvre", amount: "7 230,00 €" },
                        { label: "Logistique", amount: "1 120,00 €" },
                        { label: "Études techniques", amount: "1 111,00 €" },
                      ].map((item) => (
                        <tr key={item.label}>
                          <td className={secondaryTableCellClass}>{item.label}</td>
                          <td className={`${secondaryTableCellClass} text-right font-semibold text-slate-900`}>
                            {item.amount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td className={`${secondaryTableCellClass} font-semibold text-slate-900`}>Total HT</td>
                        <td className={`${secondaryTableCellClass} text-right font-semibold text-slate-900`}>
                          19 111,00 €
                        </td>
                      </tr>
                      <tr>
                        <td className={secondaryTableCellClass}>TVA 8.5%</td>
                        <td className={`${secondaryTableCellClass} text-right font-semibold text-slate-900`}>
                          1 624,44 €
                        </td>
                      </tr>
                      <tr>
                        <td className={`${secondaryTableCellClass} font-semibold text-slate-900`}>Total TTC</td>
                        <td className={`${secondaryTableCellClass} text-right font-semibold text-slate-900`}>
                          20 735,44 €
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="border border-slate-200">
                  <div className="grid grid-cols-[1.3fr,1fr]">
                    <div className="border-r border-slate-200 px-4 py-3 space-y-2">
                      <p className={labelClass}>Contact</p>
                      <p className="text-[12px] text-slate-900 leading-snug">
                        Responsable projet : Claude Mondon
                      </p>
                      <p className="text-[11px] text-slate-600">06 92 34 67 21</p>
                    </div>
                    <div className="px-4 py-3 space-y-2">
                      <p className={labelClass}>Email</p>
                      <p className="text-[12px] text-slate-900 leading-snug">
                        coordination.projet@ecoprorenover.fr
                      </p>
                      <p className="text-[11px] text-slate-600">coordination.reunion974@gmail.com</p>
                    </div>
                  </div>
                </div>
              </section>
            </div>
            <footer className="border-t border-slate-200 px-8 py-4 text-[10px] text-slate-500 space-y-1">
              <p>ECOPRORÉNOVE - 74C Avenue Léonide de Lézie - 97438 SAINT-LOUIS</p>
              <p>SARL au capital de 50 000€ - SIRET 949 287 567 00013 - TVA FR72 949 287 567</p>
              <p>contact@ecoprorenover.fr - www.ecoprorenover.fr</p>
            </footer>
          </article>
        </div>
      </div>
    </div>
  );
};

export default InvoicePreview;
