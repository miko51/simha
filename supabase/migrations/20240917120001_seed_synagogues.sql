-- Demo IDF synagogues, halls, and listed vendors (no auth users required)
insert into public.synagogues (id, name, rite, address, city, postal_code, lat, lng, notes, status)
values
  ('11111111-1111-1111-1111-111111111101','Synagogue de la Victoire','ashkenaze','44 rue de la Victoire','Paris','75009',48.8742,2.3369,'Grande synagogue consistoriale. Kiddouch possible selon disponibilités.','approved'),
  ('11111111-1111-1111-1111-111111111102','Synagogue Buffault','sepharade','28 rue Buffault','Paris','75009',48.8764,2.3422,'Communauté tunisienne. Salle de kiddouch en rez-de-chaussée.','approved'),
  ('11111111-1111-1111-1111-111111111103','Synagogue Don Isaac Abravanel','sepharade','84-86 rue de la Roquette','Paris','75011',48.8566,2.3778,'Rite tunisien. Idéale pour tefilin en semaine.','approved'),
  ('11111111-1111-1111-1111-111111111104','Centre Rachi — Communauté de Rueil','sepharade','15 boulevard du Maréchal Foch','Rueil-Malmaison','92500',48.8765,2.1897,'Proche du Country Club. Kiddouch et petit-déjeuner possibles.','approved'),
  ('11111111-1111-1111-1111-111111111105','Synagogue de Neuilly','ashkenaze','12 rue Ancelle','Neuilly-sur-Seine','92200',48.8846,2.2686,'Office chabbat très fréquenté. Salle de kiddouch 200 places.','approved'),
  ('11111111-1111-1111-1111-111111111106','Synagogue de Boulogne','sepharade','43 rue des Abondances','Boulogne-Billancourt','92100',48.8432,2.2399,'Salles modulables pour kiddouch et repas.','approved'),
  ('11111111-1111-1111-1111-111111111107','ACIP Créteil','sepharade','5 rue Jean-Baptiste Pasquier','Créteil','94000',48.7904,2.4556,'Grande salle polyvalente, parking.','approved'),
  ('11111111-1111-1111-1111-111111111108','Synagogue de Sarcelles — Allée des Peupliers','sepharade','Allée des Peupliers','Sarcelles','95200',48.9974,2.3781,'Forte communauté. Plusieurs salles.','approved');

insert into public.halls (synagogue_id, name, capacity, usage, accessible, equipment) values
  ('11111111-1111-1111-1111-111111111101','Nef principale',1200,'office',true,'Sono, estrade'),
  ('11111111-1111-1111-1111-111111111101','Salle de kiddouch',250,'kiddouch',true,'Cuisine casher'),
  ('11111111-1111-1111-1111-111111111102','Nef',400,'office',false,null),
  ('11111111-1111-1111-1111-111111111102','Salle du rez-de-chaussée',120,'kiddouch',true,'Tables, cuisine'),
  ('11111111-1111-1111-1111-111111111103','Nef',350,'office',true,null),
  ('11111111-1111-1111-1111-111111111103','Salle Annexe',80,'kiddouch',false,'Cuisine'),
  ('11111111-1111-1111-1111-111111111104','Nef',280,'office',true,null),
  ('11111111-1111-1111-1111-111111111104','Salle des fêtes',180,'repas',true,'Cuisine casher, platas'),
  ('11111111-1111-1111-1111-111111111105','Nef',500,'office',true,null),
  ('11111111-1111-1111-1111-111111111105','Salle de kiddouch',200,'kiddouch',true,'Cuisine'),
  ('11111111-1111-1111-1111-111111111106','Nef',320,'office',true,null),
  ('11111111-1111-1111-1111-111111111106','Salle polyvalente',150,'polyvalent',true,'Cuisine, chaises'),
  ('11111111-1111-1111-1111-111111111107','Grande nef',600,'office',true,null),
  ('11111111-1111-1111-1111-111111111107','Salle polyvalente',400,'polyvalent',true,'Sono, cuisine'),
  ('11111111-1111-1111-1111-111111111108','Nef',450,'office',false,null),
  ('11111111-1111-1111-1111-111111111108','Salle des fêtes',220,'repas',true,'Cuisine casher');
