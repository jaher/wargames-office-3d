#!/usr/bin/env python3
"""Headless Blender optimizer: merges static same-material meshes and gently decimates
hyper-dense static sub-meshes before exporting lightweight, low-draw-call .glb files.

Does NOT modify source .blend files — reads each .blend and writes optimized .glb to assets/models/.
Strictly preserves every animated or material-targeted object name (fans, LEDs, lava blobs, glass, etc.).
"""
import os
import sys
import bpy

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BLEND_DIR = os.path.join(ROOT, "assets", "blender")
MODELS_DIR = os.path.join(ROOT, "assets", "models")

# Exact list of models actively used in officeScene.js (excludes unused legacy keychron_q1 / mx_master_3s)
TARGETS = [
    ("corsair_rtx5090", {"decimate_thresh": 320, "decimate_ratio": 0.24, "min_polys": 120, "merge": True}),
    ("aeron_chair",     {"decimate_thresh": 600, "decimate_ratio": 0.35, "min_polys": 160, "merge": True}),
    ("lava_lamp",       {"decimate_thresh": 600, "decimate_ratio": 0.38, "min_polys": 160, "merge": False}),
    ("fiddle_fig",      {"decimate_thresh": 500, "decimate_ratio": 0.45, "min_polys": 140, "merge": True}),
    ("snake_plant",     {"decimate_thresh": 500, "decimate_ratio": 0.45, "min_polys": 140, "merge": True}),
    ("crs804",          {"decimate_thresh": 2000, "decimate_ratio": 0.60, "min_polys": 160, "merge": True}),
    ("asus_gx10",       {"decimate_thresh": 2000, "decimate_ratio": 0.60, "min_polys": 160, "merge": True}),
    ("dgx_spark",       {"decimate_thresh": 2000, "decimate_ratio": 0.60, "min_polys": 160, "merge": True}),
    ("comma_rtx3090",   {"decimate_thresh": 2000, "decimate_ratio": 0.60, "min_polys": 160, "merge": True}),
    ("tripp_lite_isobar8", {"decimate_thresh": 2000, "decimate_ratio": 0.60, "min_polys": 160, "merge": True}),
    ("office_door",     {"decimate_thresh": 2000, "decimate_ratio": 0.60, "min_polys": 160, "merge": True}),
    ("meta_rayban_display", {"decimate_thresh": 2000, "decimate_ratio": 0.65, "min_polys": 180, "merge": True}),
    ("meta_neural_band", {"decimate_thresh": 1200, "decimate_ratio": 0.50, "min_polys": 180, "merge": True}),
    ("nest_thermostat", {"decimate_thresh": 2000, "decimate_ratio": 0.65, "min_polys": 180, "merge": False}),
    ("anglepoise_lamp", {"decimate_thresh": 2000, "decimate_ratio": 0.65, "min_polys": 160, "merge": True}),
    ("desk_books",      {"decimate_thresh": 2000, "decimate_ratio": 0.65, "min_polys": 120, "merge": True}),
    ("blue_angel_f18",  {"decimate_thresh": 2000, "decimate_ratio": 0.70, "min_polys": 140, "merge": True}),
]


def is_protected(obj):
    name = obj.name or ""
    if (
        name.endswith("_Blades")
        or name.startswith("RTX3090_Fan")
        or name.startswith("LavaBlob_")
        or name.startswith("RTX5090_AxialFan_")
    ):
        return True
    for slot in obj.material_slots:
        mn = (slot.material.name if slot.material else "") or ""
        if (
            mn.startswith("CRS_LED_")
            or mn.startswith("RGB_")
            or mn in (
                "GX10_PowerLED",
                "Corsair_TemperedGlass",
                "Corsair_AirflowGrille",
                "Corsair_TopAirflowGrille",
                "Corsair_RX120Blade",
                "Corsair_TitanDomeGlass",
                "RTX5090_VLEDMat",
                "RTX5090_SideLogoMat",
                "RTX5090_TopLogoMat",
                "Aeron_PellicleMesh",
                "LavaLamp_Glass",
                "LavaLamp_Liquid",
                "LavaLamp_BulbCore",
                "Nest_CoverGlass",
                "Nest_DisplayFace",
                "MetaRB_Lens",
                "MetaRB_DisplayLens",
                "RTX3090_GeForceLogo",
                "RTX3090_ModelBadge",
                "Comma_LinkLED",
                "Comma_ChestnutPCB",
            )
        ):
            return True
    return False


def optimize_one(stem, cfg):
    blend_path = os.path.join(BLEND_DIR, f"{stem}.blend")
    out_glb = os.path.join(MODELS_DIR, f"{stem}.glb")
    if not os.path.exists(blend_path):
        print(f"SKIP missing {blend_path}")
        return

    bpy.ops.wm.open_mainfile(filepath=blend_path)
    scene = bpy.context.scene
    bpy.ops.object.select_all(action="DESELECT")

    # Apply any pending modifiers on meshes first, then gently decimate overly dense static meshes
    dec_thresh = cfg["decimate_thresh"]
    dec_ratio = cfg["decimate_ratio"]
    min_polys = cfg.get("min_polys", 240)
    for obj in list(scene.objects):
        if obj.type != "MESH" or is_protected(obj):
            continue
        poly_count = len(obj.data.polygons)
        if poly_count >= dec_thresh:
            bpy.context.view_layer.objects.active = obj
            obj.select_set(True)
            mod = obj.modifiers.new("OptDecimate", "DECIMATE")
            mod.decimate_type = "COLLAPSE"
            mod.ratio = max(dec_ratio, min(0.85, float(min_polys) / poly_count))
            try:
                bpy.ops.object.modifier_apply(modifier=mod.name)
            except Exception:
                obj.modifiers.remove(mod)
            obj.select_set(False)

    # Merge static single-material meshes that share the exact same material to slash WebGL draw calls!
    if cfg.get("merge", True):
        by_mat = {}
        for obj in list(scene.objects):
            if obj.type != "MESH" or is_protected(obj):
                continue
            if len(obj.material_slots) != 1 or not obj.material_slots[0].material:
                continue
            # Only merge objects without parenting/animation constraints
            if obj.parent is not None or obj.animation_data is not None:
                continue
            mat_name = obj.material_slots[0].material.name
            by_mat.setdefault(mat_name, []).append(obj)

        for mat_name, objs in by_mat.items():
            if len(objs) < 2:
                continue
            bpy.ops.object.select_all(action="DESELECT")
            for o in objs:
                o.select_set(True)
            bpy.context.view_layer.objects.active = objs[0]
            try:
                bpy.ops.object.join()
            except Exception:
                pass
            bpy.ops.object.select_all(action="DESELECT")

    # Clean orphan data blocks before export
    bpy.ops.outliner.orphans_purge(do_recursive=True)

    bpy.ops.export_scene.gltf(
        filepath=out_glb,
        export_format="GLB",
        use_selection=False,
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
    )
    mesh_count = sum(1 for o in scene.objects if o.type == "MESH")
    poly_total = sum(len(o.data.polygons) for o in scene.objects if o.type == "MESH")
    kb = os.path.getsize(out_glb) / 1024.0
    print(f"OPTIMIZED {stem:22s}: {kb:7.1f} KB | meshes={mesh_count:3d} | polys={poly_total:6d}")


def main():
    only = set(sys.argv[sys.argv.index("--") + 1:]) if "--" in sys.argv else None
    for stem, cfg in TARGETS:
        if only and stem not in only:
            continue
        optimize_one(stem, cfg)


if __name__ == "__main__":
    main()
