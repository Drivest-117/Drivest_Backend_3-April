Cadre d'autorisations et de consentement
Autorisations mobiles Drivest, consentement facultatif et modèle de journalisation
Version
Version 1.1
Dernière mise à jour
5 avril 2026
Préparé pour
Drivest Limited

Objet du document
Ce document interne définit comment les autorisations et le consentement doivent désormais être demandés dans l'application afin que le parcours mobile reste fluide, défendable juridiquement et cohérent avec le site Web actuel, le comportement de l'application et le modèle de journalisation backend.

1. Objet de ce document
Ce document définit le cadre actuel d'autorisation et de consentement pour Drivest. Il est destiné à maintenir l'expérience mobile utilisable tout en restant aligné sur la position actuelle en matière de droit, de confidentialité et de boutique d'applications.
Le principe fondamental reste le même. Drivest ne doit demander que les autorisations nécessaires, doit les demander en contexte, ne doit pas pré-activer les choix facultatifs et doit être en mesure de prouver ce que l'utilisateur a choisi et quand.

2. Modèle actuel d'autorisation d'intégration
Drivest utilise désormais un modèle d'intégration en deux étapes.

L'étape 1 gère l'acceptation légale obligatoire. Elle couvre :
- l'acceptation des Conditions générales
- l'acceptation de la Politique de confidentialité
- la confirmation de l'âge
- la reconnaissance de l'avis de sécurité

L'étape 2 gère les autorisations opérationnelles et le consentement facultatif. Elle présente :
- l'accès à la localisation
- le choix des analyses
- le choix des notifications

La localisation est opérationnellement importante pour les fonctionnalités liées aux itinéraires et au stationnement, mais reste une autorisation du système d'exploitation. Les analyses sont facultatives. Les notifications sont facultatives.

3. Étape d'acceptation légale obligatoire
La première étape d'intégration doit indiquer clairement que Drivest est une plateforme d'aide à la conduite qui fournit uniquement des conseils.
Elle doit indiquer clairement que Drivest ne remplace pas le jugement de l'utilisateur, un instructeur de conduite ou la loi.
L'étape doit permettre d'accéder aux Conditions générales et à la Politique de confidentialité avant que l'utilisateur ne continue.
L'utilisateur doit cocher activement une case avant de continuer.
L'application ne doit pas continuer tant que cette case n'est pas cochée.
La même étape capture la confirmation de l'âge et la reconnaissance de la sécurité dans le cadre de l'événement d'acceptation.
Le backend doit stocker la version acceptée des conditions, de la confidentialité, de la sécurité, l'horodatage de l'acceptation, l'écran source, la version de l'application, la plateforme et l'identifiant d'installation si disponible.

4. Autorisation de localisation
La localisation doit être demandée via une action en contexte, puis via la boîte de dialogue d'autorisation du système d'exploitation.
La formulation explicative doit rester cohérente avec la position actuelle en matière de confidentialité :
- la localisation est utilisée pour les itinéraires et la navigation lorsqu'elle est active
- les fonctionnalités d'itinéraire et de stationnement ont besoin de la localisation lorsque l'utilisateur essaie de les utiliser
- Drivest ne doit pas suggérer qu'un historique de localisation continu en arrière-plan est stocké sur les serveurs

Si un utilisateur refuse l'autorisation de localisation, l'application peut restreindre les fonctionnalités liées aux itinéraires et au stationnement, mais elle ne doit pas bloquer les fonctionnalités d'apprentissage non liées.
L'application doit stocker le choix de localisation effectif de l'utilisateur sous la forme de l'un des choix suivants :
- autoriser (allow)
- refuser (deny)
- ignorer (skip)

5. Consentement aux analyses
Les analyses doivent rester facultatives lorsque le consentement est la base juridique prévue.
Le comportement des analyses doit rester désactivé tant que l'utilisateur n'a pas fait un choix affirmatif.
L'interface utilisateur doit décrire les analyses comme aidant à améliorer les performances et la fiabilité.
L'interface ne doit pas suggérer que les analyses sont nécessaires pour utiliser le service principal.
Le backend doit stocker :
- analyticsChoice
- horodatage
- surface source
- version de l'application
- plateforme
- identifiant d'installation si disponible

6. Consentement aux notifications
Les notifications doivent rester facultatives.
L'invite doit décrire leur finalité opérationnelle, y compris les mises à jour, les réservations, les rappels et les activités importantes du compte, le cas échéant.
Les notifications ne doivent pas être pré-activées par défaut.
L'application doit stocker le choix de préférence dans l'application de l'utilisateur séparément du résultat de l'autorisation du système d'exploitation.
Le backend doit stocker :
- notificationsChoice
- horodatage
- surface source
- version de l'application
- plateforme
- identifiant d'installation si disponible

7. Exigences de journalisation
Le système doit journaliser l'événement d'acceptation légale séparément des choix d'autorisation et de consentement.
Au minimum, le backend doit stocker :
- la version des conditions
- la version de la confidentialité
- la version de la sécurité
- l'horodatage de l'acceptation
- l'état de la confirmation de l'âge
- le choix d'analyse
- l'horodatage de l'analyse
- le choix des notifications
- l'horodatage des notifications
- le choix de la localisation
- l'horodatage de la localisation
- l'écran source ou la surface source
- la version de l'application
- la plateforme
- l'identifiant d'installation si disponible

8. Exigence d'implémentation actuelle
Le cadre d'autorisation doit correspondre au comportement réel de l'application.
Si le flux légal décrit les analyses comme facultatives, les analyses doivent être réellement facultatives dans l'implémentation.
Si l'application stocke le choix de localisation dans le cadre de l'intégration, ce modèle de données doit être reflété dans la documentation de conformité interne.
Si l'application ajoute ultérieurement une nouvelle autorisation, un nouveau comportement de suivi ou un traitement continu de la localisation en arrière-plan, le cadre d'autorisation, la politique de confidentialité, les textes de l'application et les déclarations de la boutique doivent tous être mis à jour ensemble avant la sortie.

9. Inventaire final des autorisations
Autorisation ou choix
Position finale

Reconnaissance légale combinée obligatoire
Acceptation des Conditions, acceptation de la Confidentialité, confirmation de l'âge et reconnaissance de la sécurité. Requis avant que l'utilisateur puisse accéder au produit.

Localisation
Demandée en contexte pour prendre en charge les itinéraires, la navigation et les fonctionnalités dépendant de la localisation. Contrôlée par le système d'exploitation, mais l'application stocke également un état de choix enregistré.

Analyses
Consentement facultatif. Doit rester désactivé tant que l'utilisateur n'a pas fait un choix affirmatif.

Notifications
Consentement facultatif. Ne doit pas être pré-activé. Les paramètres de l'appareil restent l'autorité finale en matière d'autorisation, tandis que l'application stocke le choix de préférence de l'utilisateur dans l'application.
