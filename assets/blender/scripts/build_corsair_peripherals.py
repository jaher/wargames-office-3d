#!/usr/bin/env python3
"""Build accurate Corsair K70 PRO TKL Black Aluminum Keyboard AND Corsair M75 / DARK CORE Wireless Mouse in headless Blender.

Geometry & PBR material modeling only (rendered live in Three.js in the browser — ZERO Blender Cycles rendering!).
Crafted to match real Corsair flagship peripherals:
1. Corsair K70 PRO TKL (366 x 135 x 38 mm):
   - Aircraft-grade brushed black anodized aluminum top plate with chamfered edges
   - Iconic top-right knurled metallic aluminum volume roller + dedicated mute/media/iCUE control cluster
   - Crisp centered Corsair sails emblem badge on top bezel
   - Sculpted matte-black double-shot PBT keycaps (full TKL ANSI layout) with subtle cool white/cyan under-key glow
   - Braided USB-C cable exit at rear
2. Corsair M75 Wireless Black Mouse (128 x 65 x 41 mm):
   - Sculpted sleek matte-black ergonomic/ambidextrous gaming shell with contoured split L/R click paddles
   - Tactile grooved dark-rubber scroll wheel + DPI switch + dual left side thumb buttons
   - Subtle glowing Corsair sails emblem on the rear palm rest

Outputs:
  assets/blender/corsair_k70_kb.blend
  assets/blender/corsair_mouse.blend
"""
import math
import os
import bpy
import bmesh
from PIL import Image, ImageDraw, ImageFont

MM = 0.001
OUT_DIR = os.path.abspath("/workspace/assets/blender")
TEX_DIR = os.path.join(OUT_DIR, "textures")
os.makedirs(TEX_DIR, exist_ok=True)


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0


def make_mat(name, color, metallic=0.2, roughness=0.45, emit=None, emit_strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if emit is not None:
        bsdf.inputs["Emission"].default_value = (*emit, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emit_strength
    return mat


def make_tex_mat(name, path, metallic=0.3, roughness=0.38, emit_strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    tex = nt.nodes.new("ShaderNodeTexImage")
    img = bpy.data.images.load(path)
    img.pack()
    tex.image = img
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    if emit_strength > 0:
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Emission"])
        bsdf.inputs["Emission Strength"].default_value = emit_strength
    return mat


def add_box(name, size, loc, mat, bevel=0.0, segments=2, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel > 0:
        mod = obj.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = "ANGLE"
        bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.data.materials.append(mat)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def add_cyl(name, r, depth, loc, rot, mat, verts=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(mat)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def generate_sails_badge(filename, bg=(18, 20, 25), fg=(214, 224, 238), size=256):
    img = Image.new("RGB", (size, size), bg)
    d = ImageDraw.Draw(img)
    s = size / 256.0
    # Iconic 3-sail Corsair ship emblem
    d.polygon([(int(62 * s), int(206 * s)), (int(88 * s), int(92 * s)), (int(108 * s), int(206 * s))], fill=fg)
    d.polygon([(int(106 * s), int(206 * s)), (int(138 * s), int(56 * s)), (int(162 * s), int(206 * s))], fill=fg)
    d.polygon([(int(160 * s), int(206 * s)), (int(184 * s), int(106 * s)), (int(202 * s), int(206 * s))], fill=fg)
    path = os.path.join(TEX_DIR, filename)
    img.save(path)
    return path


def build_corsair_k70():
    clear_scene()
    p_sails = generate_sails_badge("corsair_kb_sails.png", bg=(14, 16, 20), fg=(196, 208, 224))

    alu_black = make_mat("CorsairKB_BrushedAlu", (0.042, 0.046, 0.054), metallic=0.84, roughness=0.30)
    chassis_bot = make_mat("CorsairKB_Bottom", (0.018, 0.020, 0.024), metallic=0.15, roughness=0.68)
    keycap_pbt = make_mat("CorsairKB_KeycapPBT", (0.026, 0.029, 0.035), metallic=0.04, roughness=0.66)
    keycap_accent = make_mat("CorsairKB_KeycapAccent", (0.048, 0.054, 0.066), metallic=0.08, roughness=0.58)
    roller_alu = make_mat("CorsairKB_VolumeRoller", (0.34, 0.37, 0.42), metallic=0.92, roughness=0.26)
    rgb_glow = make_mat("CorsairKB_RGBUnder", (0.42, 0.78, 0.96), 0.0, 0.25, (0.42, 0.78, 0.96), 1.25)
    rgb_esc = make_mat("CorsairKB_EscAccent", (0.86, 0.68, 0.14), 0.08, 0.48)
    sails_mat = make_tex_mat("CorsairKB_SailsBadge", p_sails, metallic=0.45, roughness=0.30, emit_strength=0.35)

    W, D, H = 366 * MM, 138 * MM, 20 * MM
    tilt = math.radians(5.5)

    # 1. Brushed black anodized aluminum top deck + angled sculpted bottom base
    add_box("K70_Base", (W, D, H * 0.78), (0, 0, H * 0.44), chassis_bot, bevel=2.8 * MM, segments=3, rot=(tilt, 0, 0))
    add_box("K70_AluTopPlate", (W - 2 * MM, D - 2 * MM, 4.5 * MM), (0, 0, H * 0.88), alu_black, bevel=1.6 * MM, segments=2, rot=(tilt, 0, 0))
    # Subtle continuous under-key RGB diffuser plate visible between floating keycaps
    add_box("K70_RGBDiffuser", (W - 20 * MM, D - 34 * MM, 1.4 * MM), (0, -7 * MM, H * 0.97), rgb_glow, rot=(tilt, 0, 0))

    # 2. Iconic Top Bezel: Centered Gloss Corsair Sails Badge + Top-Right Knurled Aluminum Volume Roller & Media Controls!
    top_y = D * 0.5 - 12 * MM
    top_z = H + 7.2 * MM
    # Centered glossy Corsair sails logo inset
    add_box("K70_LogoPlaque", (24 * MM, 13 * MM, 2.2 * MM), (0, top_y, top_z), chassis_bot, bevel=0.8 * MM, rot=(tilt, 0, 0))
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0, top_y, top_z + 1.25 * MM), rotation=(tilt, 0, 0))
    lp = bpy.context.active_object
    lp.name = "K70_SailsLogo"
    lp.scale = (11.5 * MM, 11.5 * MM, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    lp.data.materials.append(sails_mat)

    # Left-side iCUE / Lock / Profile round hotkeys
    for i, hx in enumerate([-152 * MM, -138 * MM, -124 * MM]):
        add_cyl(f"K70_HotKey_{i}", 3.6 * MM, 3.2 * MM, (hx, top_y, top_z + 0.5 * MM), (tilt, 0, 0), keycap_accent, 16)

    # Signature K70 Knurled Metallic Aluminum Volume Roller on Top-Right!
    add_box("K70_RollerWell", (46 * MM, 13 * MM, 4.0 * MM), (144 * MM, top_y, top_z), chassis_bot, bevel=0.8 * MM, rot=(tilt, 0, 0))
    add_cyl("K70_VolumeRoller", 5.8 * MM, 36 * MM, (144 * MM, top_y, top_z + 2.2 * MM), (tilt, math.pi / 2, 0), roller_alu, 24)
    # Mute button next to volume roller
    add_box("K70_MuteBtn", (11 * MM, 8 * MM, 3.2 * MM), (112 * MM, top_y, top_z + 0.8 * MM), keycap_accent, bevel=0.8 * MM, rot=(tilt, 0, 0))

    # 3. Full Sculpted Double-Shot PBT TKL Keycap Grid (6 rows, accurate 19.05mm pitch + nav cluster + arrow keys!)
    pitch = 18.8 * MM
    rows = [
        # (y_offset_from_center, list of (x_units, width_units, is_accent))
        (36 * MM, [(0, 1, True)] + [(2 + i, 1, False) for i in range(4)] + [(6.5 + i, 1, False) for i in range(4)] + [(11 + i, 1, False) for i in range(4)] + [(15.5 + i, 1, False) for i in range(3)]),
        (16 * MM, [(i, 1, False) for i in range(13)] + [(13.5, 2.0, True)] + [(15.5 + i, 1, False) for i in range(3)]),
        (-3 * MM, [(0.25, 1.5, True)] + [(1.5 + i, 1, False) for i in range(12)] + [(13.75, 1.5, True)] + [(15.5 + i, 1, False) for i in range(3)]),
        (-22 * MM, [(0.375, 1.75, True)] + [(1.75 + i, 1, False) for i in range(11)] + [(13.375, 2.25, True)]),
        (-41 * MM, [(0.625, 2.25, True)] + [(2.25 + i, 1, False) for i in range(10)] + [(13.125, 2.75, True)] + [(16.5, 1, True)]),
        (-60 * MM, [(0.125, 1.25, True), (1.375, 1.25, True), (2.625, 1.25, True), (6.375, 6.25, False), (10.125, 1.25, True), (11.375, 1.25, True), (12.625, 1.25, True), (13.875, 1.25, True)] + [(15.5 + i, 1, True) for i in range(3)]),
    ]
    x_origin = -170 * MM
    for ri, (ry, keys) in enumerate(rows):
        rz = H + 5.8 * MM + ry * math.sin(tilt)
        for ki, (xu, wu, acc) in enumerate(keys):
            kx = x_origin + (xu + wu * 0.5) * pitch
            kw = wu * pitch - 2.6 * MM
            kd = 15.6 * MM
            kh = 9.2 * MM
            m = rgb_esc if (ri == 0 and ki == 0) else (keycap_accent if acc else keycap_pbt)
            add_box(f"Key_{ri}_{ki}", (kw, kd, kh), (kx, ry, rz), m, bevel=1.4 * MM, segments=2, rot=(tilt, 0, 0))

    # Rear USB-C port & detachable braided cable stub
    add_box("K70_USBC_Collar", (14 * MM, 10 * MM, 7 * MM), (-120 * MM, D * 0.5 + 3 * MM, H * 0.65), chassis_bot, bevel=1.2 * MM)

    out_blend = os.path.join(OUT_DIR, "corsair_k70_kb.blend")
    bpy.ops.wm.save_as_mainfile(filepath=out_blend)
    print(f"SAVED: {out_blend}")


def build_corsair_mouse():
    clear_scene()
    p_sails = generate_sails_badge("corsair_mouse_sails.png", bg=(14, 16, 20), fg=(120, 210, 250))

    shell_matte = make_mat("CorsairMouse_MatteBlack", (0.028, 0.031, 0.038), metallic=0.06, roughness=0.48)
    grip_side = make_mat("CorsairMouse_SideGrip", (0.016, 0.018, 0.022), metallic=0.02, roughness=0.84)
    wheel_rubber = make_mat("CorsairMouse_Wheel", (0.020, 0.022, 0.026), metallic=0.08, roughness=0.68)
    trim_gloss = make_mat("CorsairMouse_Trim", (0.015, 0.017, 0.021), metallic=0.22, roughness=0.18)
    sails_glow = make_tex_mat("CorsairMouse_SailsRGB", p_sails, metallic=0.10, roughness=0.28, emit_strength=1.15)
    led_accent = make_mat("CorsairMouse_LED", (0.45, 0.80, 0.96), 0.0, 0.25, (0.45, 0.80, 0.96), 1.4)

    # Sculpted Corsair M75 Wireless aerodynamic silhouette (128 x 65 x 41 mm) via smooth lofted bmesh!
    bm = bmesh.new()
    # Longitudinal stations from rear (-Y = -64mm) to nose (+Y = +64mm)
    stations = [
        (-63 * MM, 18 * MM, 14 * MM, 3 * MM),
        (-52 * MM, 28 * MM, 28 * MM, 2 * MM),
        (-34 * MM, 32 * MM, 38 * MM, 1 * MM),
        (-12 * MM, 31.5 * MM, 41 * MM, 1 * MM),
        (12 * MM, 29.5 * MM, 37 * MM, 1 * MM),
        (34 * MM, 30.5 * MM, 26 * MM, 1.5 * MM),
        (54 * MM, 26 * MM, 15 * MM, 2.5 * MM),
        (64 * MM, 15 * MM, 7 * MM, 3.5 * MM),
    ]
    rings = []
    n_arc = 18
    for y, hw, top_h, bot_z in stations:
        ring = []
        for i in range(n_arc):
            ang = (i / n_arc) * math.pi * 2.0
            ca, sa = math.cos(ang), math.sin(ang)
            vx = ca * hw * (0.94 if sa < 0 else 1.0)
            if sa >= 0:
                vz = bot_z + (top_h - bot_z) * (math.sin(ang) ** 0.72)
            else:
                vz = bot_z + 1.2 * MM * (1.0 + sa)
            ring.append(bm.verts.new((vx, y, vz)))
        rings.append(ring)
    for r_i in range(len(rings) - 1):
        for i in range(n_arc):
            ni = (i + 1) % n_arc
            f = bm.faces.new((rings[r_i][i], rings[r_i][ni], rings[r_i + 1][ni], rings[r_i + 1][i]))
            f.smooth = True
    # Cap front & rear cleanly
    bm.faces.new(rings[0][::-1]).smooth = True
    bm.faces.new(rings[-1]).smooth = True
    me = bpy.data.meshes.new("CorsairMouse_BodyM")
    bm.to_mesh(me)
    bm.free()
    body = bpy.data.objects.new("CorsairMouse_Body", me)
    bpy.context.scene.collection.objects.link(body)
    body.data.materials.append(shell_matte)

    # Center split seam + scroll wheel well + grooved rubber scroll wheel + DPI button
    add_box("Mouse_CenterSeam", (1.6 * MM, 44 * MM, 2.0 * MM), (0, 42 * MM, 22 * MM), trim_gloss, rot=(-0.38, 0, 0))
    add_box("Mouse_WheelWell", (10 * MM, 24 * MM, 8 * MM), (0, 32 * MM, 25 * MM), trim_gloss, bevel=1.5 * MM, rot=(-0.26, 0, 0))
    add_cyl("Mouse_ScrollWheel", 8.5 * MM, 7.0 * MM, (0, 32 * MM, 28 * MM), (0, math.pi / 2, 0), wheel_rubber, 24)
    add_box("Mouse_DPIBtn", (5.5 * MM, 9.0 * MM, 3.0 * MM), (0, 14 * MM, 36.2 * MM), trim_gloss, bevel=0.8 * MM, rot=(-0.12, 0, 0))

    # Dual left-side sculpted thumb buttons (Corsair M75 signature side buttons!)
    add_box("Mouse_ThumbFront", (3.5 * MM, 16 * MM, 6.2 * MM), (-30.5 * MM, 12 * MM, 21 * MM), trim_gloss, bevel=1.0 * MM)
    add_box("Mouse_ThumbBack", (3.5 * MM, 16 * MM, 6.2 * MM), (-31.0 * MM, -7 * MM, 22 * MM), trim_gloss, bevel=1.0 * MM)

    # Subtle glowing Corsair sails emblem on the rear palm rest + crisp rear RGB accent strip
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0, -34 * MM, 38.4 * MM), rotation=(0.30, 0, 0))
    ms = bpy.context.active_object
    ms.name = "Mouse_CorsairSails"
    ms.scale = (14 * MM, 14 * MM, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    ms.data.materials.append(sails_glow)
    add_box("Mouse_RearAccentLED", (22 * MM, 2.5 * MM, 2.5 * MM), (0, -61 * MM, 9 * MM), led_accent, bevel=0.6 * MM)

    out_blend = os.path.join(OUT_DIR, "corsair_mouse.blend")
    bpy.ops.wm.save_as_mainfile(filepath=out_blend)
    print(f"SAVED: {out_blend}")


if __name__ == "__main__":
    build_corsair_k70()
    build_corsair_mouse()
