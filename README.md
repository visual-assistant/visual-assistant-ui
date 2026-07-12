# Visual Assistant UI

Frontend Next.js de PRIA / Visual Assistant PERGE.

Cette interface est utilisee par le service technique PERGE pour gerer l'Inbox SAV, les chantiers, les sessions SAV, les notes, les rapports publics et les ecrans admin.

Pour le contexte produit global et les regles de modification, lire le fichier parent :

```text
../AGENTS.md
```

## Lancer en local

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

## Backend attendu

Le frontend consomme principalement `internal_api.py` cote backend.

En local, lancer le backend depuis `visual-assistant-backend` :

```bash
uvicorn internal_api:app --reload --port 8001
```

## Documents produits

L'ecran `/settings` contient l'interface admin de documentation produit.

Objectif :

- associer des PDF techniques a des produits PERGE ;
- gerer les metadonnees documentaires ;
- uploader un PDF via le backend ;
- lancer ou relancer l'indexation documentaire ;
- verifier visuellement le plan detecte apres indexation.

Endpoints utilises :

```http
GET /product-documents
GET /product-documents?product=pac_hybride
GET /product-documents/catalog
GET /product-documents/{document_id}
POST /product-documents
PATCH /product-documents/{document_id}
DELETE /product-documents/{document_id}
POST /product-documents/{document_id}/file
POST /product-documents/{document_id}/index
GET /product-documents/{document_id}/index
```

Flow UI recommande :

1. choisir un produit ;
2. renseigner titre, type, tags, version ;
3. selectionner un PDF ;
4. creer la metadata via `POST /product-documents` ;
5. uploader le PDF via `POST /product-documents/{document_id}/file` ;
6. lancer l'indexation via `POST /product-documents/{document_id}/index` ;
7. verifier le plan detecte via `GET /product-documents/{document_id}/index`.

Les PDF sont stockes dans ImageKit. Les JSON de metadonnees sont stockes cote backend dans `PRODUCT_DOCUMENTS_DIR`. Les indexes texte et assets regenerables sont stockes cote backend dans `PRODUCT_DOCUMENT_INDEXES_DIR` et `PRODUCT_DOCUMENT_ASSETS_DIR`.

## Index documentaire

L'index documentaire sert aujourd'hui au controle admin apres upload PDF. Ce n'est pas encore Atelier PRIA, ni une recherche semantique utilisateur final.

L'UI affiche :

- le statut d'indexation : `NOT_INDEXED`, `INDEXING`, `INDEXED`, `FAILED` ;
- la derniere date d'indexation si disponible ;
- les stats courtes : pages, sections, reperes ;
- le plan detecte : `sections[]` niveau 1, puis `anchors[]` groupes par `parent_section_id` ;
- l'extrait texte d'une section ou d'un repere selectionne ;
- les pages visuelles associees quand `page_images[]` ou `visual_refs[]` fournissent une URL exploitable ;
- un panneau secondaire `Diagnostic indexation` pour `outline_meta`, le modele utilise, la version d'index, le nombre de candidats bruts et l'eventuel fallback/error.

Ne pas afficher `outline_candidates[]` au meme niveau que le plan final : ce champ est reserve au diagnostic/audit.

## Principes UI

- Garder une interface SAV claire, dense et operationnelle.
- Eviter les refontes globales non demandees.
- Ne pas transformer PRIA en CRM complet.
- Pour les pages admin, privilegier des formulaires simples, des listes filtrables et des actions explicites.
- Les champs comme `document_type`, `status`, `source_kinds` et `suggested_tags` doivent venir de `GET /product-documents/catalog` autant que possible.
- Ne pas construire Atelier PRIA, l'extraction PDF avancee ou la recherche semantique dans le frontend tant que ce n'est pas demande.

## Tests avant livraison

Commandes utiles :

```bash
npm run lint
npm run build
```

Si une commande echoue pour une raison connue ou dependante de l'environnement, le signaler clairement.

Note : dans une future session Codex cote UI, demander de lire `../AGENTS.md` avant de coder.
