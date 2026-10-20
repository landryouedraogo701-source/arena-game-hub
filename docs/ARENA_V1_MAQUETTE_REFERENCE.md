# ARENA GAME HUB — Maquette de référence V1
Version : 1.0 — 20 octobre 2026
Branche de référence de travail : feat/auth-branding-v1

## 1. But et règles de livraison
Ce document est la référence fonctionnelle et visuelle pour les écrans Arena V1. Toute divergence doit être documentée et validée avant implémentation. Il s'agit d'une spécification textuelle de maquette, pas d'une preuve que les écrans sont déjà réalisés ou testés.

- Priorité mobile Android, mise en page responsive.
- Interface en français, textes clairs et erreurs compréhensibles.
- Aucun paiement, pari ou argent dans les matchs V1.
- Ne jamais afficher une action si l'utilisateur n'a pas le droit de l'exécuter.
- Chaque écran doit gérer chargement, contenu, liste vide, erreur, absence de réseau et accès refusé.
- Ne pas afficher d'erreur technique SQL/Supabase brute aux joueurs.
- Respecter l'architecture actuelle du dépôt ; ne pas réécrire les maquettes sans justification.
- Aucune migration Supabase de production, fusion vers main, publication ou APK déclaré prêt sans tests et validation explicite.

## 2. Direction artistique
- Identité : Arena Game Hub, centre d'organisation et de participation aux jeux.
- Ambiance : e-sport moderne, lisible et sobre ; fond bleu nuit, surfaces légèrement plus claires, accents turquoise et violet, textes à contraste élevé.
- Logo : emblème « A » + Arena + signature GAME HUB ; variante compacte pour navigation.
- Cartes avec rayons cohérents, bordures discrètes, espaces réguliers et états tactiles visibles.
- Boutons principaux explicites ; une action primaire par écran si possible.
- États : actif, sélectionné, désactivé, chargement, succès, avertissement et erreur.
- Ne pas compter uniquement sur la couleur pour transmettre un statut : ajouter texte ou icône.
- Respecter les zones système Android, clavier, petites largeurs, grandes polices et retour arrière.
- Accessibilité : cibles tactiles confortables, libellés accessibles, contrastes suffisants, aucun texte essentiel dans une image seule.

## 3. Navigation principale
Navigation inférieure après connexion :
1. Accueil
2. Jeux / Matchs
3. Compétitions
4. Live
5. Profil

Messages privés accessibles depuis le profil, les profils joueurs et les contextes pertinents. Le bouton flottant de discussion en match doit pouvoir être affiché/masqué au doigt sans masquer les commandes du jeu.

## 4. Inventaire des écrans

### A. Démarrage et compte
A01 — Écran de lancement : logo, chargement court, récupération de session ; pas d'écran noir persistant.
A02 — Inscription : email, pseudo, mot de passe, confirmation si prévue par le flux existant, règles de saisie, lien vers connexion.
A03 — Connexion : email, mot de passe, afficher/masquer le mot de passe, récupération du compte si disponible, connexion Google si configurée.
A04 — Confirmation / aide email : instructions adaptées au résultat réel de Supabase.
A05 — Erreur d'authentification : message humain, action pour corriger ou réessayer.
A06 — Profil initial : pseudo, avatar facultatif, préférences minimales.
Critère : l'utilisateur peut créer un compte, se connecter, se déconnecter et retrouver une session ; aucun succès fictif.

### B. Accueil
B01 — Tableau de bord : salutation, raccourcis Jouer / Rejoindre / Créer si autorisé, compétitions à venir, matchs en cours, lives rattachés à un match et messages récents.
B02 — Notifications : événements de compte, inscriptions, matchs, messages et décisions de qualification.
B03 — Recherche : joueurs, compétitions et matchs, avec filtres et état vide.
Critère : données datées et états réels ; pas de chiffres d'exemple présentés comme réels.

### C. Jeux et matchs
C01 — Choisir un jeu : jeux disponibles, formats pris en charge, bouton continuer.
C02 — Choisir le type : Match amical, Compétition, Championnat/Tournoi selon le modèle retenu.
C03 — Créer un match amical : jeu, format réellement pris en charge, nombre de joueurs, paramètres autorisés.
C04 — Rejoindre une salle : code/lien, vérification de capacité, erreurs lisibles.
C05 — Salle / lobby : jeu, hôte, joueurs inscrits et places restantes, statut, actions disponibles.
C06 — Match en cours : participants, état du match, accès au chat et au live lié.
C07 — Résultat : score ou résultat adapté au jeu, confirmation, contestation si prévue.
C08 — Historique : matchs passés et détails.
Règle : les matchs amicaux sont sans classement ni progression de tournoi. Les jeux à 4 joueurs ou plus doivent être pris en charge si le jeu et son format le permettent. Ne jamais proposer un format absent de la configuration effective.

### D. Compétitions et championnats
D01 — Hub Compétitions : onglets À venir / En cours / Terminées ; bouton « + Créer » visible uniquement aux organisateurs autorisés, et clairement accessible.
D02 — Formulaire de création : nom, jeu, description, format, nombre de participants/équipes, calendrier, règles, inscription, organisateur.
D03 — Aperçu avant publication : toutes les informations, capacité, dates, règles, statut et bouton publier si autorisé.
D04 — Détail d'événement : nom, jeu, organisateur, règles, dates, statut, places disponibles, compteur d'inscrits et liste des pseudos/noms visibles selon les règles de confidentialité.
D05 — Inscription : conditions, confirmation, prévention des doubles inscriptions, liste d'attente si implémentée.
D06 — Espace organisateur : modifier ce qui est permis, gérer les inscriptions, démarrer l'événement, effectuer le tirage, faire progresser les tours, terminer l'événement.
D07 — Tableau de progression : tours/étapes, rencontres, adversaires, statut de chaque match, prochain tour.
D08 — Preuve de résultat : ajout de capture d'écran, indication du match concerné, horodatage si disponible, statut d'examen.
D09 — Vérification administrateur : preuve consultable, accepter/refuser avec motif, qualifier ou disqualifier, historique d'action.
D10 — Résultat final : finaliste, champion, tableau final et historique.
D11 — Mes participations : inscrits, événements actifs, prochains matchs, résultats.
Règles : seul l'organisateur autorisé peut publier et gérer son événement. L'administrateur a un rôle distinct et auditable. Un gagnant avance ; un perdant sort de la progression active, mais son match reste dans l'historique. Un championnat ne qualifie pas automatiquement sur la seule base d'une capture : la décision suit les règles de vérification. Un organisateur ne peut pas modifier les résultats validés sans procédure explicite.
Règle de suppression : l'organisateur peut supprimer son propre championnat uniquement dans les états autorisés ; si des inscriptions ou matchs existent, demander confirmation et appliquer une politique explicite d'annulation/archivage plutôt qu'une suppression silencieuse.

### E. Tirage et progression
E01 — Confirmation de tirage : participants valides, nombre de places, règles de bye si nombre impair.
E02 — Tableau généré : confrontations visibles et cohérentes.
E03 — Match d'un tour : joueur/équipe A contre B, statut, heure, résultat attendu.
E04 — Action administrateur de promotion : autorisée seulement avant le démarrage du match et avec raison enregistrée.
E05 — Tour suivant : seuls les gagnants validés avancent.
E06 — Final : déterminer le vainqueur uniquement à partir du résultat validé.
Règles : tirage reproductible/auditable selon l'implémentation ; empêcher deux matchs concurrents incompatibles pour un même participant ; traiter les égalités et abandons selon une règle définie par jeu/événement ; conserver les événements de progression.

### F. Live
F01 — Liste Live : uniquement des sessions rattachées à un match existant, en cours et accessible.
F02 — Détail du live : jeu, match, participants, statut, hôte et commandes permises.
F03 — Démarrer le live : réservé à l'acteur autorisé selon les règles produit ; afficher l'état de démarrage.
F04 — Rejoindre le live : contrôler les permissions et le statut.
F05 — Contrôles live : démarrer, arrêter, quitter ; confirmation si l'action met fin à la session pour tous.
F06 — Aucun live : message normal « Aucun live en cours » et bouton retour, pas un écran d'erreur.
F07 — Échec live : explication lisible, réessayer, signaler si nécessaire.
Règles : pas de diffusion générale indépendante d'un match ; l'état du live est lié à l'état du match. La fermeture d'un écran ne doit pas arrêter par erreur le live global. Les autorisations de lecture et d'écriture doivent être vérifiées côté serveur.

### G. Messages privés et chat de match
G01 — Boîte de réception : conversations, dernier message, heure, non lus.
G02 — Conversation privée : historique, champ texte, envoyer, états envoi/échec, blocage/signalement si ces fonctions existent.
G03 — Démarrer une conversation depuis un profil.
G04 — Chat de match : réservé aux participants autorisés ; séparation claire avec les messages privés.
G05 — Bulle flottante en match : ouvrir/fermer, ne pas gêner les commandes du jeu.
Règles : confidentialité par conversation, accès uniquement aux membres autorisés, validation serveur, limites anti-spam. Ne pas considérer le chat de match comme une messagerie privée globale.

### H. Profil et réglages
H01 — Profil public : pseudo, avatar, activité publique autorisée.
H02 — Mon profil : modifier les informations permises, préférences.
H03 — Paramètres : notifications, confidentialité, aide.
H04 — Sécurité du compte : session, déconnexion, récupération si disponible.
H05 — Signaler un joueur / contenu si prévu.
H06 — Écran d'erreur / assistance : référence non sensible et instruction utile.

### I. Administration
I01 — Accès admin : rôle vérifié côté serveur, jamais sur le seul fait de masquer/afficher un bouton.
I02 — Tableau de bord : événements en attente, preuves à examiner, signalements et indicateurs utiles.
I03 — Gestion d'événement : état, organisateur, participants, actions permises.
I04 — Qualification : capture, décision, motif, administrateur, date.
I05 — Journal d'audit : actions sensibles, acteur, objet, heure, raison.
I06 — Gestion des rôles : changement protégé et traçable.
Règles : principe du moindre privilège ; aucune clé secrète dans l'application ; chaque action sensible est vérifiée par la base et les politiques RLS.

## 5. États obligatoires par écran
Pour chaque liste ou détail connecté aux données, prévoir :
1. Chargement avec indicateur et éviter le clignotement.
2. Succès avec données réelles.
3. Vide avec explication et action suivante.
4. Erreur réseau avec réessayer.
5. Permission refusée avec explication sans fuite technique.
6. Session expirée avec retour à la connexion.
7. Données manquantes/événement supprimé avec retour sûr.
8. Action en cours désactivée pour éviter les doubles clics.
9. Confirmation pour suppression, annulation, publication, tirage et fin de live.
10. Succès uniquement après confirmation du serveur.

## 6. Rôles et permissions
- Joueur : gérer son profil, rejoindre événements ouverts, accéder à ses matchs/messages autorisés.
- Organisateur : créer et gérer ses propres événements dans les états autorisés ; pas les événements des autres.
- Administrateur : modération, examen de preuves, qualification et actions admin autorisées.
- Hôte de match/live : actions limitées au match dont il est responsable.
Les rôles et appartenances doivent être validés côté serveur/base, pas seulement par l'interface.

## 7. Modèle fonctionnel à vérifier avant implémentation
Ne pas supposer que ces tables/champs existent. Les confronter au schéma Supabase réel avant tout changement :
- profils/utilisateurs et rôles
- jeux et formats pris en charge
- matchs, participants, résultats et historique
- événements, inscriptions, organisateurs
- tours, confrontations et progression
- preuves de résultat et décisions administratives
- sessions live et lien vers un match
- conversations privées et membres
- messages de conversation et chat de match
- notifications et journal d'audit
Les changements de schéma doivent être livrés sous forme de migrations versionnées, testées sur environnement non-production et validées avant application en production.

## 8. Parcours de test d'acceptation
T01 Inscription valide, connexion, déconnexion et reconnexion.
T02 Email/mot de passe incorrect : message français, pas de crash.
T03 Joueur standard : pas de création/promotion admin non autorisée.
T04 Organisateur autorisé : voit « + Créer » et peut ouvrir le formulaire.
T05 Joueur standard : bouton de création absent ou accès refusé proprement.
T06 Création d'événement invalide : validation champ par champ.
T07 Création valide : événement enregistré et visible après rechargement.
T08 Inscription répétée : pas de doublon.
T09 Détail : compteur et liste de participants correspondent aux données.
T10 Publication : refus clair si organisateur ou statut incorrect.
T11 Tirage : chaque participant affecté une seule fois, byes gérés.
T12 Gagnant avance, perdant retiré de la progression active, historique conservé.
T13 Preuve : chargement, consultation, acceptation/refus avec motif.
T14 Match amical : aucun classement ni progression.
T15 Format 4+ : autorisé seulement pour les jeux qui le prennent en charge.
T16 Liste Live vide : message « Aucun live en cours », pas erreur.
T17 Live : démarrage, rejoindre, quitter et arrêt contrôlés.
T18 Chat de match : seul un participant autorisé accède.
T19 Messages privés : seul un membre de la conversation lit/écrit.
T20 Perte réseau : erreur récupérable et aucun succès fictif.
T21 App Android : lancement, retour arrière, clavier, petites tailles, rotation si supportée.
T22 Régression : vérifier qu'une modification auth ne casse pas les écrans déjà existants.

## 9. Ordre de travail et critères de sortie
Étape 1 — Authentification + identité visuelle : inscription, connexion, erreurs, logo, session.
Étape 2 — Matchs : formats, lobby, participation, résultat et historique.
Étape 3 — Compétitions : création, publication, inscriptions, noms/compteurs, organisation.
Étape 4 — Tirage, progression, preuves et administration.
Étape 5 — Live lié au match.
Étape 6 — Messages privés et chat de match.
Étape 7 — Sécurité/RLS, tests de régression, APK candidate et validation utilisateur.

Pour chaque étape :
- relire le code existant et le schéma réel ;
- documenter les fichiers et migrations proposés ;
- implémenter sur la branche dédiée ;
- lancer build/typecheck/tests disponibles et noter les résultats réels ;
- vérifier les états d'erreur et permissions ;
- fournir la liste des tests réussis/échoués/non exécutés ;
- faire tester l'APK à l'utilisateur ;
- attendre validation avant de passer à l'étape suivante.
