Écrans légaux d'intégration dans l'application
Modèle d'intégration actuel en deux étapes
Version
Version 1.1
Dernière mise à jour
5 avril 2026
Préparé pour
Drivest Limited

Objet du document
Ce document interne définit le flux actuel d'approbation légale et d'autorisations pour l'intégration de Drivest. Il reflète l'implémentation actuelle de l'application et remplace les anciennes formulations qui ne décrivaient pas entièrement le modèle de consentement stocké.

1. Objectif
Ce document définit le flux actuel d'intégration dans l'application pour l'acceptation légale et les autorisations. Le modèle approuvé utilise deux étapes plutôt qu'un long parcours légal multi-écrans. L'objectif est de réduire la friction de l'utilisateur tout en capturant une reconnaissance légale valide et des choix enregistrés séparément qui peuvent être appliqués et prouvés par le backend.

2. Étape 1 : Acceptation légale combinée
L'étape 1 est la porte d'entrée obligatoire dans l'application.

Titre actuel :
Avant de commencer

Corps du texte actuel :
Drivest est une plateforme d'aide à la conduite. Elle fournit uniquement des conseils et ne remplace pas votre jugement, votre instructeur ou la loi.

Vous devez toujours respecter la signalisation routière, le code de la route et les conditions réelles. Si un élément de l'application entre en conflit avec la route, suivez la route.

En continuant, vous confirmez que vous avez 16 ans ou plus, que vous comprenez et acceptez l'avis de sécurité, et que vous acceptez les Conditions générales et la Politique de confidentialité.

Contrôles requis :
- Voir les Conditions
- Voir la Confidentialité
- une case à cocher obligatoire
- Bouton Continuer désactivé tant que la case n'est pas cochée

Texte actuel de la case à cocher :
Je confirme que j'ai 16 ans ou plus, je comprends l'avis de sécurité et j'accepte les Conditions générales et la Politique de confidentialité.

Cette étape crée le dossier d'acceptation légale faisant foi.
Le backend doit stocker :
- termsVersion (version des conditions)
- privacyVersion (version de la confidentialité)
- safetyVersion (version de la sécurité)
- ageConfirmed (âge confirmé)
- safetyAccepted (sécurité acceptée)
- horodatage d'acceptation
- sourceScreen (écran source)
- version de l'application
- plateforme
- identifiant d'installation si disponible

3. Étape 2 : Autorisations et consentement optionnel
L'étape 2 est l'écran des autorisations opérationnelles.

Titre actuel :
Autorisations

Corps du texte actuel :
Drivest a besoin de certaines autorisations pour fonctionner correctement. La localisation est utilisée pour les itinéraires et la navigation lorsqu'elle est active. Les analyses aident à améliorer les performances et la fiabilité et sont facultatives. Les notifications vous tiennent au courant des réservations et de l'activité.

Contrôles requis :
- une action de localisation qui déclenche le flux d'autorisation de localisation natif du système
- des actions distinctes autoriser et ne pas autoriser pour les analyses
- des actions distinctes activer et pas maintenant pour les notifications
- Bouton Continuer

Section de localisation actuelle :
Titre : Localisation
Message : La localisation est utilisée pour les itinéraires et la navigation lorsqu'elle est active.
Bouton : Demander l'accès à la localisation

États actuels du statut de localisation :
- L'accès à la localisation est déjà autorisé pour Drivest.
- L'accès à la localisation est actuellement refusé. Vous pouvez continuer, mais les fonctionnalités d'itinéraire resteront limitées tant que vous ne l'aurez pas activé.
- La localisation est facultative pour l'instant, mais les fonctionnalités d'itinéraire et de stationnement en ont besoin lorsque vous les utilisez.

Section d'analyse actuelle :
Titre : Analyses facultatives
Message : Les analyses aident à améliorer les performances et la fiabilité et sont facultatives.
Actions :
- Autoriser les analyses
- Ne pas autoriser

Section de notifications actuelle :
Titre : Notifications facultatives
Message : Les notifications vous tiennent au courant des réservations et de l'activité.
Actions :
- Activer les notifications
- Pas maintenant

4. Mappage backend
Au minimum, l'étape 1 doit créer ou mettre à jour des enregistrements dans :
- legal_document_versions
- user_legal_acceptances

Au minimum, l'étape 2 doit créer ou mettre à jour les enregistrements de choix actuels et d'historique pour :
- analyticsChoice
- notificationsChoice
- locationChoice

Les modifications ultérieures des paramètres doivent être réécrites dans le même modèle de conformité backend afin que Drivest puisse prouver à la fois le choix d'intégration initial et les modifications ou retraits ultérieurs, le cas échéant.

5. Règles strictes
Aucune case à cocher ne doit être pré-sélectionnée.
L'application ne doit pas permettre à un utilisateur de contourner l'étape d'acceptation légale et de continuer dans le produit sans accord.
Les Conditions générales et la Politique de confidentialité doivent être accessibles depuis l'étape légale.
L'avis de sécurité doit rester intégré au texte d'acceptation légale, à moins que la position légale ne change et que les versions ne soient mises à jour en conséquence.
L'étape des autorisations ne doit pas regrouper les analyses, les notifications et la localisation dans un seul consentement vague.
Chaque choix doit rester compréhensible et enregistrable séparément.
Tout changement important apporté au texte légal, au modèle d'autorisation ou au comportement suivi doit déclencher une mise à jour de la version et une nouvelle acceptation si nécessaire.
