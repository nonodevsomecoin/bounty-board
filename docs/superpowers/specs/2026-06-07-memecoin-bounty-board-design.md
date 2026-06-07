# Memecoin Bounty Board — Design Spec

**Date:** 2026-06-07
**Status:** Validé (brainstorming) — prêt pour le plan d'implémentation

## 1. Vue d'ensemble

Site web communautaire lié à un memecoin lancé sur pump.fun. Les membres de la
communauté proposent des **bounties** (tâches marketing pour promouvoir le coin :
meme, vidéo, thread X, sticker Telegram, etc.) et les upvotent à la manière de
Reddit. Les meilleures idées remontent automatiquement.

Le site **ne gère que la proposition et le vote** des bounties — c'est un board
d'idées priorisées par la communauté. La rémunération réelle des actions se fait
**en dehors du site** (via la fonctionnalité de pump.fun). La "récompense" affichée
sur un bounty est purement **indicative**.

Langue de l'interface : **anglais** uniquement.

## 2. Objectif & critères de succès

- Faire émerger, par le vote, les meilleures tâches marketing à réaliser pour le coin.
- Empêcher la triche sur les votes (sybil / multi-vote).
- Rester simple, épuré, et crédible (esthétique "crypto-native", pas un template générique).

Succès = un board où les bounties les plus pertinents arrivent en tête, sans
manipulation facile des votes, et une page Top 10 qui sert de vitrine.

## 3. Périmètre

### Inclus
- Connexion par wallet Solana (Phantom).
- Proposer un bounty (titre, description, récompense suggérée en SOL).
- Upvoter un bounty (1 vote par wallet par bounty).
- Page board (tous les bounties actifs triés par votes).
- Page Top 10 (les 10 bounties actifs les plus upvotés, all-time).
- Page Done (bounties marqués terminés).
- Panneau admin (supprimer un bounty, le marquer "done").
- Anti-triche : seuil de détention de token + cooldown de proposition.

### Exclu (YAGNI)
- Aucune gestion de la réalisation des bounties (preuve, validation, paiement).
- Aucun versement de récompense par le site.
- Pas de commentaires, pas de catégories/tags (formulaire minimaliste).
- Pas de downvote.
- Pas d'expiration automatique des bounties.
- Pas de notion "terminé" déclenchée par le créateur — uniquement par l'admin.

## 4. Architecture & stack

- **Frontend + backend :** Next.js (App Router, React) — une seule codebase.
- **Base de données :** Supabase (Postgres).
- **Hébergement :** Vercel, déployé depuis un dépôt GitHub. Domaine custom en `.xyz`.
- **Blockchain :**
  - Connexion wallet via `@solana/wallet-adapter` (Phantom).
  - Lecture du solde du token via un **RPC Solana**.
  - Prix du token via l'**API Jupiter** (conversion solde → équivalent USD).

**Principe de sécurité fondamental :** toute action sensible (proposer, voter,
modérer) est vérifiée **côté serveur** dans les API routes Next.js. Le client
n'est jamais une source de vérité — ni pour l'adresse du wallet, ni pour le solde,
ni pour les droits admin.

## 5. Modèle de données

### Table `bounties`
| champ | type | notes |
|---|---|---|
| id | uuid (PK) | |
| title | text | requis |
| description | text | requis |
| reward_sol | numeric | récompense suggérée (indicative) |
| author_wallet | text | adresse du proposeur |
| status | text | `active` (défaut) ou `done` |
| created_at | timestamptz | défaut now() |
| votes_count | int | compteur dénormalisé, défaut 0 |
| proof_url | text (nullable) | lien de preuve (photo/vidéo) ajouté par l'admin à la complétion |

### Table `votes`
| champ | type | notes |
|---|---|---|
| id | uuid (PK) | |
| bounty_id | uuid (FK → bounties) | |
| wallet | text | votant |
| created_at | timestamptz | défaut now() |

**Contrainte d'unicité : `(bounty_id, wallet)`** → un wallet ne peut voter qu'une
fois par bounty.

### Authentification admin (pas de table)
L'admin n'utilise **pas** de wallet. Un **compte unique partagé** (login + mot de
passe) est défini par variables d'environnement (`ADMIN_USERNAME`,
`ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`). Après login, une **session par cookie
httpOnly signé** (HMAC, expiration 12 h) autorise les actions de modération.
En développement, si les variables ne sont pas définies, le panneau accepte
`admin` / `admin` (désactivé en production).

## 6. Règles métier & anti-triche

- **Seuil de détention :** pour proposer **ou** voter, le wallet doit détenir
  **≥ 10 $** d'équivalent en token (solde × prix Jupiter). Vérifié côté serveur
  à chaque action.
- **Vote unique :** 1 vote par wallet par bounty (contrainte DB).
- **Cooldown de proposition :** un wallet ne peut pas proposer un nouveau bounty
  moins de **5 minutes** après son précédent (basé sur le dernier `created_at`
  de ce wallet dans `bounties`).
- **Preuve de possession du wallet :** l'utilisateur signe un message avec sa clé
  privée ; le serveur vérifie la signature avant toute action (anti-usurpation
  d'adresse).
- **Droits admin :** la modération exige une **session admin valide** (login +
  mot de passe → cookie signé). Aucun wallet requis côté admin.

## 7. Flux clés

### Connexion wallet
1. L'utilisateur clique "Connect wallet" → Phantom.
2. Il signe un message de challenge.
3. Le serveur vérifie la signature → l'adresse est considérée comme prouvée pour
   la session/action.

### Voter
1. Vérifier la signature du wallet.
2. Vérifier le seuil ≥ 10 $.
3. Insérer le vote (la contrainte d'unicité rejette les doublons).
4. Incrémenter `votes_count`.

### Proposer un bounty
1. Vérifier la signature du wallet.
2. Vérifier le seuil ≥ 10 $.
3. Vérifier le cooldown de 5 min.
4. Insérer le bounty (`status = active`).

### Modération (admin)
1. L'admin se connecte sur `/admin` (login + mot de passe) → cookie de session.
2. Les routes admin vérifient la session (cookie), pas de wallet.
3. Action : **supprimer** un bounty, ou le passer en **`status = done`** avec un
   **lien de preuve optionnel** (photo/vidéo, validé http/https).
4. Un bounty `done` quitte le board et le Top 10, et apparaît dans `/done` (avec
   le lien de preuve s'il existe).

## 8. Pages (interface en anglais)

- **`/` — Board :** liste de tous les bounties `active` triés par `votes_count`
  desc. Bouton "Propose a bounty" + formulaire (titre, description, reward SOL).
  Chaque ligne : flèche upvote + compteur, titre, ligne meta (reward / auteur / date).
- **`/top` — Top 10 :** les 10 bounties `active` les plus upvotés (all-time).
- **`/done` — Done :** les bounties `status = done`.
- **`/admin` — Admin :** formulaire **login + mot de passe** ; une fois connecté,
  liste des bounties actifs avec **supprimer** / **marquer "done"** (+ lien de
  preuve optionnel) et un bouton **log out**.

**Esthétique :** terminal dark / degen — fond sombre, police monospace, accent
vert néon. Épuré et minimaliste. (Direction visuelle validée en brainstorming.)

## 9. Stratégie de test

Développement guidé par les tests (TDD) sur la **logique serveur critique** :
- Vérification de signature wallet.
- Calcul et application du seuil 10 $ (solde × prix).
- Unicité du vote (1 par wallet par bounty).
- Cooldown de 5 min sur les propositions.
- Contrôle des droits admin.

Les vérifications on-chain (RPC, Jupiter) seront mockées dans les tests.

## 10. Questions ouvertes / à confirmer plus tard

- Ticker exact du token et son adresse mint (nécessaires pour le solde/prix).
- Choix du fournisseur RPC Solana (public vs Helius/QuickNode pour la fiabilité).
- Nom de domaine `.xyz` exact.
- Liste initiale des adresses admin.
