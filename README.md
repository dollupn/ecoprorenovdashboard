# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/c3d7fe31-cf4d-4a07-9284-7eafceb7da35

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/c3d7fe31-cf4d-4a07-9284-7eafceb7da35) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Environment variables

Copy the `.env.example` file to `.env` (and optionally `.env.local`) before running the
application locally. Update each value with the credentials for your Supabase
project and application:

- `VITE_SUPABASE_PROJECT_ID` – the Supabase project reference.
- `VITE_SUPABASE_PUBLISHABLE_KEY` – the anon/publishable Supabase key for the project.
- `VITE_SUPABASE_URL` – the Supabase REST URL, e.g. `https://<project-ref>.supabase.co`.
- `ECOPRO_EXPORT_KEY` – a strong random string used to sign export operations. Rotate
  this key whenever a team member leaves or you suspect it may have been exposed.
- `ECOPRO_WEBHOOK_SECRET` *(optional)* – an additional shared secret that is sent as
  the `x-ecopro-webhook-secret` header when synchronising a project to a backup
  webhook. Use this if your webhook endpoint expects layered authentication.
- `APP_VERSION` – the semantic version displayed in diagnostics and generated exports.

For production deployments (Lovable, Supabase Edge Functions, or any hosting
provider) configure the same variables in the platform’s secret manager. When you
rotate `ECOPRO_EXPORT_KEY`, deploy the new value to every environment and restart
running services to ensure the updated secret is used. Remember to also update your
local `.env`/`.env.local` files when rotating secrets so development builds stay in
sync.

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/c3d7fe31-cf4d-4a07-9284-7eafceb7da35) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## Documentation

- [Intégration Google Drive](docs/google-drive.md)
