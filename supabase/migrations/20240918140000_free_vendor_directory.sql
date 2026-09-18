-- Annuaire public : fiches gratuites (sans compte prestataire / sans abo Stripe)

alter table public.vendors alter column user_id drop not null;
alter table public.vendors add column if not exists free_listing boolean not null default false;

create or replace function public.vendor_is_listed(vid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.vendors v
    where v.id = vid
      and v.moderated = true
      and (
        v.free_listing = true
        or exists (
          select 1
          from public.subscriptions s
          where s.vendor_id = v.id
            and s.status in ('active', 'trialing')
        )
      )
  );
$$;

insert into public.vendors (
  id, user_id, name, categories, city, lat, lng, radius_km, kasherut,
  price_min, price_max, description, website, phone, photos, moderated, free_listing
) values
  (
    '22222222-2222-2222-2222-222222222201', null,
    'Atelier Sofer Mehoudar', array['sofer']::text[], 'Paris', 48.8566, 2.3522, 40, 'casher',
    900, 1800,
    'Paires de tefilin mehoudar, talitot et sacs brodés. Commande 3 à 4 mois à l’avance. Démonstration et entretien inclus.',
    null, '01 42 00 11 01', ARRAY[]::text[], true, true
  ),
  (
    '22222222-2222-2222-2222-222222222202', null,
    'Maison du Sofer — Neuilly', array['sofer']::text[], 'Neuilly-sur-Seine', 48.8846, 2.2686, 35, 'casher',
    800, 1600,
    'Sofer reconnu, contrôle des parchemins, talit ashkénaze et séfarade, kippot assorties au prénom.',
    null, '01 47 00 11 02', ARRAY[]::text[], true, true
  ),
  (
    '22222222-2222-2222-2222-222222222203', null,
    'Traiteur Or-Haïm', array['traiteur']::text[], 'Créteil', 48.7904, 2.4556, 50, 'casher_glatt',
    38, 180,
    'Petit-déjeuner, kiddouch et dîner de soirée. Supervision consistoriale, menus cocktail + assis, livraison la veille de Shabbat.',
    null, '01 43 00 11 03', ARRAY[]::text[], true, true
  ),
  (
    '22222222-2222-2222-2222-222222222204', null,
    'Le Jardin Casher', array['traiteur']::text[], 'Paris', 48.8566, 2.3522, 40, 'casher',
    28, 160,
    'Viennoiseries, salé, plats chauds sur plata. Idéal petit-déjeuner tefilin, déjeuner familial et cocktail de soirée.',
    null, '01 44 00 11 04', ARRAY[]::text[], true, true
  ),
  (
    '22222222-2222-2222-2222-222222222205', null,
    'Palais des Fêtes Neuilly', array['salle']::text[], 'Neuilly-sur-Seine', 48.8846, 2.2686, 25, 'flexible',
    3500, 12000,
    'Salle 180 à 280 invités, cuisine casher possible, parking, vestiaire. Disponible jeudi et dimanche.',
    null, '01 47 00 11 05', ARRAY[]::text[], true, true
  ),
  (
    '22222222-2222-2222-2222-222222222206', null,
    'Espace Simha Vincennes', array['salle']::text[], 'Vincennes', 48.8479, 2.437, 30, 'casher',
    2800, 9000,
    'Loft modulable 120–220 places, cuisine casher, terrasse. Adapté bar et bat mitzvah en semaine.',
    null, '01 43 00 11 06', ARRAY[]::text[], true, true
  ),
  (
    '22222222-2222-2222-2222-222222222207', null,
    'Studio Léa Cohen Photo', array['photo']::text[], 'Paris', 48.8566, 2.3522, 45, 'flexible',
    450, 2200,
    'Reportage tefilin (2 h le matin) et soirée. Galerie en ligne sous 10 jours. Pas de prise de vue le Shabbat.',
    null, '01 45 00 11 07', ARRAY[]::text[], true, true
  ),
  (
    '22222222-2222-2222-2222-222222222208', null,
    'Film Bar Mitzvah', array['video','photo']::text[], 'Boulogne-Billancourt', 48.8432, 2.2399, 40, 'flexible',
    700, 3800,
    'Vidéaste + photographe. Teaser sous 7 jours, film « de 0 à 13 ans », captation cocktail et entrée des familles.',
    null, '01 46 00 11 08', ARRAY[]::text[], true, true
  ),
  (
    '22222222-2222-2222-2222-222222222209', null,
    'DJ Neshama', array['dj']::text[], 'Paris', 48.8566, 2.3522, 50, 'flexible',
    1800, 3500,
    'DJ, sono et lumières. Playlists israéliennes, rap FR et classiques de soirée. Les jeudis et samedis partent vite.',
    null, '01 42 00 11 09', ARRAY[]::text[], true, true
  ),
  (
    '22222222-2222-2222-2222-222222222210', null,
    'Live Cocktail — violon & voix', array['dj']::text[], 'Levallois-Perret', 48.8932, 2.2879, 35, 'flexible',
    800, 1600,
    'Duo violon / chanteur pour le cocktail. Répertoire judéo-arabe, klezmer et variété. Sono autonome.',
    null, '01 47 00 11 10', ARRAY[]::text[], true, true
  ),
  (
    '22222222-2222-2222-2222-222222222211', null,
    'Animation Chaise & Percus', array['animation']::text[], 'Sarcelles', 48.9974, 2.3781, 50, 'flexible',
    900, 1800,
    'Entrée des parents, danseurs, darbouka, chaise. Espace ados : animateur, jeux, photobooth.',
    null, '01 39 00 11 11', ARRAY[]::text[], true, true
  ),
  (
    '22222222-2222-2222-2222-222222222212', null,
    'Fleurs Esther', array['fleuriste']::text[], 'Paris', 48.8566, 2.3522, 40, 'flexible',
    90, 180,
    'Centres de table, bouquets d’honneur et arche d’entrée. Compositions saisonnières, livraison J-1.',
    null, '01 43 00 11 12', ARRAY[]::text[], true, true
  ),
  (
    '22222222-2222-2222-2222-222222222213', null,
    'Scéno Lumière Or', array['deco']::text[], 'Levallois-Perret', 48.8932, 2.2879, 40, 'flexible',
    1200, 4500,
    'Lettres lumineuses, mapping, photowall au prénom. Installation et démontage inclus.',
    null, '01 47 00 11 13', ARRAY[]::text[], true, true
  ),
  (
    '22222222-2222-2222-2222-222222222214', null,
    'Pâtisserie Sweet 13', array['gateau']::text[], 'Paris', 48.8566, 2.3522, 35, 'casher',
    450, 1600,
    'Pièce montée, wedding cake et candy bar casher. Dégustation sur rendez-vous. Livraison plateau réfrigéré.',
    null, '01 42 00 11 14', ARRAY[]::text[], true, true
  ),
  (
    '22222222-2222-2222-2222-222222222215', null,
    'Extra Service Vestiaire', array['logistique']::text[], 'Paris', 48.8566, 2.3522, 45, 'flexible',
    400, 1800,
    'Voiturier, vestiaire, sécurité, nappage et location de tables. Équipe formée aux événements communautaires.',
    null, '01 44 00 11 15', ARRAY[]::text[], true, true
  ),
  (
    '22222222-2222-2222-2222-222222222216', null,
    'Nappage & Tables IDF', array['logistique']::text[], 'Saint-Denis', 48.9362, 2.3574, 40, 'flexible',
    180, 900,
    'Location tables, chaises, nappes et vaisselle pour kiddouch ou petit-déjeuner hors synagogue.',
    null, '01 48 00 11 16', ARRAY[]::text[], true, true
  )
on conflict (id) do update set
  name = excluded.name,
  categories = excluded.categories,
  city = excluded.city,
  lat = excluded.lat,
  lng = excluded.lng,
  radius_km = excluded.radius_km,
  kasherut = excluded.kasherut,
  price_min = excluded.price_min,
  price_max = excluded.price_max,
  description = excluded.description,
  phone = excluded.phone,
  moderated = true,
  free_listing = true;
