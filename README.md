# Simha

Application web gratuite pour organiser une **bar** ou **bat mitzvah** en famille : budget, échéancier, invités, rétroplanning, déroulé des jours J, calendrier juif (Hebcal), assistant IA, annuaire de synagogues/salles et prestataires abonnés.

Les familles ne paient rien. Les prestataires paient un **abonnement mensuel Stripe** pour apparaître dans l’annuaire, ciblé selon ville, budget et kasherut.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind
- Supabase (Auth magic link, Postgres, RLS, Realtime)
- Hebcal (paracha, fêtes, nérot — jamais inventés par l’IA)
- OpenAI (clé serveur, quota 40 messages / événement / jour)
- Stripe Billing (abonnement prestataires)

## Démarrage local

1. Copier `.env.example` vers `.env.local` et renseigner :
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (webhooks Stripe)
   - `OPENAI_API_KEY` (sinon l’assistant répond avec les faits Hebcal/budget sans LLM)
   - `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`
   - `NEXT_PUBLIC_SITE_URL`
2. Dans Supabase Authentication :
   - URL du site = votre domaine
   - Redirect URLs : `http://localhost:3000/auth/callback` et `https://VOTRE_DOMAINE/auth/callback`
3. `npm install && npm run dev`
4. Pour devenir admin : `update public.profiles set role = 'admin' where email = 'vous@exemple.com';`

## Schéma

Migrations dans `supabase/migrations/`. Projet cloud : `simha` (`jgqwqebwfwrtqhcbvrso`, eu-west-3). Données de démo : 8 synagogues IDF + salles (contenances).

## Import CSV synagogues

Colonnes : `name,city,address,rite,hall,capacity,usage` — depuis `/admin`.

## Déploiement

Production : [https://simha-ivory.vercel.app](https://simha-ivory.vercel.app)  
Repo : [https://github.com/miko51/simha](https://github.com/miko51/simha)  
Supabase : projet `simha` (`jgqwqebwfwrtqhcbvrso`, eu-west-3).

Dans **Authentication → URL configuration** du projet Supabase, ajouter :
- Site URL : `https://simha-ivory.vercel.app`
- Redirect : `https://simha-ivory.vercel.app/auth/callback` et `http://localhost:3000/auth/callback`

Variables encore à coller dans Vercel (dashboard) pour activer l’IA et les abos prestataires :
`OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`.

Webhook Stripe : `https://simha-ivory.vercel.app/api/stripe/webhook`

Pour devenir admin : `update public.profiles set role = 'admin' where email = 'vous@exemple.com';`

L’app privée Raphaël (`BM_raph`) n’est pas modifiée.
