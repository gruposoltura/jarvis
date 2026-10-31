# office-v4-assets

Assets voor `office-v4.html` (BD-181).

- `models/hf_*.glb` - gegenereerd met Higgsfield (SAM 3D, Meshy-rigging) uit eigen productbeelden, 29-10-2026. Personages `hf_man` / `hf_woman` bevatten de animaties `sit`, `walk`, `idle`, `talk`.
- `models/*.glb` (overige) - Poly Haven (https://polyhaven.com), licentie CC0.
- `tex/*.webp` - Poly Haven-textures (CC0): oak_veneer_01, white_plaster_02, smooth_concrete_floor (normal map voor de vloer).
- `sky_1k.hdr` - Poly Haven HDRI kloofendal_48d_partly_cloudy_puresky (CC0).
- `man_shirt.png` / `woman_shirt.png` - maskers voor het inkleuren van het shirt in de afdelingskleur.

Alle modellen zijn verkleind met gltf-transform (weld, simplify, webp-textures, meshopt).
- Begroeiing (Poly Haven, CC0, 31-10-2026): `fern_02`, `flower_gazania`, `crystalline_iceplant`, `pachira_aquatica_01`, `periwinkle_plant` (sterk vereenvoudigd). `tex/frond.webp` (blad met alpha uit de jacaranda_tree-bladtextuur) en `tex/bark.webp` (jacaranda-stam) voor de procedurele bomen en struiken (bladkaarten).
