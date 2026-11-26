---
name: blender
description: >-
  Model accurate real-world 3D assets and bake Cycles lighting with headless
  Blender for the Three.js office scene. Use this skill when the task needs
  a physical object (hardware, furniture, peripherals, decor) to match its
  real product, when a .glb export is needed for the web scene, or when
  lightmaps / preview renders are needed. Use Blender headless
  (blender --background --python) — never the Blender GUI.
---

# Blender (headless) for the office scene

Blender is installed in this container (`blender --version` works). All
Blender work is headless: `blender --background --python <script.py>`.
Never open the Blender GUI — there is no display in the container.

## 0. Before modeling anything: research the real item

Look up the real product online first (dimensions, materials, colors,
ports, branding, layout) and write the verified numbers into the script
as constants. Never model from memory. Examples already verified for
this scene: NVIDIA DGX Spark 150 x 150 x 50.5 mm, gold-speckled metallic
chassis, rear 2x ConnectX-7 QSFP 200GbE + 1x 10GbE + 1x HDMI 2.1a + 4x
USB-C; MikroTik CRS804-4DDQ-hRM 218 x 387 x 44 mm, 1U half-width
dark-steel chassis, 4x 400G QSFP-DD cages, 2x 10GbE RJ45, console port,
dual hot-swap PSUs; RTX 5090 Founders Edition 304 x 137 x 40 mm.

## 1. Model with Python (`bpy`), in millimetres

- Work in metres in Blender but think in the real millimetres: set
  `bpy.context.scene.unit_settings.system = 'METRIC'` and
  `scale_length = 0.001`, then build from the researched dimensions.
- Build with primitives + bevels (a Bevel modifier with 2-3 segments is
  enough), boolean cutouts for ports/grip slots, and separate materials
  per part (chassis, faceplate, ports, branding). Keep the mesh clean:
  apply modifiers, merge vertices by distance, recalculate normals
  outward.
- Ports and labels that face the camera get real geometry (recessed
  boxes, not textures). Small text/branding goes on a texture (see 3).
- Save the working file as `.blend` under `assets/blender/` in the repo
  (source of truth), next to the exported file.

## 2. Export `.glb` for the Three.js scene

```sh
blender --background --python scripts/export_glb.py -- <in.blend> <out.glb>
```

The export script must: open the `.blend`, select only the asset's
collection, apply all transforms (`bpy.ops.object.transform_apply`),
and call `bpy.ops.export_scene.gltf(filepath=out, export_format='GLB',
export_apply=True, export_yup=True)`. Three.js loads it with
`GLTFLoader`; the scene's unit is metres, so export at real scale.

Verify the export before using it:

```sh
blender --background --python -c "import bpy; bpy.ops.import_scene.gltf(filepath='<out.glb>'); print('objects:', len(bpy.context.scene.objects))"
```

## 3. Cycles GI / AO lightmap baking (the photographic look)

Baking is what makes the scene look like the felixrieseberg.com
reference: real path-traced indirect bounce and soft ambient occlusion,
baked to lightweight JPGs that load fast in WebGL.

1. Build the room in a `.blend` with a Cycles setup: `World` with a
   sky / HDRI-ish gradient, area lights for the window and desk lamp,
   `bpy.context.scene.cycles.samples = 128` (256 for the final bake),
   `device = 'CPU'` (no GPU in the container).
2. Every static mesh gets a second UV map named `Lightmap`:
   `bpy.ops.object.mode_set(mode='EDIT')` then
   `bpy.ops.uv.smart_project()` on the `Lightmap` UV layer (island
   margin 0.02), then back to Object mode.
3. Create a blank image per bake target (`bpy.data.images.new`,
   1024x1024, float off), set it as the active image on a fresh
   material node, then
   `bpy.ops.object.bake(type='COMBINED', use_selected_to_active=False,
   margin=4)`. Save as JPG (`image.filepath`, `file_format='JPEG'`,
   quality 90) under `assets/lightmaps/`.
4. In Three.js, apply the JPG as `material.lightMap` with
   `lightMapIntensity = 1.0` on the matching mesh (same `Lightmap` UV
   channel). Keep the dynamic lights dim — the bake carries the bounce.
5. Bake time on CPU is minutes per map; bake once per static room
   state, not per edit. If a bake looks wrong, re-render a preview
   first (see 4) before re-baking.

## 4. Visual self-inspection: PNG preview renders

Before exporting or baking, render a preview and look at it:

```sh
blender --background --python scripts/render_preview.py -- <in.blend> <out.png>
```

The render script must: set `scene.render.engine = 'CYCLES'`,
`samples = 32` (preview), `resolution_x/y = 800`, point a camera at
the asset from the same angle as the real product photo, and save a
PNG. Compare the PNG side-by-side with the real product reference
and fix proportions, materials, and details before exporting.
Chromium is installed in this container for screenshots of the live
Three.js page (`chromium --headless --screenshot=...`); use it to
check the final scene in the browser, not just the Blender preview.

## 5. What goes where in the repo

- `assets/blender/*.blend` — working source files (commit these).
- `assets/models/*.glb` — exported assets the page loads (commit these).
- `assets/lightmaps/*.jpg` — baked lightmaps (commit these).
- `assets/blender/scripts/*.py` — the export / bake / preview scripts
  above (commit these; keep them generic, not one-asset hacks).

## Validation checklist (run before committing any asset)

- [ ] `blender --background --python` script exits 0 with no traceback.
- [ ] Exported `.glb` re-imports cleanly and has the right scale
      (measure the bounding box against the real dimensions).
- [ ] Preview PNG inspected against the real product photo.
- [ ] Lightmap JPG exists for every static mesh that uses one, and the
      Three.js material references the right file and UV channel.
- [ ] The live page still loads at 60 FPS (check with the Chromium
      headless screenshot + the browser console for WebGL errors).
