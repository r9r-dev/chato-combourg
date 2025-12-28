# Approches d'extraction des cartes

## Contexte

L'objectif est d'extraire 9 cartes individuelles depuis une photo de grille 3x3 prise dans des conditions variables (fond texture, angle, eclairage).

### Problemes identifies
- Fonds textures (tapis raye, tissage) interferent avec la detection
- rembg laisse des residus sur certaines images
- Les cartes se touchent apres suppression du fond
- L'orientation EXIF n'est pas corrigee avant traitement

---

## Option A : Fix EXIF + Post-traitement

### Principe
1. Corriger l'orientation EXIF avant tout traitement
2. Appliquer rembg pour supprimer le fond
3. Post-traiter pour nettoyer les residus (seuillage, morphologie)
4. Diviser en grille 3x3

### Implementation
```python
# 1. Correction EXIF (deja implemente dans image_processor.py)
image = correct_orientation(image)

# 2. Suppression de fond
nobg = remove(image)

# 3. Post-traitement
# Convertir en masque binaire (alpha > seuil)
mask = np.array(nobg)[:,:,3] > 200
# Nettoyage morphologique
kernel = np.ones((5,5), np.uint8)
mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

# 4. Trouver bounding box et diviser
```

### Avantages
- Simple a implementer
- Utilise l'infrastructure existante
- Rapide

### Inconvenients
- Depend de la qualite de rembg
- Ne resout pas le probleme des fonds difficiles
- Precision estimee : ~70%

---

## Option B : Detection par couleur

### Principe
Les cartes ont une couleur dominante beige/creme distincte. On peut :
1. Convertir en espace HSV
2. Creer un masque pour la plage de couleur beige
3. Trouver les 9 plus grands contours
4. Extraire chaque carte

### Implementation
```python
# Convertir en HSV
hsv = cv2.cvtColor(image, cv2.COLOR_RGB2HSV)

# Plage de couleur beige/creme (a ajuster)
# H: 15-35 (jaune-orange), S: 20-80 (peu sature), V: 150-255 (clair)
lower = np.array([15, 20, 150])
upper = np.array([35, 80, 255])

# Creer masque
mask = cv2.inRange(hsv, lower, upper)

# Nettoyage
kernel = np.ones((5,5), np.uint8)
mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)

# Trouver contours
contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
cards = sorted(contours, key=cv2.contourArea, reverse=True)[:9]
```

### Avantages
- Independant du fond (detecte directement les cartes)
- Rapide
- Pas besoin de rembg

### Inconvenients
- Sensible aux variations d'eclairage
- Necessite calibration des seuils HSV
- Peut detecter d'autres objets beige
- Precision estimee : ~85%

---

## Option C : Template Matching

### Principe
Les cartes ont des elements distinctifs aux coins :
- Coin haut-gauche : piece/medaille avec chiffre
- Coin haut-droit : bouclier/blason colore
- Structure rectangulaire avec coins arrondis

On peut utiliser ces elements comme "ancres" pour localiser les cartes.

### Implementation
```python
# 1. Creer templates des coins (pieces, boucliers)
# Extraire depuis les cartes de reference

# 2. Multi-scale template matching
scales = [0.5, 0.75, 1.0, 1.25, 1.5]
for scale in scales:
    resized = cv2.resize(template, None, fx=scale, fy=scale)
    result = cv2.matchTemplate(image, resized, cv2.TM_CCOEFF_NORMED)
    locations = np.where(result >= threshold)

# 3. Clustering des detections
# Regrouper les detections proches pour trouver les 9 cartes

# 4. Calculer les bounding boxes
```

### Avantages
- Robuste aux variations de fond
- Utilise la structure specifique des cartes
- Peut gerer les rotations legeres

### Inconvenients
- Plus complexe a implementer
- Necessite de creer les templates
- Sensible a l'echelle et la rotation
- Precision estimee : ~90%

### Variante : Detection des coins arrondis
```python
# Detecter les coins arrondis caracteristiques des cartes
gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
corners = cv2.goodFeaturesToTrack(gray, maxCorners=100,
                                   qualityLevel=0.01, minDistance=50)
# Filtrer et regrouper pour trouver les cartes
```

---

## Option D : Fine-tuning d'un modele

### Principe
Entrainer un modele de segmentation d'instance (detecter et separer chaque carte) sur un petit dataset annote.

### Modeles possibles

#### D1. YOLOv8 Segmentation
```python
from ultralytics import YOLO

# Entrainer
model = YOLO('yolov8n-seg.pt')
model.train(data='cards.yaml', epochs=50)

# Inference
results = model(image)
masks = results[0].masks  # 9 masques de cartes
```

**Dataset necessaire** : 20-50 images annotees (polygones autour des cartes)
**Temps d'entrainement** : ~30 min sur GPU, ~2h sur CPU
**Precision estimee** : ~95%

#### D2. Segment Anything (SAM) avec prompts
```python
from segment_anything import SamPredictor

# Utiliser les detections de l'option B/C comme prompts
predictor = SamPredictor(sam_model)
predictor.set_image(image)

# Pour chaque detection approximative
for bbox in approximate_boxes:
    masks, scores, _ = predictor.predict(box=bbox)
    best_mask = masks[np.argmax(scores)]
```

**Avantage** : Pas besoin d'entrainement, utilise un modele pre-entraine
**Inconvenient** : Necessite des prompts (boites ou points)

#### D3. Fine-tuning CLIP pour classification
```python
# Pas pour la segmentation mais pour l'identification
# Entrainer CLIP sur les 92 cartes de reference
# avec augmentation de donnees (rotation, bruit, etc.)
```

### Avantages
- Precision maximale
- Robuste a toutes les conditions
- Une fois entraine, tres rapide en inference

### Inconvenients
- Necessite annotation de donnees
- Temps de developpement plus long
- Necessite GPU pour entrainement
- Precision estimee : ~95%

---

## Recommandation

### Approche incrementale suggeree

1. **Phase 1 (rapide)** : Tester B (detection couleur)
   - Implementation : 1h
   - Permet de valider l'approche sans ML complexe

2. **Phase 2 (si necessaire)** : Combiner A+B
   - EXIF correction + detection couleur
   - Fallback sur rembg si detection couleur echoue

3. **Phase 3 (precision maximale)** : Option D2 (SAM)
   - Utiliser les resultats de B comme prompts pour SAM
   - Pas d'entrainement necessaire

### Decision
Quelle approche veux-tu implementer en premier ?
