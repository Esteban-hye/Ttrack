<p align="center"><img src="build/icon.png" width="96" alt="Ttrack"></p>

<h1 align="center">Ttrack</h1>
<p align="center">Suivi des calories et des macros pour Windows · <b>version alpha</b></p>

---

## Fonctionnalités

- **Journal du jour** : anneau des calories, barres protéines / glucides / lipides par rapport aux objectifs, repas (petit-déjeuner, déjeuner, dîner, collation, renommables)
- **Ajout en un clic** : un clic sur un aliment ou un plat l'ajoute avec sa portion habituelle ; recherche + Entrée ; bouton pour choisir la quantité ; annulation
- **Aliments** : valeurs pour 100 g, 100 ml ou à la pièce (calories, protéines, glucides, lipides, fibres, sucres, sel), portion habituelle, favoris ; calories calculées depuis les macros si non renseignées
- **Open Food Facts** : remplir une fiche aliment depuis la base publique, par nom ou par code-barres
- **Prix** : « X € pour Y g » sur chaque aliment ; coût de chaque entrée, repas, jour et plat, coût moyen dans les statistiques
- **Tri** des aliments et des plats : calories, macros, protéines pour 100 kcal, prix, protéines par €
- **Eau** (objectif en litres) et **série** de jours saisis d'affilée
- **Plats** : composés d'aliments, nombre de portions, poids cuit ; ajout au journal en portions ou en grammes ; un repas du journal peut devenir un plat
- **Saisie rapide** : juste des calories (et macros) sans créer d'aliment
- **Recopier un jour** ou un seul repas
- **Statistiques** : 7 / 30 / 90 jours, calories et protéines par jour, répartition des macros, suivi du poids, aliments les plus consommés
- **Synchronisation entre plusieurs PC** via une base Supabase personnelle (gratuite), données chiffrées de bout en bout. Le projet Supabase de Tmoney peut être réutilisé : Ttrack a ses propres tables
- **Sauvegarde** : export / import en .json
- Mises à jour automatiques depuis les Releases GitHub, thème clair / sombre

## Installation

1. Télécharger `Ttrack-Setup-x.x.x.exe` depuis la page **Releases**
2. Lancer l'installateur
3. Si Windows affiche « Windows a protégé votre ordinateur » : **Informations complémentaires → Exécuter quand même** (application non signée)

Données : `%APPDATA%\Ttrack\ttrack.json` (une copie `.bak` est faite à chaque lancement). Les identifiants de synchronisation sont dans `sync.bin`, protégés par Windows.

## Développement

```bash
npm install      # dépendances
npm start        # lancer en mode développement
npm run shot     # captures d'écran + tests au clic, avec des données de démo (dossier shots/)
npm run setup    # créer l'installateur dans dist/
npm run icon     # régénérer build/icon.png depuis build/icon.svg
```

## Raccourcis

| Raccourci | Action |
|-----------|--------|
| Ctrl+F | Rechercher un aliment ou un plat à ajouter |
| Entrée (dans la recherche) | Ajouter le premier résultat · Maj+Entrée pour choisir la quantité |
| Ctrl+N | Nouvel aliment (ou nouveau plat dans la page Plats) |
| ← / → | Jour précédent / suivant |
