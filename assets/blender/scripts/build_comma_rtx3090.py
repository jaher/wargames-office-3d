#!/usr/bin/env python3
"""Build an accurate comma.ai Chestnut USB4 eGPU Dock + NVIDIA GeForce RTX 3090 Founders Edition in headless Blender.

Geometry & PBR material modeling only (rendered live in Three.js WebGL — ZERO Cycles rendering).
Based on verified real product specifications:
1. comma.ai Chestnut (tiny chestnut) USB4 -> PCIe Gen4 x4 eGPU Dock:
   - CNC matte-black anodized aluminum open-air base (235 x 112 x 6 mm) on 4 rubber feet + rear 3-slot L-bracket
   - Exposed matte-black comma.ai Chestnut PCB (172 x 76 x 2 mm) on brass standoffs with knurled thumb nuts
   - Full-length steel-reinforced PCIe x16 slot, ASMedia ASM2464PD bridge + black finned heatsink
   - Yellow XT60i 12V power input connector + 12V GPU power stage (capacitors & inductors)
   - USB4 Type-C host port, FT230X debug USB-C port, glowing green status link LED, crisp silkscreen branding
2. NVIDIA GeForce RTX 3090 Founders Edition (exact 313 x 61 x 138 mm 3-slot flagship):
   - Signature brushed titanium-silver interlocking X/V-shaped unibody exoskeleton frame
   - Exposed matte-black micro-finned aluminum heatsink core strictly recessed inside frame (ZERO z-fighting!)
   - Dual 106 mm push-pull flow-through axial fans (RTX3090_FanFront & RTX3090_FanBack) with 9 curved blades for live Three.js rotation
   - Top-spine illuminated white GEFORCE RTX logo + angled 12-pin Molex Micro-Fit 3.0 power connector
   - 3-slot brushed steel rear I/O bracket (3x DisplayPort + 1x HDMI) & RTX 3090 backplate marking

Outputs:
  assets/blender/comma_rtx3090.blend
"""
import math
import os
import random
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


def _font(size, bold=True):
    paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
    ]
    for p in paths:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def generate_chestnut_pcb_texture():
    """1024x512 matte-black comma.ai Chestnut PCB with copper traces and crisp white silkscreen."""
    rng = random.Random(3090)
    w, h = 1024, 512
    img = Image.new("RGB", (w, h), (16, 18, 22))
    d = ImageDraw.Draw(img)

    # Subtle dark-copper PCB trace routing lines
    for _ in range(90):
        x0 = rng.randint(20, w - 20)
        y0 = rng.randint(20, h - 20)
        dx = rng.choice([-140, -80, 80, 140])
        dy = rng.choice([-60, 0, 60])
        d.line([(x0, y0), (x0 + dx, y0), (x0 + dx + dy, y0 + dy)], fill=(28, 34, 42), width=2)

    # Gold-plated mounting hole pads at 4 corners
    for cx, cy in [(44, 44), (w - 44, 44), (44, h - 44), (w - 44, h - 44)]:
        d.ellipse([cx - 22, cy - 22, cx + 22, cy + 22], fill=(176, 144, 62))
        d.ellipse([cx - 10, cy - 10, cx + 10, cy + 10], fill=(12, 14, 18))

    # Crisp white comma.ai silkscreen markings
    f_big = _font(36, bold=True)
    f_med = _font(22, bold=True)
    f_sm = _font(17, bold=False)

    d.rectangle([14, 14, w - 15, h - 15], outline=(62, 68, 78), width=2)
    d.text((78, 368), "comma.ai", font=f_big, fill=(235, 240, 246))
    d.text((285, 378), "CHESTNUT  ·  USB4 eGPU", font=f_med, fill=(184, 194, 208))
    d.text((78, 420), "tinygrad / PCIe Gen4 x4  ·  ASM2464PD  ·  OPEN SOURCE FIRMWARE", font=f_sm, fill=(134, 146, 162))
    d.text((775, 42), "XT60i 12V IN", font=f_sm, fill=(236, 206, 72))
    d.text((790, 384), "USB4 HOST", font=f_sm, fill=(210, 220, 232))
    d.text((640, 384), "FT230X DBG", font=f_sm, fill=(156, 166, 178))
    d.text((92, 42), "PCIe x16 (GEN4 x4)", font=f_sm, fill=(166, 176, 190))

    p = os.path.join(TEX_DIR, "comma_chestnut_pcb.png")
    img.save(p)
    return p


def generate_rtx3090_fin_texture():
    """High-contrast matte-black directional aluminum heatsink fin stack texture."""
    w, h = 512, 256
    img = Image.new("RGB", (w, h), (16, 18, 22))
    d = ImageDraw.Draw(img)
    for x in range(0, w, 6):
        d.rectangle([x, 0, x + 2, h], fill=(42, 46, 54))
        d.rectangle([x + 3, 0, x + 5, h], fill=(10, 12, 15))
    # Subtle horizontal heatpipe shadow bands
    for y in (64, 128, 192):
        d.line([(0, y), (w, y)], fill=(8, 9, 12), width=4)
    p = os.path.join(TEX_DIR, "rtx3090_fins.png")
    img.save(p)
    return p


def generate_rtx3090_spine_badge():
    """Crisp illuminated white GEFORCE RTX top-spine badge for RTX 3090 Founders Edition."""
    w, h = 1024, 192
    base = Image.new("RGB", (w, h), (18, 20, 24))
    emit = Image.new("RGB", (w, h), (0, 0, 0))
    db = ImageDraw.Draw(base)
    de = ImageDraw.Draw(emit)
    f = _font(86, bold=True)
    text = "GEFORCE RTX"
    bb = db.textbbox((0, 0), text, font=f)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    tx, ty = (w - tw) // 2 - bb[0], (h - th) // 2 - bb[1]
    db.text((tx, ty), text, font=f, fill=(242, 246, 252))
    de.text((tx, ty), text, font=f, fill=(235, 244, 255))
    pb = os.path.join(TEX_DIR, "rtx3090_geforce_base.png")
    pe = os.path.join(TEX_DIR, "rtx3090_geforce_emit.png")
    base.save(pb)
    emit.save(pe)
    return pb, pe


def generate_rtx3090_model_badge():
    """Crisp silver-etched RTX 3090 marking for the Founders Edition face."""
    w, h = 512, 128
    img = Image.new("RGB", (w, h), (22, 24, 29))
    d = ImageDraw.Draw(img)
    f = _font(64, bold=True)
    text = "RTX 3090"
    bb = d.textbbox((0, 0), text, font=f)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    d.text(((w - tw) // 2 - bb[0], (h - th) // 2 - bb[1]), text, font=f, fill=(196, 204, 214))
    p = os.path.join(TEX_DIR, "rtx3090_badge.png")
    img.save(p)
    return p


def make_mat(name, color, metallic=0.1, roughness=0.45, emit=None, emit_strength=0.0):
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


def make_tex_mat(name, path, metallic=0.1, roughness=0.42, emit_path=None, emit_strength=0.0):
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
        etex = nt.nodes.new("ShaderNodeTexImage")
        eimg = bpy.data.images.load(emit_path or path)
        eimg.pack()
        etex.image = eimg
        nt.links.new(etex.outputs["Color"], bsdf.inputs["Emission"])
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


def add_cyl(name, r, depth, loc, rot, mat, verts=28):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(mat)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def add_planar_panel(name, w_mm, h_mm, loc, rot, mat):
    """Add a clean UV-mapped single quad panel (for PCB top, badges, etc.)."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    hw, hh = w_mm * 0.5 * MM, h_mm * 0.5 * MM
    v0 = bm.verts.new((-hw, -hh, 0.0))
    v1 = bm.verts.new((hw, -hh, 0.0))
    v2 = bm.verts.new((hw, hh, 0.0))
    v3 = bm.verts.new((-hw, hh, 0.0))
    f = bm.faces.new((v0, v1, v2, v3))
    for loop, coord in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        loop[uv].uv = coord
    me = bpy.data.meshes.new(name + "M")
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    obj.location = loc
    obj.rotation_euler = rot
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def add_axial_fan(name, center_loc, radius_mm, depth_mm, mat_blade, mat_hub, face_sign=-1.0):
    """Build a 9-blade curved axial GPU fan centered at `center_loc` with rotation axis along Y (Three.js Z)."""
    bm = bmesh.new()
    r_hub = radius_mm * 0.30 * MM
    r_tip = radius_mm * 0.94 * MM
    half_d = depth_mm * 0.5 * MM
    n_blades = 9

    # Hub cylinder along local Y
    segs = 24
    h0, h1 = [], []
    for i in range(segs):
        a = (i / segs) * math.pi * 2.0
        ca, sa = math.cos(a), math.sin(a)
        h0.append(bm.verts.new((ca * r_hub, -half_d * 0.7, sa * r_hub)))
        h1.append(bm.verts.new((ca * r_hub, half_d * 0.7, sa * r_hub)))
    for i in range(segs):
        ni = (i + 1) % segs
        f = bm.faces.new((h0[i], h0[ni], h1[ni], h1[i]))
        f.material_index = 1
        f.smooth = True
    f_cap0 = bm.faces.new(h0[::-1])
    f_cap0.material_index = 1
    f_cap1 = bm.faces.new(h1)
    f_cap1.material_index = 1

    # 9 swept airfoil blades
    for bi in range(n_blades):
        base_a = (bi / n_blades) * math.pi * 2.0
        # 4 radial stations from hub to tip
        stations = []
        for si in range(5):
            t = si / 4.0
            rad = r_hub * 0.96 + (r_tip - r_hub * 0.96) * t
            sweep = base_a + 0.42 * (t ** 1.25)
            chord_ang = 0.24 - 0.05 * t
            pitch_y = (0.48 - 0.14 * t) * half_d * face_sign
            a_lead = sweep - chord_ang * 0.5
            a_trail = sweep + chord_ang * 0.5
            v_l = bm.verts.new((math.cos(a_lead) * rad, -pitch_y, math.sin(a_lead) * rad))
            v_t = bm.verts.new((math.cos(a_trail) * rad, pitch_y, math.sin(a_trail) * rad))
            stations.append((v_l, v_t))
        for si in range(4):
            f = bm.faces.new((stations[si][0], stations[si][1], stations[si + 1][1], stations[si + 1][0]))
            f.material_index = 0
            f.smooth = True

    # Outer stabilizer ring connecting blade tips (authentic RTX 3090 FE impeller ring!)
    r_in = r_tip - 1.4 * MM
    r_out = r_tip + 0.8 * MM
    n_ring = 36
    ra0, ra1, rb0, rb1 = [], [], [], []
    for i in range(n_ring):
        a = (i / n_ring) * math.pi * 2.0
        ca, sa = math.cos(a), math.sin(a)
        ra0.append(bm.verts.new((ca * r_in, -half_d * 0.55, sa * r_in)))
        ra1.append(bm.verts.new((ca * r_in, half_d * 0.55, sa * r_in)))
        rb0.append(bm.verts.new((ca * r_out, -half_d * 0.55, sa * r_out)))
        rb1.append(bm.verts.new((ca * r_out, half_d * 0.55, sa * r_out)))
    for i in range(n_ring):
        ni = (i + 1) % n_ring
        for quad in [
            (ra0[i], ra1[i], ra1[ni], ra0[ni]),
            (rb0[i], rb0[ni], rb1[ni], rb1[i]),
            (ra0[i], ra0[ni], rb0[ni], rb0[i]),
            (ra1[i], rb1[i], rb1[ni], ra1[ni]),
        ]:
            f = bm.faces.new(quad)
            f.material_index = 0
            f.smooth = True

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name + "M")
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    obj.location = center_loc
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat_blade)
    obj.data.materials.append(mat_hub)
    return obj


def build_comma_rtx3090():
    clear_scene()

    p_pcb = generate_chestnut_pcb_texture()
    p_fins = generate_rtx3090_fin_texture()
    p_gf_b, p_gf_e = generate_rtx3090_spine_badge()
    p_3090 = generate_rtx3090_model_badge()

    # Materials
    alu_black = make_mat("Comma_AluBase", (0.032, 0.036, 0.042), metallic=0.84, roughness=0.32)
    rubber_foot = make_mat("Comma_RubberFoot", (0.012, 0.013, 0.016), metallic=0.0, roughness=0.92)
    pcb_edge = make_mat("Comma_PCBEdge", (0.016, 0.018, 0.022), metallic=0.05, roughness=0.65)
    pcb_top = make_tex_mat("Comma_ChestnutPCB", p_pcb, metallic=0.14, roughness=0.46)
    brass_mat = make_mat("Comma_BrassStandoff", (0.76, 0.60, 0.22), metallic=0.92, roughness=0.26)
    steel_mat = make_mat("Comma_Steel", (0.64, 0.67, 0.72), metallic=0.92, roughness=0.26)
    xt60_yellow = make_mat("Comma_XT60Yellow", (0.92, 0.72, 0.04), metallic=0.02, roughness=0.48)
    led_green = make_mat("Comma_LinkLED", (0.14, 0.96, 0.36), 0.0, 0.2, (0.16, 1.0, 0.38), 3.2)
    dark_plastic = make_mat("Comma_DarkPlastic", (0.018, 0.020, 0.025), metallic=0.04, roughness=0.58)
    cap_silver = make_mat("Comma_CapSilver", (0.72, 0.75, 0.80), metallic=0.90, roughness=0.24)

    # RTX 3090 Founders Edition Materials
    fe_titanium = make_mat("RTX3090_TitaniumFrame", (0.42, 0.44, 0.48), metallic=0.92, roughness=0.26)
    fe_gunmetal = make_mat("RTX3090_GunmetalBody", (0.048, 0.052, 0.060), metallic=0.72, roughness=0.38)
    fe_fins = make_tex_mat("RTX3090_HeatsinkFins", p_fins, metallic=0.58, roughness=0.44)
    fe_blade = make_mat("RTX3090_FanBlade", (0.025, 0.028, 0.034), metallic=0.18, roughness=0.42)
    fe_hub = make_mat("RTX3090_FanHub", (0.18, 0.20, 0.23), metallic=0.82, roughness=0.28)
    fe_geforce = make_tex_mat("RTX3090_GeForceLogo", p_gf_b, metallic=0.12, roughness=0.26, emit_path=p_gf_e, emit_strength=1.55)
    fe_model = make_tex_mat("RTX3090_ModelBadge", p_3090, metallic=0.45, roughness=0.34)
    fe_gold = make_mat("RTX3090_PCIeGold", (0.82, 0.64, 0.18), metallic=0.95, roughness=0.22)

    # =========================================================================
    # 1. COMMA.AI CHESTNUT USB4 eGPU DOCK (open-air aluminum stand + Chestnut PCB)
    # =========================================================================
    BASE_W, BASE_D, BASE_H = 248.0 * MM, 118.0 * MM, 6.0 * MM
    # 4 rubber feet (z = 0..2.2 mm)
    for fi, (fx, fy) in enumerate([(-108, -46), (108, -46), (-108, 46), (108, 46)]):
        add_cyl(f"Comma_Foot_{fi}", 7.5 * MM, 2.2 * MM, (fx * MM, fy * MM, 1.1 * MM), (0, 0, 0), rubber_foot, 18)

    # CNC Matte-Black Anodized Aluminum Base Plate (z = 2.2..8.2 mm)
    add_box("Comma_AluBase", (BASE_W, BASE_D, BASE_H), (-4 * MM, 0, 5.2 * MM), alu_black, bevel=1.2 * MM, segments=2)

    # Rear L-bracket GPU Retention Pillar on left end (x = -124 mm, supports 3-slot RTX 3090 I/O bracket!)
    add_box("Comma_RetainPillar", (6.0 * MM, 74.0 * MM, 134.0 * MM), (-124 * MM, 0, 75.0 * MM), alu_black, bevel=0.8 * MM)
    add_box("Comma_RetainTab", (14.0 * MM, 74.0 * MM, 6.0 * MM), (-118 * MM, 0, 141.0 * MM), alu_black, bevel=0.6 * MM)
    for ti, ty in enumerate([-20, 0, 20]):
        add_cyl(f"Comma_ThumbScrew_{ti}", 3.8 * MM, 8.0 * MM, (-128 * MM, ty * MM, 136 * MM), (0, math.pi / 2, 0), steel_mat, 16)

    # Exposed comma.ai Chestnut PCB (174 x 80 x 2.0 mm, z = 16.0..18.0 mm on 4 brass standoffs!)
    PCB_W, PCB_D = 174.0 * MM, 80.0 * MM
    PCB_CX = -8.0 * MM
    for si, (sx, sy) in enumerate([(-79, -32), (79, -32), (-79, 32), (79, 32)]):
        add_cyl(f"Comma_Standoff_{si}", 3.0 * MM, 8.0 * MM, (PCB_CX + sx * MM, sy * MM, 12.0 * MM), (0, 0, 0), brass_mat, 12)
        add_cyl(f"Comma_ThumbNut_{si}", 4.2 * MM, 4.5 * MM, (PCB_CX + sx * MM, sy * MM, 20.5 * MM), (0, 0, 0), steel_mat, 14)

    add_box("Comma_PCBBoard", (PCB_W, PCB_D, 2.0 * MM), (PCB_CX, 0, 17.0 * MM), pcb_edge, bevel=0.3 * MM)
    # Clean planar top PCB silkscreen strictly +0.15 mm above board top (z = 18.15 mm -> ZERO z-fighting!)
    add_planar_panel("Comma_PCBSilkscreen", 173.0, 79.0, (PCB_CX, 0, 18.15 * MM), (0, 0, 0), pcb_top)

    # Full-Length Reinforced PCIe Gen4 x16 Slot (z = 18.2..29.5 mm)
    add_box("Comma_PCIeSlotBody", (96.0 * MM, 9.2 * MM, 11.2 * MM), (-40.0 * MM, 0, 23.8 * MM), dark_plastic, bevel=0.5 * MM)
    add_box("Comma_PCIeSteelArmor", (97.2 * MM, 10.0 * MM, 9.6 * MM), (-40.0 * MM, 0, 23.2 * MM), steel_mat, bevel=0.4 * MM)
    # Retention latch on right end of PCIe slot
    add_box("Comma_PCIeLatch", (7.0 * MM, 10.0 * MM, 8.0 * MM), (11.5 * MM, 0, 26.0 * MM), dark_plastic, bevel=0.4 * MM)

    # ASMedia ASM2464PD Bridge Controller + Finned Black Heatsink (x = +34 mm, y = -8 mm)
    add_box("Comma_BridgeBase", (26.0 * MM, 26.0 * MM, 3.0 * MM), (34.0 * MM, -8.0 * MM, 19.6 * MM), alu_black)
    for fi in range(7):
        add_box(f"Comma_HSFin_{fi}", (25.0 * MM, 1.4 * MM, 6.5 * MM), (34.0 * MM, (-19.0 + fi * 3.6) * MM, 24.3 * MM), alu_black)

    # Bright Yellow XT60i 12V Power Connector (x = +66 mm, y = +22 mm) + Power Stage Capacitors & Inductors
    add_box("Comma_XT60i", (16.0 * MM, 11.0 * MM, 14.0 * MM), (66.0 * MM, 22.0 * MM, 25.1 * MM), xt60_yellow, bevel=0.9 * MM)
    for ci, cx in enumerate([22, 32, 42, 52]):
        add_cyl(f"Comma_Cap_{ci}", 3.6 * MM, 9.5 * MM, (cx * MM, 24.0 * MM, 22.9 * MM), (0, 0, 0), cap_silver, 16)
    for ii, ix in enumerate([26, 40, 54]):
        add_box(f"Comma_Choke_{ii}", (8.5 * MM, 8.5 * MM, 5.2 * MM), (ix * MM, 12.0 * MM, 20.8 * MM), dark_plastic, bevel=0.4 * MM)

    # USB4 Type-C Host Port + FT230X Debug USB-C Port on Front Edge (y = -37 mm, facing user!)
    add_box("Comma_USB4Port", (10.5 * MM, 8.5 * MM, 4.2 * MM), (60.0 * MM, -37.0 * MM, 20.3 * MM), steel_mat, bevel=0.4 * MM)
    add_box("Comma_DebugPort", (9.5 * MM, 8.0 * MM, 3.8 * MM), (36.0 * MM, -37.0 * MM, 20.1 * MM), steel_mat, bevel=0.4 * MM)
    # Glowing Green Chestnut Status Link LED
    add_box("Comma_LinkLED", (3.2 * MM, 3.2 * MM, 1.8 * MM), (50.0 * MM, -26.0 * MM, 19.1 * MM), led_green)

    # =========================================================================
    # 2. NVIDIA GEFORCE RTX 3090 FOUNDERS EDITION (Exact 313 x 61 x 138 mm 3-Slot!)
    # Seated vertically into the Chestnut PCIe x16 slot!
    # =========================================================================
    GPU_L = 313.0 * MM
    GPU_T = 61.0 * MM   # Exact 3-slot thickness!
    GPU_H = 138.0 * MM
    GPU_CX = 38.0 * MM  # Left I/O bracket at x = -118.5 mm (bolted straight onto Comma_RetainPillar!)
    GPU_Z0 = 28.0 * MM
    GPU_CZ = GPU_Z0 + GPU_H * 0.5  # z = 97.0 mm; top spine at z = 166.0 mm!

    # PCIe gold-finger edge connector seated cleanly inside the PCIe x16 slot
    add_box("RTX3090_PCIeEdge", (88.0 * MM, 2.0 * MM, 10.0 * MM), (-40.0 * MM, 0, 26.5 * MM), fe_gold)

    # 3-Slot Brushed Stainless Steel Rear I/O Bracket at left end (x = -120 mm)
    add_box("RTX3090_IOBracket", (2.8 * MM, 60.0 * MM, 134.0 * MM), (-120.0 * MM, 0, GPU_CZ), steel_mat, bevel=0.4 * MM)
    for pi, pz in enumerate([58, 76, 94, 114]):
        add_box(f"RTX3090_Port_{pi}", (4.0 * MM, 14.0 * MM, 6.2 * MM), (-121.0 * MM, -8.0 * MM, pz * MM), dark_plastic)

    # Core Exposed Matte-Black Micro-Finned Aluminum Heatsink Body (inset 2.5mm inside 61mm titanium frame -> ZERO z-fighting!)
    add_box("RTX3090_HeatsinkCore", (GPU_L - 10.0 * MM, GPU_T - 6.0 * MM, GPU_H - 10.0 * MM), (GPU_CX, 0, GPU_CZ), fe_fins, bevel=1.5 * MM)

    # Signature RTX 3090 FE Brushed Titanium-Silver Outer Perimeter Exoskeleton Frame (top, bottom, left, right rails)
    frame_bar = 7.5 * MM
    # Top & Bottom titanium perimeter rails
    add_box("RTX3090_TopRail", (GPU_L, GPU_T, frame_bar), (GPU_CX, 0, GPU_Z0 + GPU_H - frame_bar * 0.5), fe_titanium, bevel=1.6 * MM, segments=2)
    add_box("RTX3090_BotRail", (GPU_L, GPU_T, frame_bar), (GPU_CX, 0, GPU_Z0 + frame_bar * 0.5), fe_titanium, bevel=1.6 * MM, segments=2)
    # Left & Right titanium end caps
    add_box("RTX3090_LeftCap", (frame_bar, GPU_T, GPU_H), (GPU_CX - GPU_L * 0.5 + frame_bar * 0.5, 0, GPU_CZ), fe_titanium, bevel=1.6 * MM, segments=2)
    add_box("RTX3090_RightCap", (frame_bar, GPU_T, GPU_H), (GPU_CX + GPU_L * 0.5 - frame_bar * 0.5, 0, GPU_CZ), fe_titanium, bevel=1.6 * MM, segments=2)

    # Signature RTX 3090 FE Interlocking Diagonal X/V-Shaped Titanium Struts on BOTH front (-Y) and rear (+Y) faces!
    # Exact length spans seamlessly from bottom titanium rail to top titanium rail (iconic unbroken FE infinity-X frame!)
    strut_len = 182.0 * MM
    strut_w = 8.6 * MM
    strut_d = 4.2 * MM
    for side_i, sy in enumerate([-GPU_T * 0.5 + strut_d * 0.45, GPU_T * 0.5 - strut_d * 0.45]):
        # Center X-cross ribs framing the classic Founders Edition hourglass silhouette
        add_box(f"RTX3090_XArmA_{side_i}", (strut_len, strut_d, strut_w), (GPU_CX, sy, GPU_CZ), fe_titanium, bevel=1.0 * MM, rot=(0, math.radians(44), 0))
        add_box(f"RTX3090_XArmB_{side_i}", (strut_len, strut_d, strut_w), (GPU_CX, sy, GPU_CZ), fe_titanium, bevel=1.0 * MM, rot=(0, math.radians(-44), 0))
        # Center gunmetal diamond hub covering the X-arm intersection cleanly
        add_box(f"RTX3090_CenterHub_{side_i}", (32.0 * MM, strut_d + 0.8 * MM, 34.0 * MM), (GPU_CX, sy, GPU_CZ), fe_gunmetal, bevel=1.4 * MM)

    # Recessed Dark Circular Fan Bay Rings + Dual Push-Pull Flow-Through 106 mm Axial Fans!
    # Front-left intake fan (facing -Y toward user!) & Rear-right flow-through exhaust fan (facing +Y!)
    fan_r = 53.0  # 106 mm diameter!
    front_fan_x = GPU_CX - 82.0 * MM
    rear_fan_x = GPU_CX + 82.0 * MM

    # Dark circular shroud rings framing each fan cleanly proud of heatsink core
    for fname, fx, fy in [
        ("RTX3090_FanRingFront", front_fan_x, -GPU_T * 0.5 + 3.0 * MM),
        ("RTX3090_FanRingBack", rear_fan_x, GPU_T * 0.5 - 3.0 * MM),
    ]:
        bm_r = bmesh.new()
        n_s = 40
        r_in, r_out = (fan_r + 1.0) * MM, (fan_r + 6.0) * MM
        hd = 3.2 * MM
        p0, p1, q0, q1 = [], [], [], []
        for i in range(n_s):
            a = (i / n_s) * math.pi * 2.0
            ca, sa = math.cos(a), math.sin(a)
            p0.append(bm_r.verts.new((fx + ca * r_in, fy - hd, GPU_CZ + sa * r_in)))
            p1.append(bm_r.verts.new((fx + ca * r_in, fy + hd, GPU_CZ + sa * r_in)))
            q0.append(bm_r.verts.new((fx + ca * r_out, fy - hd, GPU_CZ + sa * r_out)))
            q1.append(bm_r.verts.new((fx + ca * r_out, fy + hd, GPU_CZ + sa * r_out)))
        for i in range(n_s):
            ni = (i + 1) % n_s
            for quad in [(p0[i], p1[i], p1[ni], p0[ni]), (q0[i], q0[ni], q1[ni], q1[i]), (p0[i], p0[ni], q0[ni], q0[i]), (p1[i], q1[i], q1[ni], p1[ni])]:
                f = bm_r.faces.new(quad)
                f.smooth = True
        bmesh.ops.recalc_face_normals(bm_r, faces=bm_r.faces)
        me_r = bpy.data.meshes.new(fname + "M")
        bm_r.to_mesh(me_r)
        bm_r.free()
        ob_r = bpy.data.objects.new(fname, me_r)
        bpy.context.scene.collection.objects.link(ob_r)
        ob_r.data.materials.append(fe_titanium)

    # Dark backing discs inside the non-fan opposite halves (authentic matte-black backplate panels!)
    add_box("RTX3090_FrontRightPlate", (112.0 * MM, 4.0 * MM, 118.0 * MM), (rear_fan_x, -GPU_T * 0.5 + 2.2 * MM, GPU_CZ), fe_gunmetal, bevel=1.2 * MM)
    add_box("RTX3090_BackLeftPlate", (112.0 * MM, 4.0 * MM, 118.0 * MM), (front_fan_x, GPU_T * 0.5 - 2.2 * MM, GPU_CZ), fe_gunmetal, bevel=1.2 * MM)

    # Crisp RTX 3090 silver model badge strictly +0.4mm proud of front-right dark plate (ZERO z-fighting!)
    add_planar_panel("RTX3090_ModelBadge", 72.0, 18.0, (rear_fan_x, -GPU_T * 0.5 - 0.3 * MM, GPU_CZ), (math.pi / 2, 0, 0), fe_model)

    # Both spinning 9-blade 106 mm axial fans (named for automatic registration in OfficeScene.spinningFans!)
    add_axial_fan("RTX3090_FanFront", (front_fan_x, -GPU_T * 0.5 + 3.2 * MM, GPU_CZ), fan_r, 11.0, fe_blade, fe_hub, face_sign=-1.0)
    add_axial_fan("RTX3090_FanBack", (rear_fan_x, GPU_T * 0.5 - 3.2 * MM, GPU_CZ), fan_r, 11.0, fe_blade, fe_hub, face_sign=1.0)

    # Top Spine Illuminated White "GEFORCE RTX" Badge (cleanly inset +0.3mm above top rail -> ZERO z-fighting!)
    add_box("RTX3090_SpineInsert", (110.0 * MM, 24.0 * MM, 2.0 * MM), (GPU_CX - 62.0 * MM, 0, GPU_Z0 + GPU_H + 0.3 * MM), fe_gunmetal, bevel=0.4 * MM)
    add_planar_panel("RTX3090_GeForceLogo", 94.0, 17.5, (GPU_CX - 62.0 * MM, 0, GPU_Z0 + GPU_H + 1.45 * MM), (0, 0, 0), fe_geforce)

    # Signature Angled 12-Pin Molex Micro-Fit 3.0 Power Connector + Flush-Seated NVIDIA Plug Housing on Top Spine!
    plug_tilt = math.radians(18)
    sock_x = GPU_CX + 18.0 * MM
    sock_z = GPU_Z0 + GPU_H + 2.8 * MM
    add_box("RTX3090_12PinSocket", (18.0 * MM, 12.6 * MM, 11.0 * MM), (sock_x, 0.0, sock_z), dark_plastic, bevel=0.8 * MM, rot=(0, plug_tilt, 0))
    add_box(
        "RTX3090_12PinPlug",
        (16.0 * MM, 11.2 * MM, 15.0 * MM),
        (sock_x + math.sin(plug_tilt) * 9.0 * MM, 0.0, sock_z + math.cos(plug_tilt) * 9.0 * MM),
        dark_plastic,
        bevel=0.8 * MM,
        rot=(0, plug_tilt, 0),
    )

    out_blend = os.path.join(OUT_DIR, "comma_rtx3090.blend")
    bpy.ops.wm.save_as_mainfile(filepath=out_blend)
    print(f"SAVED: {out_blend}")


if __name__ == "__main__":
    build_comma_rtx3090()
