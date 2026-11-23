# CLAUDE.md — Monkey Arena

Roguelite d'arène de gladiateurs en 2D, en français, combats automatiques. Le joueur choisit l'un des 8 « potes », les 7 autres deviennent les boss de la run (le dernier est couronné Empereur). 7 actes × (5 combats + 1 boss) = 42 combats. Après chaque victoire, le joueur choisit 1 récompense parmi 3 (4 pour MaximusRr) : un objet pour l'un des 7 emplacements d'équipement ou une aptitude (5 au plus), chacun montant jusqu'au niveau 3. L'équipement porté s'affiche sur le gladiateur.

Jeu en ligne : GitHub Pages (`https://kevinf29.github.io/monkey-arena/`), servi directement depuis `main`.

## Lancer le jeu

- Aucun build, aucune dépendance (seulement les polices Google Fonts Cinzel et Inter).
- **Passer par un serveur HTTP**, pas par `file://` : `buildParts()` lit des pixels avec `getImageData`, ce qui lève une erreur de canvas « tainted » en `file://`, et les sprites tombent alors sur le rendu vectoriel de secours.
  ```
  python -m http.server 8000   # puis http://localhost:8000
  ```
- Pas de tests automatisés. L'équilibrage (`TUNE`) se vérifie avec le simulateur ci-dessous.

## Simulateur d'équilibrage (`tools/simulate.js`)

Script Node sans dépendance. Il extrait le bloc `//LOGIC-START` … `//LOGIC-END` d'`index.html` (exécuté via `new Function`, avec un `Math.random` remplacé par un générateur seedé, donc résultats reproductibles), puis joue des runs complètes de 42 combats pour chaque perso, avec trois stratégies de choix de récompense :
- **hasard** : n'importe quelle carte (remplace souvent ses propres objets : borne basse) ;
- **plus rares** : la carte de plus haute rareté, même si elle remplace un objet monté de niveau ;
- **choix sensés** : emplacement vide ou montée de niveau d'abord, remplacement seulement par un objet plus rare d'un emplacement encore au niveau 1. C'est la **référence d'équilibrage** (joueur qui joue correctement).

Il affiche, par perso, le taux de victoire et la répartition des morts par acte (+ part des morts face à un boss).

```
node tools/simulate.js                  # 500 runs par perso et par stratégie (~1 min 40)
node tools/simulate.js --runs 2000 --seed 7
node tools/simulate.js --perso darkkus
node tools/simulate.js --runs 100 --tune '{"lin":0.03,"eHp":100}'   # essayer d'autres valeurs de TUNE sans modifier index.html
```

Repères actuels (graine 1, 500 runs) : hasard ≈ 7 %, plus rares ≈ 32 %, choix sensés ≈ 64 % (52 à 76 % selon le perso). Viser à garder les choix sensés autour de 55–65 %, aucun perso à plus de ~12 points de la moyenne, et des morts réparties entre combats normaux et boss.

Le simulateur n'utilise que ce qu'expose le bloc logique (`TUNE`, `makePlayer`, `makeEnemy`, `newFight`, `step`, `rollChoices`, `applyAug`, `postWin`, `ITEM`, `shuffle`…) : si l'une de ces fonctions est renommée ou change de signature, mettre à jour la liste `EXPORTS`, `playRun` et les stratégies du script.

## Structure du dépôt

```
index.html          tout le jeu : CSS, HTML des écrans, JS (≈1950 lignes)
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

1. **`<style>`** — thème romain : variables CSS sur `:root` (`--gold`, `--bronze`, `--parch`…), boutons bronze `.btn`, panneaux `.tablet` / parchemin `.desc`, cartes de récompense `.card.r-C|R|L` (+ badge `.offer.new|rep|up`), inventaire `.inv` / `.slot`, fiche d'objet `.sheet`, barres de vie segmentées, jauge de spécial `.gauge`.
2. **Écrans HTML** (`<section class="screen">`, un seul `.on` à la fois via `show(id)`) : `s-start` (choix du perso), `s-intro` (intro d'acte + boss), `s-fight` (inventaire `#inv` sous le combat), `s-reward`, `s-stats` (inventaire `#inv2`), `s-end`. Fenêtre `#sheet` (fiche d'objet) par-dessus.
3. **Bloc logique `//LOGIC-START` … `//LOGIC-END`** — données et règles de combat, sans DOM : `RAR`, `SLOTS`, `CHARS`, `SPECIALS`, `GEAR`, `APTS`, `SETS`, `AUGS` (= `GEAR` + `APTS`), `ITEM` (par id), `ACT_NAMES`, `ENEMY_NAMES`, `ENEMY_LOOK`, `BEASTS`, `baseFighter`, `snapBase`, `recalc`, `activeSets`, `makePlayer`, `TUNE`, `scaleOf`, `makeEnemy`, `strike`, `doSpecial`, `step`, `canGain`, `rollChoices`, `applyAug`, `postWin`.
4. **`/* APPARENCE */`** — `WEAPON_OF`, `SHIELD_OF`, `computeLook()` (équipement et aptitudes → look), puis le rendu vectoriel de secours `drawGlad` / `drawWeapon` / `drawHair`.
5. **`/* SPRITES DES POTES */`** — `SPR`, `loadSprites`, objets dessinés (`ITEM_FILES`, `WEAPON_IMG`, `WEAR`, `wear`, `drawWeaponImg`), équipement pixelisé (`pixelize`, `getGear`, `gearBack/Front/Head/Weapon`), découpe marionnette (`PART_POLY`, `PIV`, `RIG_PERSO`, `RIG_ENEMY`, `buildParts`), `drawSpriteGlad`, poing (`getFist`), poses (`poseIdle`, `poseOf`), bêtes (`drawBeast`).
6. **`/* UI */`** — état global (`selChar, P, N, ST, BOSSES, speed…`), `renderChars`, `startRun`, `showIntro`, `prepareFight`, barres, icônes pixel 12×12 (`ICON_DEF`, `ic`, `icImg`, `augArt`), inventaire (`renderInv`, `slotHTML`), fiches (`itemSheet`, `setSheet`, `openSheet`), récompenses (`offerOf`, `showReward`).
7. **`/* arène */`** — canevas `#cv` 1200×660 dessiné en coordonnées logiques **600×330** (`RES = 2`), `POS` des combattants, `ARENAS` (décor pixel art de secours, 200×110 agrandi ×3), `ARENA_IMG` (décors peints prioritaires), `drawArena`, effets (`burst`, particules, nombres flottants, secousse, gel), mise en scène de victoire (`drawVictoryRay`, `spawnPetal`, `drawVictoryOverlay`), boucle `loop`.
8. Flux de run : `startFight` → `endFight` → `showReward` → (`prepareFight` | `showIntro`), `endRun`, `statsHTML`, branchement des boutons.

## Système de combat

Moteur à pas fixe : `loop` découpe le temps réel en pas de 0,02 s et appelle `step(ST, dt, rnd)`. La logique ne dessine rien : elle pousse des **événements** dans `ST.events` (`swing`, `hit`, `crit`, `miss`, `thorns`, `poison`, `bleed`, `special`, `none`) que l'UI consomme. Les événements d'un coup (`strike = 1`) sont retardés de `IMPACT` (= `ATK_T × A_HIT`, l'instant où la frappe arrive au bout) dans `PEND`, pour que dégâts, flash et barre de vie (`shownHp`) tombent au moment de l'impact.

Combattant = objet créé par `baseFighter()` (toutes les stats à zéro/défaut) puis surchargé. Ses stats « nues » (perso + gains permanents de Gloire/Impassible, ou stats d'adversaire) sont figées dans `f.base` par `snapBase()`. **`recalc(f)` reconstruit toutes les stats** à partir de `f.base` + équipement (`f.gear`) + aptitudes (`f.apts`) + panoplies, en conservant les PV perdus. Hors combat, ne jamais modifier une stat directement : modifier `f.base` puis appeler `recalc`. Champs runtime remis à zéro par `resetRuntime()` à chaque combat.

**Cadence** : `cd` diminue de `dt × effSpd` ; un coup à chaque 1. `effSpd` = `spd` × (1 − ralentissement adverse, max 50 %) × fureur de l'Empereur ×1,45 × Fureur aveugle ×1,6 × Adrénaline.

**Résolution d'un coup (`strikeInner`)** :
1. Esquive : `Pas de danse` (garantie) ou `rnd < min(0,6, dodge)` (0 pendant Fureur aveugle). Une esquive peut déclencher une **riposte** (pas de riposte en chaîne, `st.inRiposte`).
2. Dégâts de base `atk × 0,9–1,1` (ivre : `0,5–1,7`) × multiplicateur × `nextMult`, + bonus Furie de Mars (max +20).
3. Berserk (selon PV manquants) → critique (`crit`, +15 % sous Pouce levé ; `critImmune` l'annule) × `critMult` → Ouverture (`opener`, bonus si la cible est au-dessus de 70 % PV) → Exécution ×2 sous le seuil `execute`.
4. Multiplicateurs : `(1+dmgMul) × (1+vuln cible)` × buffs de spécial (×1,25 / ×1,3 / ×1,3) × rancune (+12 % par tranche de 10 % de PV max encaissés).
5. Défense : `max(1, d − def × (1 − pen)) × (1 − dr)`, puis blocage éventuel (réduit de `blockPow` : ½ de base, ¾ avec le Scutum niveau 3).
6. `hurt()` : Bouclier levé réduit à 30 %, arrondi, `Dernier rempart` (1×/combat, remonte à `undying` × PV max).
7. Après coup : vol de vie, jauge (+12 attaquant, +8 cible), saignement (`bst`), poison (`pst`, plafonné à 6× la valeur, ignoré si `antidote`), filet (`entangle` : chance d'immobiliser 0,8 s, sauf `stunImmune`), épines.

**Par tick (`step`)** : régénération, poison et saignement (tick par seconde), décompte des buffs (`rageT, stunT, medT, stoneT, cheerT, beerT`), jauge +3/s. Pilum lancé en ouverture (0,25 s joueur / 0,45 s adversaire, ×(2 + 2 × niveau), étourdit 1 s au niveau 3). `quick` : premier coup immédiat. Spécial lancé dès que la jauge atteint 100. Après **45 s**, « on lâche les lions » : 3 % des PV max par seconde aux deux combattants. L'Empereur passe en fureur sous 50 % PV.

**Entre les combats** (`postWin`) : bonus de boss de MaximusRr (Gloire) et Chelmacus (Impassible) ajoutés à `f.base`, `recalc`, puis soin de `postHeal` (30 % de base) des PV max.

### Adversaires (`makeEnemy`)

- Échelle de difficulté `scaleOf(n)` = `1 + lin·k + quad·k²` (k = n − 1), adoucie sur les 12 premiers combats et renforcée en fin de run, réglée par `TUNE`. La puissance du joueur est plafonnée (7 objets + 5 aptitudes, niveau 3 max) : la courbe est donc quasi linéaire (`lin` 0,029, `quad` 0). Ne pas revenir à l'ancienne courbe quadratique, calée pour des objets qui s'empilaient sans limite.
- **Combat normal** : gladiateur aléatoire de `ENEMY_NAMES` avec son look `ENEMY_LOOK`, ou (combats 4–5 de l'acte, 30 %) une **bête** de `BEASTS` selon l'acte (plus rapide, moins forte). Objets/aptitudes aléatoires selon l'acte (`eAug`), jamais légendaires ni `foule`, via `canGain` + `applyAug` comme le joueur.
- **Élite** : 5e combat de chaque acte, +1 objet/aptitude, ×`eliteK` PV et attaque.
- **Boss** : le pote `BOSSES[acte]` (ordre mélangé dans `startRun`), stats lissées vers la moyenne, `acte + 1` objets/aptitudes (légendaires et montées de niveau possibles), garde son passif et son spécial. Au 7e acte : `emperor` (×1,3 PV, +2 déf, +2 régén, fureur, couronne/écharpe/cape).

## Équipement, aptitudes et panoplies

Deux familles, toutes deux de rareté `C` / `R` / `L` et de **niveau 1 à 3** (`MAX_LVL`) :

**Équipement (`GEAR`)** : `{id, slot, r, n, f?|ic?+ico?, d:L=>texte, b, a:(p,L)=>{…}}`.
- 7 emplacements (`SLOTS`) : `tete`, `corps`, `bras`, `jambes`, `arme`, `main` (main gauche), `acc` (accessoire). Un objet par emplacement, stocké dans `p.gear[slot] = {id, lvl}`.
- Prendre un objet **différent** dans un emplacement occupé le **remplace** (retour au niveau 1). Reprendre le **même** objet le fait **monter de niveau** (+1, max 3).
- `a(p, L)` applique l'effet au niveau `L` **et** le bonus de niveau 3 (`if(L>=3) …`) ; `d(L)` donne le texte au niveau `L` (doit refléter exactement `a`) ; `b` décrit le bonus de niveau 3.
- `f` = image dans `assets/items/`, sinon `ic` = icône pixel de `ICON_DEF` (+ `ico` pour recolorer la palette).
- Identité des armes : Gladius (équilibré, 1er coup critique), Glaive (ouverture), Trident (esquive, riposte), Hache (coups lourds, perce-armure), Dague (poison), Fouet (vitesse + ralentit), Cestes (double coup), Sica (saignement), Scissor (perce-armure, vol de vie), Pilum (lancer d'ouverture), Lance de l'Hydre (double coup, L), Épée du Champion (puissance pure, L). Garder une identité distincte pour toute nouvelle arme.

**Aptitudes (`APTS`)** : `{id, r, n, ic, ico?, d:L=>texte, a:(p,L)=>{…}}`, sans bonus de niveau 3. 5 au plus (`MAX_APTS`) dans `p.apts = [{id, lvl}]`. Une fois les 5 places prises, seules les montées de niveau sont proposées.

**Panoplies (`SETS`)** : `{id, n, items:[3 ids], d, a:p=>{…}}`, bonus actif quand les 3 pièces sont portées (`activeSets`). Actuelles : Mirmillon (casque + scutum + gladius), Rétiaire (trident + filet + galerus), Thrace (sica + manica + jambières). Les pièces d'une panoplie doivent être dans 3 emplacements différents.

**Tirage (`rollChoices`)** : une carte par famille (arme, autre équipement, aptitude) + familles aléatoires si `choices > 3`. Rareté tirée par `rarityWeights(n)` : C 70→22, R 27→51, L 3→30 au fil des actes ; après un boss 60 % R / 40 % L. Seules les cartes `canGain` sont proposées (pas d'objet déjà niveau 3, pas de nouvelle aptitude si 5 places prises). Si la rareté tirée est vide, repli sur les autres raretés puis sur n'importe quelle famille.

**Écran de récompense** : `offerOf(p, g)` donne le badge « Nouveau », « Remplace X (niv. N) » (avec « défait la Panoplie du … » si besoin) ou « Niveau +1 (a → b) », et le texte affiché est celui du niveau qui sera atteint.

Plafonds appliqués dans `recalc` : `pen` 1, `block` 0,6, `riposte` 1 ; et en combat : esquive effective 60 %, ralentissement 50 %.

## Les 8 gladiateurs (`CHARS` + `SPECIALS`)

| id | Nom | Titre | PV / Atk / Déf / Vit | Passif | Spécial |
|---|---|---|---|---|---|
| `darkkus` | DarkKus | Le Berserker | 125 / 12 / 2 / 1,1 | Berserk +60 % selon PV manquants, 6 % vol de vie | **Fureur aveugle** : 6 s, +60 % vitesse, +30 % dégâts, +25 % vol de vie, plus d'esquive |
| `fredhus` | Fredhus | Le Roc rancunier | 150 / 10 / 3 / 0,8 | Rancune (`grudge`) : +12 % par 10 % de PV perdus dans le combat | **Vengeance** : rend 40 % des dégâts encaissés (max 30 % PV max adverses) |
| `sweevus` | Sweevus | Le Cogneur | 125 / 16 / 0 / 0,9 | +30 % dégâts infligés, +10 % subis | **Coup de massue** : ×2,5 et assomme 1,5 s |
| `chelmacus` | Chelmacus | La Force tranquille | 135 / 11 / 2 / 1 | Immunisé aux critiques, 1,5 PV/s, +1 déf par boss vaincu | **Le calme avant la tempête** : 1,5 s sans frapper, +30 % PV, coup suivant ×4 |
| `dridricus` | Dridricus | Le Fêtard | 115 / 10 / 1 / 1 | Ivresse : dégâts 50–170 %, 10 % esquive | **Cul sec !** : +25 % PV, +30 % dégâts 6 s, chope lancée ×1,5 |
| `kubenicus` | Kubenicus | Le Mur | 150 / 10 / 4 / 0,8 | −12 % dégâts subis, renvoie 4 | **Bouclier levé** : 3 s à −70 % de dégâts, +10 % PV |
| `maximusrr` | MaximusRr | Le Champion | 120 / 11 / 2 / 1 | 4 choix de récompense ; +1 atk, +10 PV max par boss vaincu | **Pouce levé** : 6 s, +25 % dégâts, +15 % critique |
| `beelgraalus` | Beel'Graalus | L'Insaisissable | 105 / 11 / 1 / 1,3 | 18 % esquive, chaque esquive charge la jauge (+10) | **Pas de danse** : esquive les 2 coups suivants et riposte |

`look` de chaque perso : `sprite` (= id), plus des champs du rendu vectoriel de secours (`skin, hair, hairStyle, beard, tunic, build`) et l'arme de départ affichée (`weapon`). `chope:1` (Dridricus) affiche une chope dans la main gauche quand il n'a pas de bouclier.

## Sprites en marionnette

Tous les sprites humains font **204×490 px**, personnage de face, pieds en bas. Au chargement, `loadSprites` crée pour chacun une version blanche (flash de coup) et `buildParts` découpe 6 calques :

- `head`, `armB` (bras arrière, côté bouclier), `armF` (bras avant, côté arme), `legB`, `legF` : polygones de `rig.poly`, **en pixels de l'image** (origine coin haut-gauche).
- `torso` : l'image moins tous ces polygones ; le trou laissé derrière le bras arrière est bouché avec la couleur de tunique lue au pixel `rig.probe`, sur la zone `rig.fill`.
- `skin` / `skinDark` : teinte de peau moyenne mesurée dans le rectangle `rig.skin` (sert au poing).

Deux découpes :
- **`RIG_PERSO`** (les 8 potes, proportions réalistes comme les adversaires) : tête 0–122, bras 122–315, jambes 338–490 (sous l'ourlet de la tunique, pour qu'elle ne se coupe pas quand les jambes bougent).
- **Poings des potes** (`RIG_PERSO.fist`) : les 8 sprites ont les poings fermés et vides, avec un trou transparent. `FISTS[id]` donne le centre de chaque trou en pixels du sprite (`f` main de l'arme, `b` main du bouclier). L'arme est dessinée à `FISTS.f`, **avant** le bras avant, pour que le manche passe derrière les doigts ; pas de poing ajouté (`getFist` ne sert plus que de secours pour un sprite absent de `FISTS`). Les images d'armes étant à 45°, l'arme est redressée de `WOFF` (−0,62 rad) pour que le manche traverse le poing presque à la verticale, comme le poing dessiné. Les cestes sont posés par-dessus le poing. Boucliers, filet et chope sont décalés de `FISTS.b − FIST_B0` ; filet et chope sont dessinés avant le bras arrière. Les adversaires ont aussi des poings fermés (`RIG_ENEMY.fist`, entrées `'e:<fichier>'` dans `FISTS`). Nouveau sprite → mesurer ses deux trous et compléter `FISTS`.
- **`RIG_ENEMY`** (adversaires) : tête 0–124, bras 124–312, jambes 300–490 (pagne court).
- `PART_POLY` / `PIV` sont l'ancienne découpe « grosse tête », gardée seulement comme valeur par défaut de `buildParts`.

**Repère relatif** : tout ce qui n'est pas `poly` (pivots `piv`, `hand`, `WEAR`, `WEAPON_IMG`, `GEAR_BOX`) est en unités du sprite avec **l'origine entre les pieds** : `x_rel = x_img − 100`, `y_rel = y_img − 488` (`SPR_AX`, `SPR_AY`), y négatif vers le haut. Mise à l'échelle à l'écran : `k = scale × 1,12 × 100 / 478`.

**Ordre de dessin** (`drawSpriteGlad`, flip horizontal par `dir`) : ombre → aura → équipement arrière (cape impériale) → peau de lion (dos) → arme d'hast (trident/lance/pilum, derrière le corps) → jambes (+ jambières découpées par jambe) → torse (+ plastron ou tunique de cuir, crâne, écharpe) → tête (laurier-dos, tête, casque ou capuche de lion, laurier) → bras arrière (+ manica, galerus, filet, bouclier ou chope) → traînée d'arme → bras avant (+ arme, puis poing pixelisé incliné à 45° dans l'axe de l'arme).

Chaque membre tourne autour de son pivot selon la pose (`poseIdle`, `poseOf`). Champs d'une pose : `x, y, rot, sx, sy, head, armF, armB, legF, legB, wpn, trail, trailA`.

**Animation** (durées en fraction de `ATK_T` = 0,46 s, repères `A_WIND`, `A_HOLD`, `A_HIT`, `A_OVER`) :
- **Attaque** : anticipation marquée (arme loin derrière, corps tassé et en recul) jusqu'à `A_WIND`, **temps d'arrêt** qui tremble jusqu'à `A_HOLD`, **frappe éclair** (`easeIn`, corps étiré) jusqu'à `A_HIT` = l'impact, **dépassement puis rebond amorti** avec compression jusqu'à `A_OVER`, retour au repos. Changer ces repères décale `IMPACT` automatiquement.
- **Smear** : pendant la frappe et le dépassement, `trail = [angle de départ, angle actuel]` du bras ; `drawSpriteGlad` remplit le secteur balayé par la vraie lame (main → pointe calculée depuis `WEAPON_IMG`) et ajoute des traits de vitesse ; `trailA` l'efface pendant le rebond.
- **Coup reçu** : compression immédiate (`sx` ↑, `sy` ↓), puis détente qui étire ; petit gel (`freeze`) sur chaque coup, plus long sur les critiques.
- **Mouvement secondaire** : `stepSecondary` fait suivre à `VIS[side].sec` un ressort qui traîne derrière la vitesse du corps (`x`, `rot`). `drawSpriteGlad` cisaille alors deux bandes de l'image : le bas de la tunique (`rig.skirt`, pivot à la ceinture) et le haut de la tête au-dessus de `rig.hairCut` (cheveux, crête de Sweevus, crête des casques d'adversaires) ; le casque porté utilise `wearFlex` (crête au-dessus de 42 % de sa hauteur). Un nouveau sprite doit avoir sa tunique et ses cheveux dans ces bandes.
- **Victoire du joueur** (`loop`, `endT` = 3,6 s) : ralenti pendant la chute du perdant, zoom centré et borné sur le gagnant (`zoom.center`), rayon de lumière avec poussière, pétales de roses lancés depuis le haut et les côtés (en coordonnées écran, au-dessus du zoom), titre « VICTOIRE ! » composé hors champ (`VIC_TXT`) avec reflet, pose de victoire bras levé. Un clic sur l'arène écourte la séquence. La défaite garde la séquence courte (1,9 s, zoom sur le perdant).
- Pour vérifier une pose sans attendre la boucle : régler `VIS.a.atk = ATK_T*(1-p)` puis `draw()`. Le serveur de test met en cache `index.html` : recharger avec `?v=N`.

Les **adversaires dessinés** portent déjà leur tenue : `drawSpriteGlad` leur retire casque, plastron, jambières, manica, galerus, lion, empereur et chope ; seuls l'arme, le bouclier et le filet sont ajoutés. Les **bêtes** ne sont pas découpées : `drawBeast` les dessine entières avec une hauteur `BEAST_H` et un léger souffle.

Si un sprite manque (pas chargé, ou look sans `sprite`), `drawGlad` bascule sur le bonhomme vectoriel ; c'est aussi le cas de `randomLook()` (secours pour un nom d'ennemi sans `ENEMY_LOOK`).

## Placement des objets

`computeLook(f)` traduit l'équipement en champs de look, emplacement par emplacement : arme (`WEAPON_OF`), main gauche (`SHIELD_OF` → `shield`, ou `net` pour le filet ; remplace le bouclier/filet de base des adversaires), tête (`helmet` / `lion`), corps (`chest` / `cuir`), bras (`manica` / `galerus`), jambes (`greaves`). Les aptitudes donnent `aura` (Dernier rempart doré, Berserker rouge) et `skull` (Exécution). Caligae et accessoires n'ont pas de visuel sur le corps.

Deux tables décrivent les images de `assets/items/` (toutes listées dans `ITEM_FILES`) :

- **`WEAPON_IMG[type]`** — armes tenues en main. `len` = longueur de la diagonale de l'image en unités du sprite ; `t` = point de prise en fraction depuis le pommeau (l'image est supposée orientée pommeau en bas à gauche, pointe en haut à droite). Variante `{w, gx, gy}` (fouet) : largeur et point de prise en fractions de l'image. L'arme est dessinée à `rig.hand`, tournée de `pose.wpn`.
- **`WEAR[fichier]`** — pièces portées, en repère relatif. Ancrage par coin (`x, y`) ou par centre (`cx, cy`) ; une seule dimension (`w` **ou** `h`), l'autre suit le ratio de l'image ; `flip` optionnel. Le calque où l'objet est posé (torse, tête, bras arrière, jambes) détermine quel membre il suit.

Si l'image d'un objet manque, les fonctions `gearBack/Front/Head/Weapon` le dessinent en vectoriel puis `pixelize()` le convertit en pixel art (1 pixel = `PX` = 5 unités, contour sombre, relief haut/bas), mis en cache par `getGear` (la clé inclut le nombre d'images chargées pour invalider le cache après chargement).

Pour l'interface, `augArt(g)` montre l'image `g.f`, sinon l'icône pixel `g.ic` (palette recolorée par `g.ico`), défaut `burst`.

## Inventaire (sous le combat et dans l'écran Stats)

`renderInv(el, p)` dessine la silhouette du gladiateur (`paintFig`, avec son équipement) entre deux colonnes d'emplacements : à gauche Tête, Corps, Bras, Jambes (`INV_LEFT`), à droite Accessoire, Arme, Main gauche (`INV_RIGHT`). Chaque case montre l'objet et une pastille de niveau (bronze 1, argent 2, or 3), ou une case vide en pointillés. Sous la silhouette, les panoplies entamées (`Mirmillon 2/3`), dorées une fois complètes. Dessous, la rangée des 5 aptitudes. Un appui ouvre la fiche (`itemSheet` : niveau, effet actuel, niveau suivant, bonus de niveau 3, panoplie ; `setSheet` pour une panoplie).

## Arènes

`ARENA_IMG[acte]` charge `assets/arenes/acte{1..7}.webp`, dessinée sur 600×330 avec un léger voile sombre. Tant qu'elle n'est pas chargée, `bakeArena` génère le décor pixel art de secours défini dans `ARENAS[acte]` (ciel, gradins, foule et torches animées). Les combattants sont posés à `POS.a = (185, 285)` et `POS.b = (415, 285)` ; les décors doivent garder un sol lisible à cette hauteur.

## Son (`SFX`)

Tout est synthétisé avec la Web Audio API dans le module `SFX` (section UI, juste avant `/* --- arène --- */`) : **aucun fichier son**, n'en pas ajouter. Le contexte audio est créé au premier clic ou appui de touche (règle d'autoplay des navigateurs). Chaîne : sons → `master` (volume `VOL` = 0,3) → compresseur → sortie. Joueur à gauche, adversaire à droite (`StereoPanner`).

- `hit(side, big)` : claquement de bruit aigu + partiels inharmoniques (métal) + petit choc grave ; `crit(side)` : métal plus grave et plus long, gros choc, grondement, puis `cheer` ; `whoosh(side)` : souffle filtré balayé (esquive).
- Foule : `ambience(niveau)`, bruit brun filtré en boucle avec ondulation lente, piloté chaque image par `crowd` dans `loop` et coupé hors de l'écran de combat (`show`) ; `cheer(force)` : « aaah » collectif (formants) et sifflets, sur les critiques et le coup final (`finalBlow`).
- Musique : `fanfare()` (cuivres + timbales) quand l'Empereur entre (`prepareFight`), `victory()` quand « VICTOIRE ! » apparaît, `defeat()` au début de la séquence de défaite.
- `throttle` limite chaque son (vitesse ×4, double coup) pour éviter la bouillie et la saturation. Pics mesurés en sortie : critique ≈ 0,42, fanfare ≈ 0,35, coup ≈ 0,2, foule ≈ 0,06. Garder tout nouveau son sous ~0,5.
- Bouton `.sndToggle` (écran de départ et barre du combat) : `SFX.toggle()` puis `renderSoundBtns()` ; l'état est mémorisé dans `localStorage` (`monkeyArena.son`, lecture et écriture protégées par `try/catch`).

## Ajouter de nouveaux éléments

### Un objet d'équipement
1. Ajouter l'entrée dans `GEAR` (id court unique, `slot`, rareté, `d(L)` exact en français pour L = 1, 2, 3, bonus `b` de niveau 3 codé dans `a` avec `if(L>=3)`). Donner une identité de combat distincte (surtout pour une arme).
2. Nouvelle stat ? La déclarer avec sa valeur par défaut dans `baseFighter()` (elle entre alors dans `STAT_KEYS` et est remise à zéro par `recalc`), l'implémenter dans `strikeInner` / `step` / `effSpd` / `newFight` (bloc logique), la plafonner dans `recalc` si besoin, et la montrer dans `statsHTML` (liste `extra`).
3. Visuel : arme → `WEAPON_OF` (+ `WEAPON_IMG`) ; pièce portée → champ dans `computeLook` pour son emplacement, `WEAR`, appel `wear()` sur le bon calque dans `drawSpriteGlad`, et ajout à la clé de `getGear` si un secours vectoriel existe. Image → `f`, sinon icône `ic` (nouvelle icône : grille 12×12 dans `ICON_DEF`, `o` = contour).
4. Panoplie éventuelle : l'ajouter à `SETS` (3 pièces dans 3 emplacements différents).
5. Vérifier qu'il reste sensé chez les adversaires (sinon l'exclure comme `foule` dans `makeEnemy`), puis passer le simulateur.

### Une aptitude
- Entrée dans `APTS` avec `d(L)` / `a(p, L)` qui montent du niveau 1 au niveau 3, et une icône `ic`. Mêmes règles de nouvelle stat que ci-dessus.

### Une image d'objet
- PNG à fond transparent dans `assets/items/<nom>.png`, nom en minuscules avec tirets, et ajout dans `ITEM_FILES`.
- Arme : orientée pommeau en bas à gauche, pointe en haut à droite, puis régler `len` et `t` jusqu'à ce que le poing tombe sur la poignée.
- Pièce portée : régler `WEAR` en repère relatif (origine entre les pieds, y négatif vers le haut) et vérifier sur un perso **et** sur l'écran de sélection, en pose de repos et en attaque.

### Un gladiateur jouable
1. Sprite `assets/persos/<id>.png` **exactement 204×490**, mêmes proportions que les 8 autres pour que `RIG_PERSO` le découpe correctement (tête au-dessus de 122, bras libres du torse jusqu'à 315, tunique terminée avant 338, tunique au pixel `probe` (100, 190), peau visible dans la zone `skin`). Les 8 sprites actuels ont été générés avec le même prompt que les adversaires (pose de 3/4 vers la droite, poings fermés vides « as if gripping an invisible vertical pole, with a clear empty hole through each fist », sans casque ni armure), puis détourés et ramenés à 478 px de haut, pieds à y = 488.
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
- Après un changement d'équilibrage, un nouvel objet, une nouvelle aptitude ou un nouveau perso, lancer `node tools/simulate.js` et comparer les taux de victoire par perso (stratégie « choix sensés ») avant/après plutôt que juger au feeling.
- **Remplacer une image sous le même nom** (sprite, objet, décor) : augmenter `ASSET_V` (ex. `'?v=3'` → `'?v=4'`), sinon les navigateurs des joueurs gardent l'ancienne en cache et la découpe ne correspond plus. Toute nouvelle URL d'asset doit finir par `+ ASSET_V`.
- Toujours prévoir un repli quand une image n'est pas chargée (`hasImg`, `SPR[...]`, `ARENA_IMG.complete`) : le jeu doit rester jouable sans assets.
- Les dessins en pixel art désactivent le lissage (`imageSmoothingEnabled = false`), les images peintes l'activent en qualité haute : conserver ce basculement autour de chaque `drawImage`.
- Interface pensée mobile d'abord (`#app` max 640 px, grille 4 → 2 colonnes sous 520 px).
