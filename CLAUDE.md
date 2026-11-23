# CLAUDE.md — Monkey Arena

Roguelite d'arène de gladiateurs en 2D, en français, combats automatiques. Le joueur choisit l'un des 8 « potes », les 7 autres deviennent les boss de la run (le dernier est couronné Empereur). 7 actes × (5 combats + 1 boss) = 42 combats. Après chaque victoire, le joueur choisit 1 augment parmi 3 (4 pour MaximusRr), et l'équipement gagné s'affiche sur le gladiateur.

Jeu en ligne : GitHub Pages (`https://kevinf29.github.io/monkey-arena/`), servi directement depuis `main`.

## Lancer le jeu

- Aucun build, aucune dépendance (seulement les polices Google Fonts Cinzel et Inter).
- **Passer par un serveur HTTP**, pas par `file://` : `buildParts()` lit des pixels avec `getImageData`, ce qui lève une erreur de canvas « tainted » en `file://`, et les sprites tombent alors sur le rendu vectoriel de secours.
  ```
  python -m http.server 8000   # puis http://localhost:8000
  ```
- Pas de tests automatisés. L'équilibrage (`TUNE`) se vérifie avec le simulateur ci-dessous.

## Simulateur d'équilibrage (`tools/simulate.js`)

Script Node sans dépendance. Il extrait le bloc `//LOGIC-START` … `//LOGIC-END` d'`index.html` (exécuté via `new Function`, avec un `Math.random` remplacé par un générateur seedé, donc résultats reproductibles), puis joue des runs complètes de 42 combats pour chaque perso, avec deux stratégies de choix d'augment : **au hasard** et **le plus rare** (égalités tirées au hasard). Il affiche, par perso, le taux de victoire et la répartition des morts par acte (+ part des morts face à un boss).

```
node tools/simulate.js                  # 500 runs par perso et par stratégie (~30 s)
node tools/simulate.js --runs 2000 --seed 7
node tools/simulate.js --perso darkkus
```

Le simulateur n'utilise que ce qu'expose le bloc logique (`makePlayer`, `makeEnemy`, `newFight`, `step`, `rollChoices`, `applyAug`, `postWin`, `shuffle`…) : si l'une de ces fonctions est renommée ou change de signature, mettre à jour la liste `EXPORTS` et `playRun` du script.

## Structure du dépôt

```
index.html          tout le jeu : CSS, HTML des écrans, JS (≈1700 lignes)
README.md
tools/simulate.js   simulateur d'équilibrage (Node)
assets/
  persos/<id>.png       8 gladiateurs jouables, 204×490, découpés en marionnette (RIG_PERSO)
  ennemis/<nom>.png     14 types d'adversaires, 204×490 (RIG_ENEMY)
  ennemis/{loup,ours,lion,tigre}.png   4 bêtes, ~420×300, non découpées
  items/<objet>.png     armes et pièces d'équipement (~320 px sur le grand côté)
  arenes/acte1..7.webp  décor peint de chaque acte
```

## Organisation de `index.html`

Ordre du fichier, avec les repères à chercher :

1. **`<style>`** — thème romain : variables CSS sur `:root` (`--gold`, `--bronze`, `--parch`…), boutons bronze `.btn`, panneaux `.tablet` / parchemin `.desc`, cartes d'augments `.card.r-C|R|L`, barres de vie segmentées, jauge de spécial `.gauge`.
2. **Écrans HTML** (`<section class="screen">`, un seul `.on` à la fois via `show(id)`) : `s-start` (choix du perso), `s-intro` (intro d'acte + boss), `s-fight`, `s-reward`, `s-stats`, `s-end`.
3. **Bloc logique `//LOGIC-START` … `//LOGIC-END`** — données et règles de combat, sans DOM : `RAR`, `TYPES`, `CHARS`, `SPECIALS`, `AUGS`, `ACT_NAMES`, `ENEMY_NAMES`, `ENEMY_LOOK`, `BEASTS`, `baseFighter`, `makePlayer`, `TUNE`, `scaleOf`, `makeEnemy`, `strike`, `doSpecial`, `step`, `rollChoices`, `applyAug`, `postWin`.
4. **`/* APPARENCE */`** — `WEAPON_OF`, `SHIELD_RANK`, `computeLook()` (augments → look), puis le rendu vectoriel de secours `drawGlad` / `drawWeapon` / `drawHair`.
5. **`/* SPRITES DES POTES */`** — `SPR`, `loadSprites`, objets dessinés (`ITEM_FILES`, `WEAPON_IMG`, `WEAR`, `wear`, `drawWeaponImg`), équipement pixelisé (`pixelize`, `getGear`, `gearBack/Front/Head/Weapon`), découpe marionnette (`PART_POLY`, `PIV`, `RIG_PERSO`, `RIG_ENEMY`, `buildParts`), `drawSpriteGlad`, poing (`getFist`), poses (`poseIdle`, `poseOf`), bêtes (`drawBeast`).
6. **`/* UI */`** — état global (`selChar, P, N, ST, BOSSES, speed…`), `renderChars`, `startRun`, `showIntro`, `prepareFight`, barres, chips, icônes pixel 12×12 (`ICON_DEF`, `ic`, `icImg`, `AUG_ICON`, `AUG_IMG`, `augArt`).
7. **`/* arène */`** — canevas `#cv` 1200×660 dessiné en coordonnées logiques **600×330** (`RES = 2`), `POS` des combattants, `ARENAS` (décor pixel art de secours, 200×110 agrandi ×3), `ARENA_IMG` (décors peints prioritaires), `drawArena`, effets (`burst`, particules, nombres flottants, secousse, gel, zoom de fin), boucle `loop`.
8. Flux de run : `startFight` → `endFight` → `showReward` → (`prepareFight` | `showIntro`), `endRun`, `statsHTML`, branchement des boutons.

## Système de combat

Moteur à pas fixe : `loop` découpe le temps réel en pas de 0,02 s et appelle `step(ST, dt, rnd)`. La logique ne dessine rien : elle pousse des **événements** dans `ST.events` (`swing`, `hit`, `crit`, `miss`, `thorns`, `poison`, `bleed`, `special`, `none`) que l'UI consomme. Les événements d'un coup (`strike = 1`) sont retardés de `IMPACT` (moitié de l'animation d'attaque) dans `PEND`, pour que dégâts, flash et barre de vie (`shownHp`) tombent au moment de l'impact.

Combattant = objet créé par `baseFighter()` (toutes les stats à zéro/défaut) puis surchargé. Champs runtime remis à zéro par `resetRuntime()` à chaque combat.

**Cadence** : `cd` diminue de `dt × effSpd` ; un coup à chaque 1. `effSpd` = `spd` × (1 − ralentissement adverse, max 50 %) × fureur de l'Empereur ×1,45 × Fureur aveugle ×1,6 × Adrénaline.

**Résolution d'un coup (`strikeInner`)** :
1. Esquive : `Pas de danse` (garantie) ou `rnd < min(0,6, dodge)` (0 pendant Fureur aveugle). Une esquive peut déclencher une **riposte** (pas de riposte en chaîne, `st.inRiposte`).
2. Dégâts de base `atk × 0,9–1,1` (ivre : `0,5–1,7`) × multiplicateur × `nextMult`, + bonus Furie de Mars (max +20).
3. Berserk (selon PV manquants) → critique (`crit`, +15 % sous Pouce levé ; `critImmune` l'annule) × `critMult` → Exécution ×2 sous 25 % PV.
4. Multiplicateurs : `(1+dmgMul) × (1+vuln cible)` × buffs de spécial (×1,25 / ×1,3 / ×1,3) × rancune (+12 % par tranche de 10 % de PV max encaissés).
5. Défense : `max(1, d − def × (1 − pen)) × (1 − dr)`, puis blocage (½) éventuel.
6. `hurt()` : Bouclier levé réduit à 30 %, arrondi, `Dernier rempart` (1×/combat, remonte à 30 %).
7. Après coup : vol de vie, jauge (+12 attaquant, +8 cible), saignement (`bst`), poison (`pst`, plafonné à 6× la valeur, ignoré si `antidote`), épines.

**Par tick (`step`)** : régénération, poison et saignement (tick par seconde), décompte des buffs (`rageT, stunT, medT, stoneT, cheerT, beerT`), jauge +3/s. Pilum lancé en ouverture (0,25 s joueur / 0,45 s adversaire). Spécial lancé dès que la jauge atteint 100. Après **45 s**, « on lâche les lions » : 3 % des PV max par seconde aux deux combattants. L'Empereur passe en fureur sous 50 % PV.

**Entre les combats** (`postWin`) : soin de `postHeal` (30 % de base) des PV max ; bonus de boss de MaximusRr (Gloire) et Chelmacus (Impassible).

### Adversaires (`makeEnemy`)

- Échelle de difficulté `scaleOf(n)` (quadratique, adoucie sur les 12 premiers combats, renforcée en fin de run), réglée par `TUNE`.
- **Combat normal** : gladiateur aléatoire de `ENEMY_NAMES` avec son look `ENEMY_LOOK`, ou (combats 4–5 de l'acte, 30 %) une **bête** de `BEASTS` selon l'acte (plus rapide, moins forte). Augments aléatoires selon l'acte, jamais légendaires ni `foule`.
- **Élite** : 5e combat de chaque acte, +1 augment, ×`eliteK` PV et attaque.
- **Boss** : le pote `BOSSES[acte]` (ordre mélangé dans `startRun`), stats lissées vers la moyenne, `acte + 1` augments (légendaires possibles), garde son passif et son spécial. Au 7e acte : `emperor` (×1,3 PV, +2 déf, +2 régén, fureur, couronne/écharpe/cape).

## Augments

Tableau `AUGS` : `{id, t:'arme'|'armure'|'aptitude', r:'C'|'R'|'L', n, d, a:p=>{…}, u?:1}`.
- `a` modifie directement le combattant ; toute stat qui augmente `maxHp` doit aussi augmenter `hp`.
- `u:1` = unique (ne peut plus être proposé une fois pris). Les légendaires sont tous uniques.
- `rollChoices` : un choix par type (arme, armure, aptitude) + types aléatoires si `choices > 3`. Rareté tirée par `rarityWeights(n)` : C 70→22, R 27→51, L 3→30 au fil des actes ; après un boss 60 % R / 40 % L, jamais de commun. Si la rareté tirée est vide pour ce type, repli L→R→C ou C→R.
- Plafonds à respecter : esquive effective 60 %, ralentissement 50 %, `pen` 1, `block` 0,6, `riposte` 1.

## Les 8 gladiateurs (`CHARS` + `SPECIALS`)

| id | Nom | Titre | PV / Atk / Déf / Vit | Passif | Spécial |
|---|---|---|---|---|---|
| `darkkus` | DarkKus | Le Berserker | 125 / 13 / 2 / 1,1 | Berserk +60 % selon PV manquants, 8 % vol de vie | **Fureur aveugle** : 6 s, +60 % vitesse, +30 % dégâts, +25 % vol de vie, plus d'esquive |
| `fredhus` | Fredhus | Le Roc rancunier | 150 / 9 / 3 / 0,8 | Rancune (`grudge`) : +12 % par 10 % de PV perdus dans le combat | **Vengeance** : rend 40 % des dégâts encaissés (max 30 % PV max adverses) |
| `sweevus` | Sweevus | Le Cogneur | 115 / 15 / 0 / 0,9 | +30 % dégâts infligés, +10 % subis | **Coup de massue** : ×2,5 et assomme 1,5 s |
| `chelmacus` | Chelmacus | La Force tranquille | 135 / 12 / 2 / 1 | Immunisé aux critiques, 2,5 PV/s, +2 déf par boss vaincu | **Le calme avant la tempête** : 1,5 s sans frapper, +30 % PV, coup suivant ×4 |
| `dridricus` | Dridricus | Le Fêtard | 115 / 10 / 1 / 1 | Ivresse : dégâts 50–170 %, 10 % esquive | **Cul sec !** : +25 % PV, +30 % dégâts 6 s, chope lancée ×1,5 |
| `kubenicus` | Kubenicus | Le Mur | 150 / 8 / 4 / 0,8 | −12 % dégâts subis, renvoie 3 | **Bouclier levé** : 3 s à −70 % de dégâts, +10 % PV |
| `maximusrr` | MaximusRr | Le Champion | 120 / 11 / 2 / 1 | 4 choix d'augments ; +2 atk, +12 PV max par boss vaincu | **Pouce levé** : 6 s, +25 % dégâts, +15 % critique |
| `beelgraalus` | Beel'Graalus | L'Insaisissable | 90 / 9 / 1 / 1,3 | 15 % esquive, chaque esquive charge la jauge (+10) | **Pas de danse** : esquive les 2 coups suivants et riposte |

`look` de chaque perso : `sprite` (= id), plus des champs du rendu vectoriel de secours (`skin, hair, hairStyle, beard, tunic, build`) et l'arme de départ affichée (`weapon`). `chope:1` (Dridricus) affiche une chope dans la main gauche quand il n'a pas de bouclier.

## Sprites en marionnette

Tous les sprites humains font **204×490 px**, personnage de face, pieds en bas. Au chargement, `loadSprites` crée pour chacun une version blanche (flash de coup) et `buildParts` découpe 6 calques :

- `head`, `armB` (bras arrière, côté bouclier), `armF` (bras avant, côté arme), `legB`, `legF` : polygones de `rig.poly`, **en pixels de l'image** (origine coin haut-gauche).
- `torso` : l'image moins tous ces polygones ; le trou laissé derrière le bras arrière est bouché avec la couleur de tunique lue au pixel `rig.probe`, sur la zone `rig.fill`.
- `skin` / `skinDark` : teinte de peau moyenne mesurée dans le rectangle `rig.skin` (sert au poing).

Deux découpes :
- **`RIG_PERSO`** (les 8 potes, proportions réalistes comme les adversaires) : tête 0–122, bras 122–315, jambes 338–490 (sous l'ourlet de la tunique, pour qu'elle ne se coupe pas quand les jambes bougent).
- **`RIG_ENEMY`** (adversaires) : tête 0–124, bras 124–312, jambes 300–490 (pagne court).
- `PART_POLY` / `PIV` sont l'ancienne découpe « grosse tête », gardée seulement comme valeur par défaut de `buildParts`.

**Repère relatif** : tout ce qui n'est pas `poly` (pivots `piv`, `hand`, `WEAR`, `WEAPON_IMG`, `GEAR_BOX`) est en unités du sprite avec **l'origine entre les pieds** : `x_rel = x_img − 100`, `y_rel = y_img − 488` (`SPR_AX`, `SPR_AY`), y négatif vers le haut. Mise à l'échelle à l'écran : `k = scale × 1,12 × 100 / 478`.

**Ordre de dessin** (`drawSpriteGlad`, flip horizontal par `dir`) : ombre → aura → équipement arrière (cape impériale) → peau de lion (dos) → arme d'hast (trident/lance/pilum, derrière le corps) → jambes (+ jambières découpées par jambe) → torse (+ plastron ou tunique de cuir, crâne, écharpe) → tête (laurier-dos, tête, casque ou capuche de lion, laurier) → bras arrière (+ manica, galerus, filet, bouclier ou chope) → traînée d'arme → bras avant (+ arme, puis poing pixelisé incliné à 45° dans l'axe de l'arme).

Chaque membre tourne autour de son pivot selon la pose (`poseIdle`, `poseOf` : attaque en 3 phases armer/frapper/revenir, esquive, coup reçu, mort, victoire). Champs d'une pose : `x, y, rot, sx, sy, head, armF, armB, legF, legB, wpn, trail`.

Les **adversaires dessinés** portent déjà leur tenue : `drawSpriteGlad` leur retire casque, plastron, jambières, manica, galerus, lion, empereur et chope ; seuls l'arme, le bouclier et le filet sont ajoutés. Les **bêtes** ne sont pas découpées : `drawBeast` les dessine entières avec une hauteur `BEAST_H` et un léger souffle.

Si un sprite manque (pas chargé, ou look sans `sprite`), `drawGlad` bascule sur le bonhomme vectoriel ; c'est aussi le cas de `randomLook()` (secours pour un nom d'ennemi sans `ENEMY_LOOK`).

## Placement des objets

`computeLook(f)` traduit la liste d'augments en champs de look : arme (`WEAPON_OF`, la dernière prise gagne), bouclier (le meilleur selon `SHIELD_RANK` : bois < pointes < scutum < égide), `net, helmet, chest, cuir, galerus, greaves, manica, lion, aura` (Dernier rempart doré, Berserker rouge), `skull` (Exécution), `emperor`.

Deux tables décrivent les images de `assets/items/` (toutes listées dans `ITEM_FILES`) :

- **`WEAPON_IMG[type]`** — armes tenues en main. `len` = longueur de la diagonale de l'image en unités du sprite ; `t` = point de prise en fraction depuis le pommeau (l'image est supposée orientée pommeau en bas à gauche, pointe en haut à droite). Variante `{w, gx, gy}` (fouet) : largeur et point de prise en fractions de l'image. L'arme est dessinée à `rig.hand`, tournée de `pose.wpn`.
- **`WEAR[fichier]`** — pièces portées, en repère relatif. Ancrage par coin (`x, y`) ou par centre (`cx, cy`) ; une seule dimension (`w` **ou** `h`), l'autre suit le ratio de l'image ; `flip` optionnel. Le calque où l'objet est posé (torse, tête, bras arrière, jambes) détermine quel membre il suit.

Si l'image d'un objet manque, les fonctions `gearBack/Front/Head/Weapon` le dessinent en vectoriel puis `pixelize()` le convertit en pixel art (1 pixel = `PX` = 5 unités, contour sombre, relief haut/bas), mis en cache par `getGear` (la clé inclut le nombre d'images chargées pour invalider le cache après chargement).

Pour l'interface, `augArt(g)` montre l'image d'objet (`AUG_IMG[id]` ou `WEAPON_OF[id]`), sinon une icône pixel 12×12 (`AUG_ICON[id]`, défaut `burst`).

## Arènes

`ARENA_IMG[acte]` charge `assets/arenes/acte{1..7}.webp`, dessinée sur 600×330 avec un léger voile sombre. Tant qu'elle n'est pas chargée, `bakeArena` génère le décor pixel art de secours défini dans `ARENAS[acte]` (ciel, gradins, foule et torches animées). Les combattants sont posés à `POS.a = (185, 285)` et `POS.b = (415, 285)` ; les décors doivent garder un sol lisible à cette hauteur.

## Ajouter de nouveaux éléments

### Un augment
1. Ajouter l'entrée dans `AUGS` (id court unique, type, rareté, texte `d` exact et en français, `u:1` si légendaire ou non cumulable).
2. Nouvelle stat ? La déclarer avec sa valeur par défaut dans `baseFighter()`, l'implémenter dans `strikeInner` / `step` / `effSpd` / `postWin` (bloc logique), et la plafonner si besoin.
3. La montrer dans `statsHTML` (liste `extra` si elle est souvent à 0).
4. Visuel : arme → `WEAPON_OF` (+ `WEAPON_IMG`) ; pièce portée → champ dans `computeLook`, `WEAR`, appel `wear()` sur le bon calque dans `drawSpriteGlad`, et ajout à la clé de `getGear` si un secours vectoriel existe. Image de carte → `AUG_IMG`, sinon icône dans `AUG_ICON` (nouvelle icône : grille 12×12 dans `ICON_DEF`, `o` = contour).
5. Vérifier que l'augment reste sensé chez les adversaires (sinon l'exclure comme `foule` dans `makeEnemy`).

### Une image d'objet
- PNG à fond transparent dans `assets/items/<nom>.png`, nom en minuscules avec tirets, et ajout dans `ITEM_FILES`.
- Arme : orientée pommeau en bas à gauche, pointe en haut à droite, puis régler `len` et `t` jusqu'à ce que le poing tombe sur la poignée.
- Pièce portée : régler `WEAR` en repère relatif (origine entre les pieds, y négatif vers le haut) et vérifier sur un perso **et** sur l'écran de sélection, en pose de repos et en attaque.

### Un gladiateur jouable
1. Sprite `assets/persos/<id>.png` **exactement 204×490**, mêmes proportions que les 8 autres pour que `RIG_PERSO` le découpe correctement (tête au-dessus de 122, bras libres du torse jusqu'à 315, tunique terminée avant 338, tunique au pixel `probe` (100, 190), peau visible dans la zone `skin`). Les 8 sprites actuels ont été générés avec le même prompt que les adversaires (pose de 3/4 vers la droite, mains vides, sans casque ni armure), puis détourés et ramenés à 478 px de haut, pieds à y = 488.
2. Entrée dans `CHARS` (`id` = nom du fichier, stats, `desc` qui décrit fidèlement le passif, `look.sprite = id`, arme de départ).
3. Entrée dans `SPECIALS` et `case` dans `doSpecial` ; tout nouveau buff temporisé doit être ajouté à `resetRuntime`, au décompte dans `step` et à `drawBuffAura`.
4. Il faut toujours au moins `NB_ACTS` (7) autres persos pour remplir les boss.
5. Mettre à jour le README et ce fichier.

### Un type d'adversaire
- Sprite `assets/ennemis/<fichier>.png` 204×490, proportions `RIG_ENEMY`, tenue déjà dessinée.
- Ajouter le nom à `ENEMY_NAMES` et `ENEMY_LOOK[nom] = {sprite:'e:<fichier>', weapon, shield?, net?}` (le préfixe `e:` sert de clé dans `SPR`, le chargement est automatique).
- Bête : image dans `assets/ennemis/`, nom dans `BEASTS`, hauteur dans `BEAST_H`, et correspondance dans `beastKey()`.

### Une arène / un acte
- `ACT_NAMES`, `ROMAN`, `ARENAS` (décor de secours) et `assets/arenes/acteN.webp` (format 600×330 ou multiple, ex. 1200×660) doivent rester de même longueur que `NB_ACTS`. Changer `NB_ACTS` ou `PER_ACT` impacte `TUNE`/`scaleOf`, `rarityWeights`, les textes « 7 actes » et `endRun`.

## Règles et conventions

- **Un seul fichier** `index.html`, JS vanilla, pas de framework, pas de build, pas de nouvelle dépendance externe.
- **Tout en français** : textes du jeu, commentaires, noms de fichiers d'assets, messages de commit (courts, descriptifs, sans préfixe, ex. « Nouveaux objets dessinés : Sica, Scissor… »).
- **Le bloc `LOGIC-START`/`LOGIC-END` reste sans DOM ni rendu** et utilise le `rnd` passé en paramètre plutôt que `Math.random` quand une fonction le reçoit : il est extrait tel quel par le simulateur d'équilibrage. Toute nouvelle constante d'équilibrage va dans `TUNE`.
- Après un changement d'équilibrage, un nouvel augment ou un nouveau perso, lancer `node tools/simulate.js` et comparer les taux de victoire par perso avant/après plutôt que juger au feeling.
- Toujours prévoir un repli quand une image n'est pas chargée (`hasImg`, `SPR[...]`, `ARENA_IMG.complete`) : le jeu doit rester jouable sans assets.
- Les dessins en pixel art désactivent le lissage (`imageSmoothingEnabled = false`), les images peintes l'activent en qualité haute : conserver ce basculement autour de chaque `drawImage`.
- Interface pensée mobile d'abord (`#app` max 640 px, grille 4 → 2 colonnes sous 520 px).
