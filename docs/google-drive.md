# Intégration Google Drive

Cette application propose une intégration native avec Google Drive permettant de stocker les documents clés (photos de leads, fiches techniques, devis, factures, documents de chantier) directement dans l'espace Drive de votre organisation.

## Connexion et autorisations

1. **Paramétrage organisationnel** : renseignez dans Supabase (table `drive_settings`) le client OAuth (ID, secret), le dossier racine ou le Drive partagé cible et l'URL de redirection utilisée par l'application. Ces informations sont propres à chaque organisation. Lorsque vous créez le client OAuth Google, copiez/collez l'URL `https://<votre-domaine>/integrations/google-drive/callback` dans le champ *Authorized redirect URI* afin que Google redirige correctement vers l'application.
2. **Initialisation de la connexion** : dans l'interface (page *Settings* > *Intégrations & API*), déclenchez l'authentification Google. Une fenêtre Google s'ouvre pour consentir aux scopes `drive.file` et `drive.metadata.readonly`.
3. **Gestion automatique des tokens** : le service backend conserve de façon sécurisée les access / refresh tokens dans la table `drive_credentials`. Les renouvellements sont gérés automatiquement ; en cas d'échec, une reconnexion est demandée.

> ⚠️ Vérifiez que le compte connecté possède l'accès au dossier cible (Drive partagé ou dossier personnel) et qu'il est autorisé à créer des fichiers.

## Utilisation dans les formulaires

Les formulaires suivants exposent désormais un composant d'upload Drive :

- **Leads** : section *Photo pré-visite* (images JPG/PNG). Le lien Drive est stocké dans le champ `photo_previsite_url` et la métadonnée `extra_fields.drive_photo`.
- **Produits** : composant *Fiche technique (PDF)* reliant le champ `technical_sheet_url` à Drive.
- **Devis** : bloc *Document du devis* permettant de téléverser le PDF signé ; les métadonnées sont sérialisées dans `quotes.notes`.
- **Factures** : bloc *Document de facturation* avec sérialisation JSON dans `invoices.notes`.
- **Chantiers** : bloc *Documents chantier* (PDF ou images) enregistré dans `sites.notes`.

Chaque composant affiche :

- l'état de connexion Drive de l'organisation ;
- un bouton/zone de glisser-déposer ;
- un lien direct vers le fichier après upload ;
- un bouton de suppression qui supprime uniquement la référence côté application (le fichier reste dans Drive).

## Accès aux documents

- Les listes et fiches (par ex. drawer de devis) affichent désormais des actions directes « Ouvrir le document » lorsque des URLs Drive sont disponibles.
- Dans les menus contextuels, l'ouverture privilégie le document Drive s'il existe, sinon le dossier renseigné.

## Tables Supabase concernées

- `drive_settings` : configuration OAuth par organisation (client, dossier, redirect URI).
- `drive_credentials` : tokens et statut de connexion.
- `drive_files` : journalisation des uploads (identifiant Drive, type d'entité, utilisateur).
- `quotes`, `invoices`, `sites`, `leads`, `product_catalog` : champs enrichis par les URLs/ID Drive.

## Bonnes pratiques

- Créez un dossier dédié par organisation et partagez-le avec les comptes concernés.
- Limitez les droits du client OAuth à l'organisation (utilisation d'un projet GCP dédié).
- Surveillez les erreurs d'upload dans l'UI (messages toast) : elles indiquent généralement un problème de permission ou de quota Drive.
- En cas de révocation volontaire, utilisez le bouton de déconnexion (DELETE `/api/google-drive/connection`) pour nettoyer les tokens.

Pour plus de détails techniques, consultez le module `src/integrations/googleDrive/` et la route serveur `src/server/routes/googleDriveRoute.ts`.
