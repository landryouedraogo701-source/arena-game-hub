# Arena Game Hub — plan d’implémentation V1

## Règles non négociables
- La branche de travail est `work/arena-v1-implementation`, créée depuis `feat/tournaments-ui`.
- Ne pas fusionner dans `main`, ne pas déployer et ne pas appliquer de migration à la base de production sans validation explicite.
- Conserver les écrans et composants existants qui fonctionnent ; toute évolution doit suivre les maquettes et les parcours décrits ici.
- Aucun argent engagé dans les matchs en V1.
- Les matchs amicaux sont sans classement ni progression de tournoi.
- Tournois et championnats ont une progression par tours : le gagnant avance, le perdant est éliminé du tableau actif, mais l’historique du match est conservé.
- Les Live sont toujours liés à un match. Pas de diffusion publique indépendante en V1.
- Les autorisations doivent être contrôlées côté serveur/RLS, jamais seulement par le masquage d’un bouton.

## Navigation principale
1. Accueil
2. Jeux
3. Compétitions
4. Live
5. Profil

Les messages sont accessibles depuis l’icône de messagerie, les profils et les salles/matchs. La bulle de discussion contextuelle peut être ouverte/fermée au toucher sans masquer les commandes principales.

## Parcours et responsabilités des écrans

### Accueil
- Présenter les actions principales : jouer, rejoindre une salle, voir les compétitions et retrouver ses matchs.
- Afficher les états utiles : match en cours, prochaine rencontre, notifications et conversations non lues.
- Les états vides doivent proposer une action claire, pas une page noire ou un message technique.

### Jeux et modes
- Afficher les jeux actifs provenant du catalogue.
- Montrer les formats réellement pris en charge par chaque jeu.
- Ne jamais proposer un format que la configuration du jeu ne permet pas.

### Matchs amicaux
- Création de salle avec jeu, format, capacité et code/lien de partage.
- Formats 1v1, 2v2 et FFA multijoueur uniquement lorsqu’ils sont pris en charge par le jeu.
- Salle : liste des joueurs, statut prêt, compte à rebours, ouvrir le jeu, chat de match et terminer.
- Fin de match sans classement, points ou progression compétitive.

### Compétitions et tournois
- Lister les tournois publiés avec jeu, format, dates, statut, inscrits/max, places restantes et noms des inscrits selon les règles de confidentialité.
- Un utilisateur peut s’inscrire une seule fois ; le serveur doit empêcher les doublons et les inscriptions après clôture.
- Les organisateurs autorisés voient les actions de gestion ; les joueurs ordinaires ne peuvent pas contourner les contrôles serveur.
- Création en brouillon, aperçu, publication des inscriptions, clôture, tirage au sort et progression.
- Le tirage doit être atomique, sans doublons, et gérer les formats multijoueurs valides.
- Après validation du résultat, le gagnant avance ; le perdant quitte le tableau actif, mais le résultat reste consultable.
- Les erreurs destinées aux joueurs doivent être compréhensibles en français et ne pas exposer le détail interne SQL.

### Championnats
- Parcours distinct des tournois si les règles de qualification diffèrent.
- Dépôt de capture d’écran comme preuve lorsque le règlement le demande.
- L’administrateur autorisé examine la preuve, accepte/refuse avec motif et marque explicitement la qualification.
- Journaliser les décisions pour permettre une contestation et un audit.

### Live lié au match
- Seuls les joueurs autorisés et l’hôte du flux peuvent lancer/arrêter les actions qui leur sont attribuées.
- Un Live ne peut pas être créé sans match valide.
- États explicites : indisponible, préparation, connexion, en direct, interrompu, terminé.
- Prévoir reconnexion, arrêt propre, erreurs réseau lisibles et prévention des sessions Live en double.
- Un Live ne doit pas transformer un match amical en compétition ni créer de classement.

### Messages
- Messages privés entre comptes, avec vérification des participants, états de lecture et gestion des conversations.
- Chat de salle séparé des messages privés.
- RLS stricte : seul l’expéditeur et le destinataire peuvent lire une conversation privée.
- Prévoir blocage/signalement avant ouverture publique large.

### Profil, notifications et administration
- Profil public contrôlé, historique des matchs et compétitions.
- Notifications pour inscription, adversaire, changement de tour, preuve examinée et message reçu.
- Espace administration protégé par rôle serveur : gestion des rôles, signalements, preuves, tournois et journaux d’audit.
- Aucun utilisateur ne peut s’attribuer lui-même le rôle organisateur ou administrateur.

## Architecture attendue
- React + TypeScript + Vite + Capacitor pour l’application Android existante.
- Supabase/Postgres comme source de vérité ; fonctions RPC pour les transitions critiques et opérations concurrentes.
- Migrations SQL versionnées dans le dépôt, relues et testées avant toute application à la production.
- Politiques RLS testées avec utilisateur anonyme, joueur connecté, organisateur, administrateur et utilisateur non participant.
- Ne jamais modifier la structure de base à partir d’une hypothèse : comparer le schéma réel, les migrations et les appels du client.

## Ordre de travail
1. Audit des composants, routes, schéma, migrations et permissions.
2. Corriger les erreurs visibles et les décalages client/base.
3. Terminer tournois/inscriptions/tirage/progression.
4. Terminer messages privés et permissions.
5. Vérifier le Live lié aux matchs et ses états.
6. Tests TypeScript/build, tests de parcours et test APK.
7. Présenter les résultats pour validation ; aucun merge/deploy avant validation.

## Scénarios d’acceptation P0
- Joueur non organisateur : peut parcourir et s’inscrire, ne peut pas créer/publier un tournoi ni s’attribuer un rôle.
- Organisateur autorisé : peut créer un brouillon, le publier, fermer les inscriptions et lancer un tirage valide.
- Double appui / requêtes concurrentes : pas de double inscription, double match ou double session Live.
- Tournoi complet/fermé : inscription refusée avec message clair.
- Résultat validé : seul le gagnant avance ; l’historique des deux joueurs est conservé.
- Match amical : aucune progression ni classement compétitif.
- Message privé : un tiers ne peut pas lire ni envoyer dans la conversation.
- Live : impossible sans match valide ; seul l’hôte autorisé démarre/termine son flux.
- Schéma incohérent ou réseau indisponible : écran stable, message compréhensible, possibilité de réessayer.
- APK Android : ouverture, navigation, reprise après arrière-plan et reconnexion sans écran noir ni crash.

## État actuel
- Branche isolée créée depuis `feat/tournaments-ui`.
- Première correction appliquée à `TournamentHub.tsx` : les erreurs génériques de création/publication n’exposent plus directement le texte SQL au joueur ; le code d’erreur reste disponible pour le diagnostic.
- Aucun changement appliqué à Supabase, aucun merge vers `main`, aucun déploiement.
- Cette documentation décrit la cible et les tests ; les fonctionnalités ne sont considérées terminées qu’après tests et validation sur APK.
