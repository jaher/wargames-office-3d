#!/usr/bin/env python3
"""Generic headless Blender .blend -> .glb exporter.

Usage:
  blender --background --python assets/blender/scripts/export_glb.py -- <in.blend> <out.glb> [collection_name]
"""
import os
import sys
import bpy


def parse_args():
    argv = sys.argv
    if "--" not in argv:
        raise SystemExit("Usage: export_glb.py -- <in.blend> <out.glb> [collection_name]")
    args = argv[argv.index("--") + 1 :]
    if len(args) < 2:
        raise SystemExit("Expected <in.blend> <out.glb> [collection_name]")
    return args[0], args[1], (args[2] if len(args) > 2 else None)


def main():
    in_blend, out_glb, col_name = parse_args()
    bpy.ops.wm.open_mainfile(filepath=os.path.abspath(in_blend))

    bpy.ops.object.select_all(action="DESELECT")

    target_objs = []
    if col_name and col_name in bpy.data.collections:
        col = bpy.data.collections[col_name]
        target_objs = [o for o in col.all_objects if o.type in ("MESH", "EMPTY")]
    else:
        for o in bpy.context.scene.objects:
            if o.type in ("MESH", "EMPTY") and not o.name.startswith("_Preview"):
                target_objs.append(o)

    if not target_objs:
        raise SystemExit(f"No exportable objects found in {in_blend}")

    for o in target_objs:
        o.hide_set(False)
        o.hide_viewport = False
        o.select_set(True)

    bpy.context.view_layer.objects.active = target_objs[0]

    # Apply scale/rotation cleanly on meshes without disturbing parented empties
    mesh_objs = [o for o in target_objs if o.type == "MESH" and o.parent is None]
    if mesh_objs:
        bpy.ops.object.select_all(action="DESELECT")
        for o in mesh_objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = mesh_objs[0]
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    bpy.ops.object.select_all(action="DESELECT")
    for o in target_objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = target_objs[0]

    os.makedirs(os.path.dirname(os.path.abspath(out_glb)), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=os.path.abspath(out_glb),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
        export_texcoords=True,
        export_normals=True,
        export_image_format="AUTO",
    )
    print(f"EXPORTED_GLB: {out_glb} ({len(target_objs)} objects)")


if __name__ == "__main__":
    main()
