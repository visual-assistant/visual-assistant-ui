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
