#!/usr/bin/env python3
"""Build the production NVIDIA DGX Spark Founders Edition (DGX FE) in Blender at TRUE scale.

Official NVIDIA DGX Spark dimensions: 150 mm L x 150 mm W x 50.5 mm H.
Stood upright on edge (vertical slim slab tower pose):
  - Width  (X):          50.5 mm  (exact)
  - Height (Z / Y-up):  150.0 mm  (exact, including 1.8 mm feet -> 0.0..150.0 mm)
  - Depth  (Y / Z-fwd): 150.0 mm  (exact, -75.0..+75.0 mm)

Front face (-Y in Blender / +Z in Three.js):
  - Dense, rough, speckled/granular pitted champagne-gold/beige porous metallic-stone finish.
  - Thin, smooth pale-gold trim along the top and bottom edges (plus slim side rails).
  - Top: smooth pale champagne-gold inset panel with rounded lower corners + wide horizontal pill slot.
  - Bottom: smooth coppery/rose-gold rounded rectangular plate bearing the green NVIDIA eye logo and
    pale-gold 'NVIDIA' capitals, with a smaller pale-gold horizontal pill slot below the logo.
  - Zero ports, cables, buttons, vents, or extra text on the front face.

Rear face (+Y in Blender / -Z in Three.js):
  - Recessed I/O bay: 2x ConnectX-7 QSFP 200GbE (x=-9.5mm, z=51.8/66.8mm), 10GbE RJ45 (x=-9.5mm, z=29.8mm),
    HDMI 2.1a (x=+10.5mm, z=66.8mm), 4x USB-C (x=+10.5mm, z=29.8..53.8mm), power button (x=+10.5mm, z=17.8mm).

Run:
    blender --background --python assets/blender/scripts/build_dgx_spark.py
"""
import math
import os
import numpy as np
import bpy
import bmesh
from mathutils import Vector
from PIL import Image, ImageDraw, ImageFont, ImageFilter

MM = 0.001
# Exact NVIDIA DGX Spark dimensions stood upright on edge: 50.5 W x 150.0 H x 150.0 D mm
W = 50.5 * MM
TOTAL_H = 150.0 * MM
FOOT_H = 1.8 * MM
H = TOTAL_H - FOOT_H  # 148.2 mm body + 1.8 mm feet = EXACT 150.0 mm total height
D = 150.0 * MM

ROOT = os.path.abspath("/workspace")
OUT_DIR = os.path.join(ROOT, "assets", "blender")
TEX_DIR = os.path.join(OUT_DIR, "textures")
OUT_BLEND = os.path.join(OUT_DIR, "dgx_spark.blend")
OUT_GLB = os.path.join(ROOT, "assets", "models", "dgx_spark.glb")
PREVIEW_PNG = "/tmp/dgx_spark_fe_preview.png"
os.makedirs(TEX_DIR, exist_ok=True)


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0


def height_to_normal_map(height_f32, strength=6.0):
    """Convert float32 [0..1] heightfield into crisp RGB tangent-space Normal Map."""
    dx = (np.roll(height_f32, -1, axis=1) - np.roll(height_f32, 1, axis=1)) * strength
    dy = (np.roll(height_f32, -1, axis=0) - np.roll(height_f32, 1, axis=0)) * strength
    nx = -dx
    ny = -dy
    nz = np.ones_like(height_f32)
    inv_len = 1.0 / np.sqrt(nx * nx + ny * ny + nz * nz + 1e-8)
    rgb = np.stack([
        np.clip((nx * inv_len * 0.5 + 0.5) * 255.0, 0, 255),
        np.clip((ny * inv_len * 0.5 + 0.5) * 255.0, 0, 255),
        np.clip((nz * inv_len * 0.5 + 0.5) * 255.0, 0, 255),
    ], axis=-1).astype(np.uint8)
    return Image.fromarray(rgb, mode="RGB")


def generate_speckled_front_textures():
    """
    Generate dense, rough, speckled/granular pitted champagne-gold/beige porous metallic-stone textures
    (Albedo + Tangent Normal + Roughness) matching the slim ~47 x 142 mm vertical front fascia (1 : 3 ratio).
    """
    rng = np.random.default_rng(202611)
    # Match slim vertical aspect ratio (~47 x 142 mm -> 1 : 3.0) so speckles stay isotropic (never stretched!)
    w, h = 224, 640

    n_med = rng.random((h // 2, w // 2), dtype=np.float32)
    img_med = Image.fromarray((n_med * 255).astype(np.uint8)).resize((w, h), Image.BILINEAR)
    img_med = img_med.filter(ImageFilter.GaussianBlur(radius=0.80))
    f_med = np.asarray(img_med, dtype=np.float32) / 255.0

    n_coarse = rng.random((h // 5, w // 5), dtype=np.float32)
    img_coarse = Image.fromarray((n_coarse * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
    img_coarse = img_coarse.filter(ImageFilter.GaussianBlur(radius=1.25))
    f_coarse = np.asarray(img_coarse, dtype=np.float32) / 255.0

    f_fine = rng.random((h, w), dtype=np.float32)

    raw = 0.45 * f_med + 0.31 * f_coarse + 0.24 * f_fine
    pit_mask = np.clip((0.48 - raw) / 0.18, 0.0, 1.0)
    deep_pit = np.power(pit_mask, 1.35)

    pin_noise = rng.random((h, w), dtype=np.float32)
    pin_img = Image.fromarray(((pin_noise > 0.945).astype(np.uint8)) * 255).filter(ImageFilter.GaussianBlur(radius=0.72))
    pinholes = np.clip(np.asarray(pin_img, dtype=np.float32) / 115.0, 0.0, 1.0)

    fleck = np.clip((raw - 0.58) / 0.22, 0.0, 1.0)

    total_pit = np.clip(deep_pit * 0.96 + pinholes * 0.92, 0.0, 1.0)
    height = np.clip(0.84 - total_pit * 0.80 + fleck * 0.16 + (f_fine - 0.5) * 0.12, 0.0, 1.0)

    # Bright champagne-gold / sandy beige base with dense dark charcoal-brown speckles & pits
    base_r = 216.0 + fleck * 24.0 + (f_fine - 0.5) * 20.0
    base_g = 196.0 + fleck * 24.0 + (f_fine - 0.5) * 18.0
    base_b = 156.0 + fleck * 22.0 + (f_fine - 0.5) * 16.0

    pit_r, pit_g, pit_b = 32.0, 25.0, 18.0
    t_pit = np.power(total_pit, 0.80)
    r = np.clip(base_r * (1.0 - t_pit) + pit_r * t_pit, 0, 255)
    g = np.clip(base_g * (1.0 - t_pit) + pit_g * t_pit, 0, 255)
    b = np.clip(base_b * (1.0 - t_pit) + pit_b * t_pit, 0, 255)

    albedo_img = Image.fromarray(np.stack([r, g, b], axis=-1).astype(np.uint8), mode="RGB")
    normal_img = height_to_normal_map(height, strength=8.5)
    rough = np.clip(0.48 + total_pit * 0.48 + (0.5 - fleck) * 0.12 + (f_fine - 0.5) * 0.08, 0.34, 0.98)
    rough_img = Image.fromarray((rough * 255).astype(np.uint8), mode="L")

    p_alb = os.path.join(TEX_DIR, "dgx_fe_speckled_albedo.jpg")
    p_nrm = os.path.join(TEX_DIR, "dgx_fe_speckled_normal.jpg")
    p_rgh = os.path.join(TEX_DIR, "dgx_fe_speckled_rough.jpg")
    albedo_img.save(p_alb, "JPEG", quality=90, optimize=True)
    normal_img.save(p_nrm, "JPEG", quality=90, optimize=True)
    rough_img.save(p_rgh, "JPEG", quality=88, optimize=True)
    return p_alb, p_nrm, p_rgh


def draw_nvidia_eye_logo(draw, x0, y0, size):
    """Draw the iconic bright green (#76C400) NVIDIA square + spiral eye emblem cleanly at high DPI."""
    green = (118, 196, 0)
    copper_bg = (172, 118, 94)
    s = size
    draw.rounded_rectangle((x0, y0, x0 + int(s * 0.62), y0 + s), radius=int(s * 0.06), fill=green)

    lw_outer = max(3, int(s * 0.115))
    lw_mid = max(2, int(s * 0.10))
    lw_inner = max(2, int(s * 0.085))

    draw.arc((x0 + int(s * 0.12), y0 + int(s * 0.06), x0 + int(s * 1.18), y0 + int(s * 0.94)),
             start=205, end=355, fill=green, width=lw_outer)
    draw.arc((x0 + int(s * 0.14), y0 + int(s * 0.12), x0 + int(s * 1.14), y0 + int(s * 0.92)),
             start=10, end=162, fill=green, width=lw_outer)

    draw.arc((x0 + int(s * 0.14), y0 + int(s * 0.14), x0 + int(s * 1.00), y0 + int(s * 0.86)),
             start=196, end=352, fill=copper_bg, width=lw_mid)
    draw.arc((x0 + int(s * 0.22), y0 + int(s * 0.24), x0 + int(s * 0.94), y0 + int(s * 0.80)),
             start=14, end=168, fill=copper_bg, width=lw_mid)

    draw.arc((x0 + int(s * 0.28), y0 + int(s * 0.26), x0 + int(s * 0.88), y0 + int(s * 0.74)),
             start=190, end=350, fill=green, width=lw_inner)
    draw.arc((x0 + int(s * 0.34), y0 + int(s * 0.34), x0 + int(s * 0.80), y0 + int(s * 0.68)),
             start=20, end=162, fill=green, width=lw_inner)
    draw.ellipse((x0 + int(s * 0.50), y0 + int(s * 0.42), x0 + int(s * 0.68), y0 + int(s * 0.58)), fill=green)
    draw.ellipse((x0 + int(s * 0.54), y0 + int(s * 0.46), x0 + int(s * 0.63), y0 + int(s * 0.54)), fill=copper_bg)


def generate_bottom_copper_plate_texture():
    """
    Generate smooth coppery/rose-gold bottom plate texture matching the 38 x 22 mm bottom plate:
    - Vivid green NVIDIA 'eye' logo on the left
    - Pale-gold 'NVIDIA' capitals beside it
    - Clean lower area for the 3D pale-gold horizontal pill slot
    """
    w, h = 768, 444
    base = np.zeros((h, w, 3), dtype=np.uint8)
    y_grad = np.linspace(-8, 10, h, dtype=np.float32)[:, None]
    rng = np.random.default_rng(707)
    grain = rng.normal(0, 1.5, (h, 1)).astype(np.float32)
    base[:, :, 0] = np.clip(176.0 + y_grad + grain, 0, 255)
    base[:, :, 1] = np.clip(122.0 + y_grad * 0.7 + grain, 0, 255)
    base[:, :, 2] = np.clip(96.0 + y_grad * 0.55 + grain, 0, 255)

    img = Image.fromarray(base, mode="RGB")
    draw = ImageDraw.Draw(img)

    draw.rounded_rectangle((6, 6, w - 7, h - 7), radius=48, outline=(206, 152, 120), width=4)

    eye_size = 128
    eye_x = 84
    eye_y = 86
    draw_nvidia_eye_logo(draw, eye_x, eye_y, eye_size)

    try:
        font_nv = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 112)
    except Exception:
        font_nv = ImageFont.load_default()

    pale_gold = (244, 224, 174)
    draw.text((254, eye_y + eye_size // 2 + 2), "NVIDIA", fill=pale_gold, font=font_nv, anchor="lm")

    p_plate = os.path.join(TEX_DIR, "dgx_fe_bottom_copper_plate.jpg")
    img.save(p_plate, "JPEG", quality=92, optimize=True)
    return p_plate


def make_mat(name, color, metallic=0.88, roughness=0.22):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    return mat


def make_tex_mat(name, alb_path, nrm_path=None, rgh_path=None, metallic=0.50, roughness=0.45, nrm_strength=1.5):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness

    tex_a = nt.nodes.new("ShaderNodeTexImage")
    img_a = bpy.data.images.load(alb_path)
    img_a.pack()
    tex_a.image = img_a
    nt.links.new(tex_a.outputs["Color"], bsdf.inputs["Base Color"])

    if rgh_path:
        tex_r = nt.nodes.new("ShaderNodeTexImage")
        img_r = bpy.data.images.load(rgh_path)
        img_r.colorspace_settings.name = "Non-Color"
        img_r.pack()
        tex_r.image = img_r
        nt.links.new(tex_r.outputs["Color"], bsdf.inputs["Roughness"])

    if nrm_path:
        tex_n = nt.nodes.new("ShaderNodeTexImage")
        img_n = bpy.data.images.load(nrm_path)
        img_n.colorspace_settings.name = "Non-Color"
        img_n.pack()
        tex_n.image = img_n
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nm.inputs["Strength"].default_value = nrm_strength
        nt.links.new(tex_n.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])

    return mat


def add_box(name, size, loc, mat, bevel=0.0, segments=3):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
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


def add_cyl(name, r, depth, loc, rot, mat, verts=18):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(mat)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def add_rounded_panel(name, width, height, depth, r_top, r_bot, loc_xyz, mat, segs=8, uv_front=False, edge_bevel=0.40 * MM):
    """Extruded 3D rounded rectangular panel on XZ plane with independent top/bottom corner radii."""
    hw = width * 0.5
    hh = height * 0.5

    pts = []
    if r_top > 1e-6:
        for i in range(segs + 1):
            a = 0.0 + (math.pi * 0.5) * (i / segs)
            pts.append((hw - r_top + math.cos(a) * r_top, hh - r_top + math.sin(a) * r_top))
    else:
        pts.append((hw, hh))
    if r_top > 1e-6:
        for i in range(segs + 1):
            a = math.pi * 0.5 + (math.pi * 0.5) * (i / segs)
            pts.append((-hw + r_top + math.cos(a) * r_top, hh - r_top + math.sin(a) * r_top))
    else:
        pts.append((-hw, hh))
    if r_bot > 1e-6:
        for i in range(segs + 1):
            a = math.pi + (math.pi * 0.5) * (i / segs)
            pts.append((-hw + r_bot + math.cos(a) * r_bot, -hh + r_bot + math.sin(a) * r_bot))
    else:
        pts.append((-hw, -hh))
    if r_bot > 1e-6:
        for i in range(segs + 1):
            a = math.pi * 1.5 + (math.pi * 0.5) * (i / segs)
            pts.append((hw - r_bot + math.cos(a) * r_bot, -hh + r_bot + math.sin(a) * r_bot))
    else:
        pts.append((hw, -hh))

    bm = bmesh.new()
    front_vs = [bm.verts.new((px, -depth * 0.5, pz)) for (px, pz) in pts]
    back_vs = [bm.verts.new((px, depth * 0.5, pz)) for (px, pz) in pts]

    bm.faces.new(list(reversed(front_vs)))
    bm.faces.new(back_vs)
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((front_vs[i], front_vs[j], back_vs[j], back_vs[i]))

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

    if uv_front:
        uv_layer = bm.loops.layers.uv.new("UVMap")
        for f in bm.faces:
            for loop in f.loops:
                vx, vy, vz = loop.vert.co
                u = (vx + hw) / width
                v = (vz + hh) / height
                loop[uv_layer].uv = (max(0.0, min(1.0, u)), max(0.0, min(1.0, v)))

    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    obj.location = loc_xyz
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)

    if edge_bevel > 0 and not uv_front:
        mod = obj.modifiers.new("Bevel", "BEVEL")
        mod.width = edge_bevel
        mod.segments = 2
        mod.limit_method = "ANGLE"
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)

    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def add_pill_slot(name_prefix, slot_w, slot_h, slot_depth, loc_xyz, rim_mat, trough_mat, rim_thick=0.9 * MM):
    """Real 3D horizontal pill-shaped recessed slot/groove (beveled pale-gold rim + recessed dark interior trough)."""
    r_outer = (slot_h * 0.5) + rim_thick
    r_inner = slot_h * 0.5
    rim = add_rounded_panel(
        f"{name_prefix}_Rim",
        width=slot_w + rim_thick * 2.0,
        height=slot_h + rim_thick * 2.0,
        depth=slot_depth,
        r_top=r_outer,
        r_bot=r_outer,
        loc_xyz=loc_xyz,
        mat=rim_mat,
        segs=8,
        uv_front=False,
        edge_bevel=0.24 * MM,
    )
    trough = add_rounded_panel(
        f"{name_prefix}_Trough",
        width=slot_w,
        height=slot_h,
        depth=slot_depth * 0.62,
        r_top=r_inner,
        r_bot=r_inner,
        loc_xyz=(loc_xyz[0], loc_xyz[1] - slot_depth * 0.25, loc_xyz[2]),
        mat=trough_mat,
        segs=8,
        uv_front=False,
        edge_bevel=0.14 * MM,
    )
    return rim, trough


def build_dgx_spark_fe():
    clear_scene()
    p_alb, p_nrm, p_rgh = generate_speckled_front_textures()
    p_copper = generate_bottom_copper_plate_texture()

    # ── Authentic DGX Spark FE Materials (preserved identically!) ──
    pale_gold_trim = make_mat("Spark_PaleGoldTrim", (0.76, 0.65, 0.44), metallic=0.86, roughness=0.22)
    pale_gold_inset = make_mat("Spark_PaleGoldInset", (0.80, 0.70, 0.50), metallic=0.84, roughness=0.20)
    body_gold_alu = make_mat("Spark_GoldAluminum", (0.68, 0.56, 0.36), metallic=0.86, roughness=0.25)
    speckled_front = make_tex_mat(
        "Spark_GoldMetalFoam", p_alb, p_nrm, p_rgh,
        metallic=0.34, roughness=0.68, nrm_strength=2.2
    )
    bottom_copper_plate = make_tex_mat(
        "Spark_FrontNvidiaLogo", p_copper,
        metallic=0.52, roughness=0.26
    )
    copper_bezel = make_mat("Spark_CopperRim", (0.68, 0.45, 0.35), metallic=0.82, roughness=0.24)
    slot_dark = make_mat("Spark_SlotRecess", (0.015, 0.011, 0.008), metallic=0.05, roughness=0.95)
    dark_core = make_mat("Spark_DarkAnodized", (0.024, 0.026, 0.032), metallic=0.62, roughness=0.46)
    steel_port = make_mat("Spark_StainlessPort", (0.72, 0.75, 0.80), metallic=0.92, roughness=0.22)
    rubber_foot = make_mat("Spark_RubberFoot", (0.018, 0.018, 0.022), metallic=0.0, roughness=0.92)

    z0 = FOOT_H          # 1.8 mm -> body spans z in [1.8, 150.0 mm], exact 150.0 mm total!
    # Keep front accents strictly >= -D/2 (-75.0 mm) and rear strictly <= +D/2 (+75.0 mm) -> exact 150.0 mm depth!
    front_trim_y = -D * 0.5 + 1.0 * MM   # -74.0 mm; pill slots finish cleanly at -75.0 mm!

    # ── 1. SLIM VERTICAL RECTANGULAR SLAB UNIBODY (50.5 W x 148.2 H x 147.0 D mm; total envelope 50.5 x 150 x 150 mm) ──
    body_d = D - 3.0 * MM  # 147.0 mm -> y in [-72.0, +75.0 mm]
    body = add_box(
        "DGX_FE_Unibody",
        (W, body_d, H),
        (0.0, 1.5 * MM, z0 + H * 0.5),
        body_gold_alu,
        bevel=1.8 * MM,
        segments=4,
    )

    # Recessed rear I/O pocket on +Y face (+75.0 mm)
    cut_rear = add_box(
        "_CutRear",
        (W - 7.5 * MM, 11.0 * MM, H - 14.0 * MM),
        (0.0, D * 0.5 - 2.5 * MM, z0 + H * 0.5),
        dark_core,
        bevel=1.0 * MM,
        segments=2,
    )
    mod_br = body.modifiers.new("BoolRear", "BOOLEAN")
    mod_br.operation = "DIFFERENCE"
    mod_br.object = cut_rear
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.modifier_apply(modifier=mod_br.name)
    bpy.data.objects.remove(cut_rear, do_unlink=True)

    # ── 2. THIN SMOOTH PALE-GOLD TRIM ALONG TOP & BOTTOM FRONT EDGES + SLIM SIDE RAILS ──
    trim_h = 3.0 * MM
    trim_d = 3.6 * MM
    add_box("Front_TopTrim", (W - 0.4 * MM, trim_d, trim_h), (0.0, front_trim_y + trim_d * 0.5, z0 + H - trim_h * 0.5), pale_gold_trim, bevel=0.55 * MM, segments=2)
    add_box("Front_BotTrim", (W - 0.4 * MM, trim_d, trim_h), (0.0, front_trim_y + trim_d * 0.5, z0 + trim_h * 0.5), pale_gold_trim, bevel=0.55 * MM, segments=2)
    rail_w = 1.8 * MM
    for sx in (-1, 1):
        add_box(
            f"Front_SideRail_{sx}",
            (rail_w, 3.0 * MM, H - trim_h * 1.8),
            (sx * (W * 0.5 - rail_w * 0.5), front_trim_y + 1.6 * MM, z0 + H * 0.5),
            pale_gold_trim,
            bevel=0.35 * MM,
            segments=2,
        )

    # ── 3. DENSE ROUGH SPECKLED / GRANULAR PITTED CHAMPAGNE-GOLD/BEIGE FRONT FASCIA ──
    fascia_w = W - rail_w * 2.0   # 46.9 mm
    fascia_h = H - trim_h * 2.0   # 142.2 mm
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0.0, front_trim_y + 1.1 * MM, z0 + H * 0.5))
    fascia = bpy.context.active_object
    fascia.name = "Front_SpeckledFascia"
    fascia.scale = (fascia_w, fascia_h, 1.0)
    fascia.rotation_euler = (math.pi / 2, 0.0, 0.0)
    bpy.ops.object.transform_apply(rotation=True, scale=True)
    fascia.data.materials.append(speckled_front)

    # ── 4. TOP SMOOTH PALE CHAMPAGNE-GOLD INSET PANEL (rounded lower corners + wide horizontal pill slot!) ──
    top_panel_w = 37.5 * MM
    top_panel_h = 17.5 * MM
    top_panel_z = z0 + H - trim_h - top_panel_h * 0.5 + 0.3 * MM
    add_rounded_panel(
        "Front_TopPaleGoldInset",
        width=top_panel_w,
        height=top_panel_h,
        depth=1.8 * MM,
        r_top=0.6 * MM,
        r_bot=4.5 * MM,
        loc_xyz=(0.0, front_trim_y + 0.75 * MM, top_panel_z),
        mat=pale_gold_inset,
        segs=8,
        uv_front=False,
        edge_bevel=0.38 * MM,
    )
    add_pill_slot(
        "Front_TopPillSlot",
        slot_w=22.5 * MM,
        slot_h=3.6 * MM,
        slot_depth=1.2 * MM,
        loc_xyz=(0.0, front_trim_y - 0.12 * MM, top_panel_z - 0.4 * MM),
        rim_mat=pale_gold_trim,
        trough_mat=slot_dark,
        rim_thick=0.9 * MM,
    )

    # ── 5. BOTTOM SMOOTH COPPERY/ROSE-GOLD ROUNDED RECTANGULAR PLATE + GREEN NVIDIA EYE + PALE-GOLD PILL SLOT ──
    bot_plate_w = 38.0 * MM
    bot_plate_h = 22.0 * MM
    bot_plate_z = z0 + trim_h + bot_plate_h * 0.5 + 4.8 * MM

    add_rounded_panel(
        "Front_BottomCopperHousing",
        width=bot_plate_w + 1.4 * MM,
        height=bot_plate_h + 1.4 * MM,
        depth=1.8 * MM,
        r_top=4.2 * MM,
        r_bot=4.2 * MM,
        loc_xyz=(0.0, front_trim_y + 0.80 * MM, bot_plate_z),
        mat=copper_bezel,
        segs=8,
        uv_front=False,
        edge_bevel=0.40 * MM,
    )
    add_rounded_panel(
        "Front_BottomCopperFace",
        width=bot_plate_w,
        height=bot_plate_h,
        depth=0.5 * MM,
        r_top=3.7 * MM,
        r_bot=3.7 * MM,
        loc_xyz=(0.0, front_trim_y - 0.08 * MM, bot_plate_z),
        mat=bottom_copper_plate,
        segs=8,
        uv_front=True,
        edge_bevel=0.0,
    )
    add_pill_slot(
        "Front_BottomPillSlot",
        slot_w=14.8 * MM,
        slot_h=2.6 * MM,
        slot_depth=1.0 * MM,
        loc_xyz=(0.0, front_trim_y - 0.35 * MM, bot_plate_z - 6.0 * MM),
        rim_mat=pale_gold_trim,
        trough_mat=slot_dark,
        rim_thick=0.78 * MM,
    )

    # ── 6. REAR PANEL (+Y, flush inside +75.0 mm): Upper Exhaust + Compact 2-Column Enterprise I/O Bay ──
    rear_y = D * 0.5 - 3.8 * MM  # +71.2 mm; port cages stay <= +74.8 mm!
    add_box("Rear_IO_Backplate", (W - 8.2 * MM, 1.8 * MM, H - 14.5 * MM), (0.0, rear_y - 0.7 * MM, z0 + H * 0.5), dark_core)

    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0.0, rear_y + 0.3 * MM, z0 + H * 0.74))
    rfoam = bpy.context.active_object
    rfoam.name = "Rear_VentFascia"
    rfoam.scale = (W - 11.0 * MM, 48.0 * MM, 1.0)
    rfoam.rotation_euler = (-math.pi / 2, 0.0, 0.0)
    bpy.ops.object.transform_apply(rotation=True, scale=True)
    rfoam.data.materials.append(speckled_front)

    # Left-rear column (x = -9.5 mm): 2x ConnectX-7 200GbE QSFP + 10GbE RJ45
    for qi, qz in enumerate([z0 + 50.0 * MM, z0 + 65.0 * MM]):
        add_box(f"Rear_QSFP_Cage_{qi}", (17.0 * MM, 4.4 * MM, 10.2 * MM), (-9.5 * MM, rear_y + 0.8 * MM, qz), steel_port, bevel=0.35 * MM, segments=2)
        add_box(f"Rear_QSFP_Hole_{qi}", (14.0 * MM, 3.0 * MM, 7.2 * MM), (-9.5 * MM, rear_y + 1.8 * MM, qz), dark_core)

    add_box("Rear_RJ45_Cage", (15.0 * MM, 4.0 * MM, 13.0 * MM), (-9.5 * MM, rear_y + 0.6 * MM, z0 + 28.0 * MM), steel_port, bevel=0.35 * MM, segments=2)
    add_box("Rear_RJ45_Hole", (11.8 * MM, 2.6 * MM, 9.8 * MM), (-9.5 * MM, rear_y + 1.6 * MM, z0 + 28.0 * MM), dark_core)

    # Right-rear column (x = +10.5 mm): HDMI 2.1a + 4x USB-C + Power button
    add_box("Rear_HDMI_Collar", (13.6 * MM, 3.4 * MM, 5.2 * MM), (10.5 * MM, rear_y + 0.6 * MM, z0 + 65.0 * MM), steel_port, bevel=0.35 * MM, segments=2)
    add_box("Rear_HDMI_Hole", (11.4 * MM, 2.0 * MM, 3.2 * MM), (10.5 * MM, rear_y + 1.5 * MM, z0 + 65.0 * MM), dark_core)

    for ui, uz in enumerate([z0 + 52.0 * MM, z0 + 44.0 * MM, z0 + 36.0 * MM, z0 + 28.0 * MM]):
        add_box(f"Rear_USBC_Collar_{ui}", (8.8 * MM, 3.2 * MM, 3.4 * MM), (10.5 * MM, rear_y + 0.5 * MM, uz), steel_port, bevel=0.5 * MM, segments=2)
        add_box(f"Rear_USBC_Hole_{ui}", (6.8 * MM, 1.8 * MM, 1.8 * MM), (10.5 * MM, rear_y + 1.4 * MM, uz), dark_core)

    add_cyl("Rear_PowerBtn", 3.0 * MM, 2.8 * MM, (10.5 * MM, rear_y + 0.6 * MM, z0 + 16.0 * MM), (math.pi / 2, 0.0, 0.0), steel_port, 16)

    # ── 7. SLIM RECESSED DARK BASE PLINTH + 4 RUBBER FEET (z in [0.0, 1.8 mm]) ──
    add_box("Bottom_RecessedBase", (W - 8.0 * MM, D - 10.0 * MM, FOOT_H * 0.82), (0.0, 0.0, FOOT_H * 0.5), dark_core, bevel=0.45 * MM)
    for fx in (-15.5 * MM, 15.5 * MM):
        for fy in (-52.0 * MM, 52.0 * MM):
            add_cyl(f"Foot_{fx:.3f}_{fy:.3f}", 4.2 * MM, FOOT_H, (fx, fy, FOOT_H * 0.5), (0.0, 0.0, 0.0), rubber_foot, 14)

    # Save source .blend
    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
    print(f"SAVED: {OUT_BLEND}")

    # Export clean compact GLB
    bpy.ops.export_scene.gltf(
        filepath=OUT_GLB,
        export_format="GLB",
        export_apply=True,
        export_yup=True,
        export_image_format="JPEG",
    )
    print(f"EXPORTED: {OUT_GLB} ({os.path.getsize(OUT_GLB) / 1024:.1f} KB)")

    # ── 8. CYCLES FRONT + 3/4 STUDIO PREVIEW RENDER ──
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 48
    scene.cycles.use_denoising = False
    scene.render.resolution_x = 800
    scene.render.resolution_y = 800
    scene.render.filepath = PREVIEW_PNG

    world = bpy.data.worlds.new("PreviewWorld")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.16, 0.15, 0.14, 1.0)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.1

    bpy.ops.mesh.primitive_plane_add(size=1.2, location=(0, 0, -0.0005))
    floor = bpy.context.active_object
    fmat = make_mat("PreviewFloor", (0.14, 0.10, 0.07), metallic=0.0, roughness=0.72)
    floor.data.materials.append(fmat)

    for lname, energy, col, loc, rot in [
        ("KeyLight", 42.0, (1.0, 0.94, 0.86), (-0.28, -0.42, 0.34), (math.radians(58), 0, math.radians(-34))),
        ("FillLight", 20.0, (0.90, 0.94, 1.0), (0.34, -0.36, 0.22), (math.radians(66), 0, math.radians(42))),
    ]:
        ld = bpy.data.lights.new(lname, type="AREA")
        ld.energy = energy
        ld.color = col
        ld.size = 0.42
        lo = bpy.data.objects.new(lname, ld)
        lo.location = loc
        lo.rotation_euler = rot
        scene.collection.objects.link(lo)

    cam_d = bpy.data.cameras.new("Cam")
    cam_d.lens = 62
    cam_o = bpy.data.objects.new("Cam", cam_d)
    cam_o.location = (0.11, -0.34, 0.11)
    direction = Vector((0.0, 0.0, TOTAL_H * 0.5)) - cam_o.location
    cam_o.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(cam_o)
    scene.camera = cam_o

    bpy.ops.render.render(write_still=True)
    print(f"PREVIEW: {PREVIEW_PNG}")


if __name__ == "__main__":
    build_dgx_spark_fe()
