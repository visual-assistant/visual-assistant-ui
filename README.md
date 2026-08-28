# Visual Assistant UI

Frontend Next.js de PRIA / Visual Assistant PERGE.

Cette interface est utilisee par le service technique PERGE pour gerer l'Atelier PRIA, l'Inbox SAV, les chantiers, les sessions SAV, les notes, les rapports publics, le partage de reponses Atelier et l'administration des documents produits.

Pour le contexte produit global et les regles de modification, lire aussi :

```text
../AGENTS.md
../visual-assistant-backend/README.md
```

## Etat actuel du frontend

Le frontend est une application Next.js App Router avec des pages majoritairement client-side. Les pages appellent directement l'API interne FastAPI via `fetch`.

Navigation principale dans `src/components/AppShell.tsx` :

- `/atelier` : Atelier PRIA, question libre sourcee par les documents produits.
- `/inbox-sav` : Inbox SAV email / WhatsApp.
- `/sav/sessions` : liste des chantiers et sessions SAV.
- `/settings` : administration des documents produits.

Pages publiques sans shell interne :

- `/atelier/r/[slug]` : rendu public d'une reponse Atelier partagee.
- `/r/[slug]` : rapport public chantier.
- `/session_sav/[slug]` : page publique de session SAV legacy.

Pages legacy ou secondaires :

- `/generateur` : ancien generateur de lien/session avec lookup CRM, produits, etapes et photo exemple.
- `/` : page de test Tailwind.

## Lancer en local

Depuis `visual-assistant-ui` :

```bash
npm install
npm run dev
```

Application locale :

```text
http://localhost:3000
```

API interne backend locale :

```text
http://localhost:8001
```

Webhook WhatsApp local :

```text
http://localhost:8000
```

Depuis `visual-assistant-backend`, lancer l'API interne :

```bash
uvicorn internal_api:app --reload --port 8001
```

Le webhook Twilio se lance separement si le flux WhatsApp doit etre teste :

```bash
uvicorn webhook:app --reload --port 8000
```

## Variables frontend

Variable principale :

```env
NEXT_PUBLIC_INTERNAL_API=http://localhost:8001
```

La page detail chantier accepte aussi `NEXT_PUBLIC_INTERNAL_API_BASE_URL` comme fallback optionnel.

FullStory est charge dans `src/app/layout.tsx` avec :

```env
NEXT_PUBLIC_FULLSTORY_ORG=...
```

Ne pas hardcoder d'URL de production ni de secret dans le frontend.

## Atelier PRIA

La route `/atelier` est maintenant une brique centrale du frontend. Elle permet au service technique de poser une question libre, de recuperer une reponse courte sourcee depuis les notices produits indexees, de la recomposer, de modifier le brouillon, puis de preparer ou envoyer un partage.

Endpoints utilises :

```http
GET /atelier/questions
POST /atelier/questions
GET /atelier/questions/{question_id}
POST /atelier/questions/{question_id}/regenerate
POST /atelier/questions/{question_id}/compose
PATCH /atelier/questions/{question_id}/draft
POST /atelier/questions/{question_id}/share-preview
POST /atelier/questions/{question_id}/send
GET /atelier/public/{slug}
```

Contrat d'affichage prioritaire :

- `question.draft.answer_blocks[]` pour le rendu principal.
- `question.draft.visual_refs[]` pour les visuels exploitables.
- `question.sources[]` pour les sources documentaires.
- `question.draft.supplementary_source_ids[]` et `question.draft.supplementary_visual_ref_ids[]` pour les reperes complementaires.

Fallbacks conserves cote UI :

- `draft.blocks[]` legacy si `draft.answer_blocks[]` est absent.
- `draft.answer_text` ou `answer_text` si aucun bloc structure n'est disponible.

Le panneau de partage permet :

- selection du canal `WHATSAPP` ou `EMAIL`;
- saisie du destinataire;
- modification du texte de reponse avant partage;
- inclusion / exclusion de visuels;
- preview via `/share-preview`;
- envoi effectif via `/send`.

La route publique `/atelier/r/[slug]` consomme `GET /atelier/public/{slug}` et affiche le snapshot public : question, titre, blocs de reponse, visuels, sources et reperes complementaires. Elle gere aussi les erreurs de lien invalide, introuvable, expire ou revoque.

## Documents produits

La route `/settings` contient l'interface admin de documentation produit. Elle sert a alimenter la base documentaire exploitee ensuite par Atelier PRIA.

Objectif :

- associer des PDF techniques a des produits PERGE;
- gerer les metadonnees documentaires;
- uploader un PDF via le backend;
- lancer ou relancer l'indexation documentaire;
- verifier le plan detecte et les crops/pages visuels;
- consulter le diagnostic d'indexation sans exposer les candidats bruts comme plan final.

Endpoints utilises :

```http
GET /product-documents
GET /product-documents?product=pac_hybride
GET /product-documents/catalog
GET /product-documents/{document_id}/index
POST /product-documents
PATCH /product-documents/{document_id}
DELETE /product-documents/{document_id}
POST /product-documents/{document_id}/file
POST /product-documents/{document_id}/index
```

Flow UI :

1. choisir un produit;
2. renseigner titre, type, tags, version, statut et notes;
3. selectionner un PDF;
4. creer la metadata via `POST /product-documents`;
5. uploader le PDF via `POST /product-documents/{document_id}/file`;
6. lancer l'indexation via `POST /product-documents/{document_id}/index`;
7. verifier le plan via `GET /product-documents/{document_id}/index`.

Le front affiche :

- statut `NOT_INDEXED`, `INDEXING`, `INDEXED`, `FAILED`;
- stats pages / sections / reperes;
- `sections[]` niveau 1;
- `anchors[]` groupes par section;
- extrait texte de l'element selectionne;
- visuels associes en privilegiant `section_crop` ou `anchor_crop`, puis `page_snapshot` en fallback;
- diagnostic `outline_meta`, modele, version d'index, nombre de candidats bruts, fallback et erreur eventuelle.

`outline_candidates[]` reste reserve au diagnostic/audit et ne doit pas etre affiche comme plan principal.

## Inbox SAV et chantiers

La route `/inbox-sav` gere le traitement des items entrants et leur rattachement au modele chantier.

Endpoints principaux observes :

```http
GET /products
GET /catalog/classification
GET /catalog/components
GET /contacts/search
GET /inbox/overview
GET /sav/overview
GET /chantiers/{chantier_id}
PATCH /inbox/items/{inbox_item_id}
POST /inbox/items/{inbox_item_id}/attach
```

La route `/sav/sessions` affiche la vue chantiers/SAV, permet d'ouvrir un chantier, de rattacher une session legacy, de demander des photos WhatsApp et de mettre a jour certaines donnees chantier.

Endpoints principaux observes :

```http
GET /sav/overview
GET /chantiers/{chantier_id}
PATCH /chantiers/{chantier_id}
POST /sessions/{session_id}/attach
POST /actions/whatsapp/request-photos
```

La route `/sav/sessions/[sessions_id]` est le detail chantier/SAV le plus riche. Elle manipule le chantier, les sessions SAV, les photos, les classifications, les notes, les assets, l'amelioration IA, l'envoi et la publication.

Contrats importants cote UI :

- garder le chantier comme conteneur stable;
- ne pas supprimer les champs legacy encore lus par les pages;
- conserver les notes internes distinctes des messages ou rapports publics;
- garder les propositions IA modifiables par le service technique;
- ne pas casser les anciens liens publics `/r/[slug]` et `/session_sav/[slug]`.

## Guide chantier

Une premiere interface service technique existe pour relire et ajuster un guide chantier genere par PRIA.

Point d'entree de generation :

```text
/atelier -> mode Preparer un guide chantier
```

Flow Atelier implemente :

- deux modes dans l'Atelier : `Question Atelier` et `Preparer un guide chantier`;
- cas chantier existant : saisie d'une reference/ID, chargement via `GET /chantiers/{chantier_id}`, puis pre-remplissage reference, produit, installateur et configuration;
- cas nouveau chantier : formulaire minimal reference/client, installateur, telephone, email, produit et configuration libre;
- pour un nouveau chantier, creation via `POST /chantiers/{chantier_id}` avant generation du guide;
- champ central unique `Description de la configuration`, sans matrice ni traits techniques;
- bouton `Analyser la configuration` ouvrant une modale de confirmation simple : chantier, produit, installateur, configuration saisie;
- bouton `Generer le guide` appelant `POST /guides` avec `generate_points: true` et `guide_point_max_points: 25`;
- apres succes, redirection directe vers `/sav/sessions/{chantier_id}?tab=GUIDE`;
- aucune review GuidePoints n'est affichee dans l'Atelier.

Route principale cote service technique :

```text
/sav/sessions/[sessions_id] -> tab Guide chantier
```

Route secondaire technique/debug :

```text
/guides/[guide_id]
```

Point d'entree depuis le detail chantier :

- la page `/sav/sessions/[sessions_id]` contient maintenant un tab `Guide chantier`;
- ce tab appelle `GET /guides?chantier_id={chantier_id}` pour retrouver les guides rattaches au chantier;
- le backend retourne normalement les guides tries par `updated_at` puis `created_at` decroissant, donc le tab utilise `items[0]` comme guide principal;
- le tab garde `collectGuideIds(chantier)` seulement comme fallback compatible avec d'anciens formats (`guide_id`, `guide.guide_id`, `latest_guide_id`, `guide_ids`, `guides[]`, `prevention.guides[]`);
- si un guide est trouve, la revue des GuidePoints s'affiche directement dans l'onglet, sans etape intermediaire ni navigation vers une autre page;
- si aucun guide n'est retourne, il affiche l'etat vide `Aucun guide chantier genere pour ce chantier`.

Contrat backend utilise pour l'etape 1 :

```http
GET /guides?chantier_id={chantier_id}
POST /chantiers/{chantier_id}
POST /guides
GET /guides/{guide_id}
GET /guides/{guide_id}/points
PATCH /guides/{guide_id}/points/{point_id}
POST /guides/{guide_id}/corrections
POST /guides/{guide_id}/review/approve
```

Fonctionnalites implementees :

- header guide avec statut, chantier, produit et installateur quand disponibles;
- `GuideChantierReview` est un composant partage utilise dans l'onglet chantier et par la route secondaire `/guides/[guide_id]`;
- le composant charge le guide via `/guides/{guide_id}`, puis charge le chantier via `/chantiers/{chantier_id}` pour afficher l'installateur;
- la configuration affichee vient de `guide.configuration_snapshot.configuration_text`;
- le header et les onglets `Chantier Detail` sont factorises dans `src/components/ChantierDetailHeaderTabs.tsx`;
- la page `/sav/sessions/[sessions_id]` lit le parametre `tab` pour ouvrir directement `Info Chantier`, `Session SAV`, `Guide chantier` ou `Messages recus`;
- points groupes par timing puis domaine;
- timings GuidePoint affiches cote service technique : `before_work`, `during_work`, `startup_or_delivery`, `maintenance`, `troubleshooting`;
- les contacts PERGE ne sont pas des GuidePoints et ne sont pas affiches comme timing administratif dans la revue service technique;
- mapping placements `main` / `secondary` / `hidden` vers Principal / Secondaire / Masque;
- modification rapide du placement depuis une carte;
- modal `Ajuster ce point` pour modifier title, content, detail, timing, domaine, placement et note de revue;
- option de correction reutilisable pour les prochains guides via instruction libre;
- drawer `Sources` avec document, section/ancre, page, extrait et lien vers extrait visuel si disponible;
- validation du guide via `/review/approve`;
- colonne laterale cycle de vie, suivi installateur sobre, informations chantier et reperes.
- preview installateur via `GET /guides/{guide_id}/installer-preview`;
- modal `Apercu installateur` inspiree FigmaMake v13, accessible depuis `GuideChantierReview`;
- la preview affiche uniquement les timings qui ont des points visibles;
- la preview groupe par timing puis domaine, affiche les points `main` normalement et les points `secondary` dans `A garder en tete`;
- la preview n'affiche jamais les points `hidden`;
- les contacts PERGE de `administrative_contacts` sont affiches dans un bloc separe, jamais comme timing administratif;
- les sources exploitables des points preview sont visibles avec lien vers extrait visuel si disponible.

Ce qui n'est pas encore implemente :

- page publique finale ou slug public;
- envoi WhatsApp/email;
- tracking installateur vu/fait/question/photo;
- ajout manuel de point, le bouton est seulement present visuellement et desactive.

Etape 2 realisee :

1. Brancher `GET /guides/{guide_id}/installer-preview`.
2. Ajouter une modal `Apercu installateur` depuis `GuideChantierReview`, donc accessible dans l'onglet chantier et dans `/guides/[guide_id]`.
3. Reproduire l'esprit FigmaMake v13 `GuideChantierWebapp` avec navigation par timing puis domaine.
4. Afficher les points `main` normalement.
5. Afficher les points `secondary` dans une section discrete `A garder en tete`.
6. Ne jamais afficher les points `hidden`.
7. Afficher les sources exploitables par point si elles sont dans le payload preview.
8. Garder les actions installateur interactives comme placeholders non branches.

Verification faite lors de l'ajout :

```bash
npx eslint src\app\guides\[guide_id]\page.tsx
npm run build
```

Note : `npm run lint` global peut encore echouer sur des erreurs legacy preexistantes dans d'autres pages (`generateur`, `inbox-sav`, `sav/sessions`, etc.). La nouvelle route Guide chantier passe le lint cible et le build complet.

## Principes UI

- Garder une interface SAV claire, dense et operationnelle.
- Eviter les refontes globales non demandees.
- Respecter l'orange PERGE avec mesure, sur fond clair et lisible.
- Pour les pages internes desktop, privilegier les listes filtrables, panneaux, actions explicites et contenus scannables.
- Pour les pages publiques installateur, privilegier une lecture simple, mobile-friendly, avec reponse courte et sources visibles.
- Les champs de catalogue doivent venir du backend quand un endpoint catalogue existe.
- Ne pas transformer Atelier en chatbot generique : il doit rester un outil de reponse courte, sourcee et validable par le service technique.

## Points d'attention code

- Beaucoup de pages sont monolithiques et contiennent leurs types, helpers et composants locaux. Avant de refactorer, verifier les usages exacts et eviter les deplacements opportunistes.
- Les URLs d'assets peuvent etre relatives au backend, absolues, ou invalides/locales. Les pages filtrent les chemins Windows et reconstruisent les URLs avec `NEXT_PUBLIC_INTERNAL_API`.
- Les pages Atelier et documents produits doivent rester compatibles avec les fallbacks backend documentes dans `visual-assistant-backend/README.md`.
- Le worktree peut contenir des modifications en cours. Ne pas ecraser les changements utilisateur.

## Tests avant livraison

Commandes utiles :

```bash
npm run lint
npm run build
```

Si une commande echoue pour une raison connue ou dependante de l'environnement, le signaler clairement.
