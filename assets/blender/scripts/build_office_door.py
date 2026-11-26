#!/usr/bin/env python3
"""Build a realistic architectural executive office entrance door in headless Blender.

Geometry & PBR material modeling only (rendered live in Three.js — ZERO Blender Cycles rendering!).
Specs:
- Standard US architectural 36" x 84" (914 x 2134 mm) oiled American walnut 3-panel modern door
- Mitered solid walnut casing/architrave trim + deep recessed jamb & 4mm operable shadow reveal
- Brushed-brass architectural lever handle on round rosette + deadbolt thumbturn + 3 butt hinges
- Brushed-brass floor threshold saddle + cylindrical brass/rubber doorstop
- Modern screwless wall light-switch / dimmer plate beside the latch casing

Coordinate convention (Blender Z-up -> glTF/Three.js Y-up):
- Wall plane back at Y = 0, room-facing front protruding toward -Y (maps to +Z in Three.js)
- Floor at Z = 0, centered on X = 0
- Hinges on +X, latch handle + light switch on -X
"""
import math
import os
import random
import bpy
from PIL import Image, ImageDraw

MM = 0.001
OUT_DIR = os.path.abspath("/workspace/assets/blender")
TEX_DIR = os.path.join(OUT_DIR, "textures")
os.makedirs(TEX_DIR, exist_ok=True)


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0


def generate_walnut_door_textures():
    """Generate silky, photorealistic oiled American walnut wood color & satin roughness textures (ZERO harsh zigzags!)."""
    W, H = 1024, 1024
    rng = random.Random(2134)
    col = Image.new("RGB", (W, H), (84, 50, 27))
    rgh = Image.new("L", (W, H), 138)
    cd = ImageDraw.Draw(col)
    rd = ImageDraw.Draw(rgh)

    # Smooth subtle multi-frequency vertical wood grain bands (silky natural walnut!)
    for x in range(0, W):
        w1 = math.sin(x * 0.022) * 7.5
        w2 = math.sin(x * 0.068 + 1.3) * 4.2
        w3 = math.sin(x * 0.19 + 0.4) * 2.2
        tone = int(w1 + w2 + w3 + rng.gauss(0, 1.4))
        r = max(46, min(116, 84 + tone))
        g = max(26, min(72, 50 + int(tone * 0.62)))
        b = max(14, min(42, 27 + int(tone * 0.36)))
        cd.line((x, 0, x, H), fill=(r, g, b), width=1)
        rv = max(112, min(168, 138 - int(tone * 0.8)))
        rd.line((x, 0, x, H), fill=rv, width=1)

    # Ultra-fine subtle straight wood pores (soft low-contrast micro-detail, zero jagged squiggles!)
    for _ in range(900):
        x0 = rng.randint(0, W - 1)
        y0 = rng.randint(0, H - 1)
        length = rng.randint(35, 190)
        dark = rng.random() > 0.30
        c_line = (58, 33, 17) if dark else (98, 62, 35)
        cd.line((x0, y0, x0, min(H - 1, y0 + length)), fill=c_line, width=1)
        rd.line((x0, y0, x0, min(H - 1, y0 + length)), fill=158 if dark else 124, width=1)

    p_col = os.path.join(TEX_DIR, "office_door_walnut_col.png")
    p_rgh = os.path.join(TEX_DIR, "office_door_walnut_rgh.png")
    col.save(p_col)
    rgh.save(p_rgh)
    return p_col, p_rgh


def make_mat(name, color, metallic=0.0, roughness=0.5, emit=None, emit_strength=0.0):
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


def make_walnut_mat(name, p_col, p_rgh, tint=(1.0, 1.0, 1.0)):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Metallic"].default_value = 0.02

    tex_c = nt.nodes.new("ShaderNodeTexImage")
    img_c = bpy.data.images.load(p_col)
    img_c.pack()
    tex_c.image = img_c

    if tint != (1.0, 1.0, 1.0):
        mix = nt.nodes.new("ShaderNodeMixRGB")
        mix.blend_type = "MULTIPLY"
        mix.inputs["Fac"].default_value = 1.0
        mix.inputs["Color2"].default_value = (*tint, 1.0)
        nt.links.new(tex_c.outputs["Color"], mix.inputs["Color1"])
        nt.links.new(mix.outputs["Color"], bsdf.inputs["Base Color"])
    else:
        nt.links.new(tex_c.outputs["Color"], bsdf.inputs["Base Color"])

    tex_r = nt.nodes.new("ShaderNodeTexImage")
    img_r = bpy.data.images.load(p_rgh)
    img_r.colorspace_settings.name = "Non-Color"
    img_r.pack()
    tex_r.image = img_r
    nt.links.new(tex_r.outputs["Color"], bsdf.inputs["Roughness"])
    return mat


def add_box(name, size, loc, mat, bevel=0.0, segments=2, rot=(0, 0, 0), smooth=False):
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
    if smooth:
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


def build_office_door():
    clear_scene()
    p_col, p_rgh = generate_walnut_door_textures()

    walnut_slab = make_walnut_mat("Door_WalnutSlab", p_col, p_rgh, tint=(0.94, 0.90, 0.86))
    walnut_panel = make_walnut_mat("Door_WalnutPanel", p_col, p_rgh, tint=(0.76, 0.72, 0.68))
    walnut_trim = make_walnut_mat("Door_WalnutTrim", p_col, p_rgh, tint=(0.82, 0.78, 0.74))
    jamb_shadow = make_mat("Door_ShadowGap", (0.015, 0.012, 0.010), metallic=0.0, roughness=0.92)
    brass = make_mat("Door_BrushedBrass", (0.76, 0.58, 0.28), metallic=0.90, roughness=0.30)
    brass_dark = make_mat("Door_BronzeAccent", (0.28, 0.22, 0.14), metallic=0.82, roughness=0.38)
    rubber_blk = make_mat("Door_RubberTip", (0.04, 0.04, 0.05), metallic=0.0, roughness=0.88)
    switch_plate = make_mat("Door_SwitchPlate", (0.86, 0.82, 0.76), metallic=0.0, roughness=0.42)
    switch_rocker = make_mat("Door_SwitchRocker", (0.08, 0.09, 0.11), metallic=0.10, roughness=0.38)
    switch_led = make_mat("Door_SwitchLED", (1.0, 0.76, 0.36), 0.0, 0.2, (1.0, 0.72, 0.30), 1.8)

    DOOR_W = 914 * MM
    DOOR_H = 2134 * MM
    CASING_W = 86 * MM
    CASING_D = 22 * MM
    JAMB_D = 42 * MM

    # 1. Dark recessed inner door reveal backing (sits flush at Y = -2mm so 4mm shadow gaps around slab look deeply recessed!)
    add_box("Door_RecessBack", (DOOR_W + 24 * MM, 6 * MM, DOOR_H + 12 * MM), (0, -3 * MM, (DOOR_H + 12 * MM) * 0.5), jamb_shadow)

    # 2. Inner Door Jambs & Mitered Solid Walnut Architectural Casing / Architrave Trim
    # Inner jamb rails
    add_box("Door_JambL", (22 * MM, JAMB_D, DOOR_H + 16 * MM), (-DOOR_W * 0.5 - 11 * MM, -JAMB_D * 0.5, (DOOR_H + 16 * MM) * 0.5), walnut_trim, bevel=1.5 * MM)
    add_box("Door_JambR", (22 * MM, JAMB_D, DOOR_H + 16 * MM), (DOOR_W * 0.5 + 11 * MM, -JAMB_D * 0.5, (DOOR_H + 16 * MM) * 0.5), walnut_trim, bevel=1.5 * MM)
    add_box("Door_JambTop", (DOOR_W + 44 * MM, JAMB_D, 22 * MM), (0, -JAMB_D * 0.5, DOOR_H + 11 * MM), walnut_trim, bevel=1.5 * MM)

    # Outer architectural casing trim (86mm wide x 22mm thick protruding from wall)
    casing_y = -CASING_D * 0.5 - 18 * MM
    add_box("Door_CasingL", (CASING_W, CASING_D, DOOR_H + CASING_W), (-DOOR_W * 0.5 - CASING_W * 0.5 - 8 * MM, casing_y, (DOOR_H + CASING_W) * 0.5), walnut_trim, bevel=2.8 * MM)
    add_box("Door_CasingR", (CASING_W, CASING_D, DOOR_H + CASING_W), (DOOR_W * 0.5 + CASING_W * 0.5 + 8 * MM, casing_y, (DOOR_H + CASING_W) * 0.5), walnut_trim, bevel=2.8 * MM)
    add_box("Door_CasingTop", (DOOR_W + CASING_W * 2 + 16 * MM, CASING_D + 2 * MM, CASING_W), (0, casing_y - 1 * MM, DOOR_H + CASING_W * 0.5 + 4 * MM), walnut_trim, bevel=3.0 * MM)

    # 3. Solid Oiled American Walnut 3-Panel Architectural Door Slab (with crisp 4mm shadow gap inside jamb!)
    slab_w = DOOR_W - 8 * MM
    slab_h = DOOR_H - 12 * MM
    slab_z0 = 10 * MM
    slab_front_y = -32 * MM
    stile_w = 122 * MM

    # Core recessed center backing behind the 3 architectural panels
    add_box("Door_PanelCore", (slab_w - 6 * MM, 18 * MM, slab_h - 6 * MM), (0, slab_front_y + 18 * MM, slab_z0 + slab_h * 0.5), walnut_panel)

    # Left & Right full-height vertical stiles
    add_box("Door_StileL", (stile_w, 26 * MM, slab_h), (-slab_w * 0.5 + stile_w * 0.5, slab_front_y + 13 * MM, slab_z0 + slab_h * 0.5), walnut_slab, bevel=2.2 * MM)
    add_box("Door_StileR", (stile_w, 26 * MM, slab_h), (slab_w * 0.5 - stile_w * 0.5, slab_front_y + 13 * MM, slab_z0 + slab_h * 0.5), walnut_slab, bevel=2.2 * MM)

    # Horizontal rails (bottom kick rail, 2 intermediate muntin rails, top rail) framing 3 recessed modern panels!
    inner_w = slab_w - stile_w * 2 + 4 * MM
    rail_specs = [
        ("Door_RailBot", 210 * MM, slab_z0 + 105 * MM),
        ("Door_RailMid1", 110 * MM, slab_z0 + 755 * MM),
        ("Door_RailMid2", 110 * MM, slab_z0 + 1415 * MM),
        ("Door_RailTop", 125 * MM, slab_z0 + slab_h - 62.5 * MM),
    ]
    for rname, rh, rz in rail_specs:
        add_box(rname, (inner_w, 26 * MM, rh), (0, slab_front_y + 13 * MM, rz), walnut_slab, bevel=2.2 * MM)

    # Subtle stepped recessed chamfer frame moldings inside each of the 3 architectural panels
    panel_z_ranges = [
        (slab_z0 + 210 * MM, slab_z0 + 700 * MM),
        (slab_z0 + 810 * MM, slab_z0 + 1360 * MM),
        (slab_z0 + 1470 * MM, slab_z0 + slab_h - 125 * MM),
    ]
    pw = slab_w - stile_w * 2 - 22 * MM
    for pi, (za, zb) in enumerate(panel_z_ranges):
        ph = zb - za - 22 * MM
        zc = (za + zb) * 0.5
        add_box(f"Door_PanelInsert_{pi}", (pw, 12 * MM, ph), (0, slab_front_y + 11 * MM, zc), walnut_panel, bevel=3.5 * MM)

    # 4. Brushed-Brass Architectural Floor Threshold Saddle Strip
    add_box("Door_Threshold", (DOOR_W + 24 * MM, 62 * MM, 8 * MM), (0, -28 * MM, 4 * MM), brass_dark, bevel=2.2 * MM)

    # 5. Brushed-Brass Executive Lever Handle + Round Rosette + Deadbolt Thumbturn (on -X latch stile)
    hx = -slab_w * 0.5 + 64 * MM
    hz = 980 * MM
    # Round beveled escutcheon rosette
    add_cyl("Handle_RoseBase", 32 * MM, 9 * MM, (hx, slab_front_y - 4.5 * MM, hz), (math.pi / 2, 0, 0), brass, 32)
    add_cyl("Handle_Neck", 11 * MM, 36 * MM, (hx, slab_front_y - 24 * MM, hz), (math.pi / 2, 0, 0), brass, 24)
    # Ergonomic swept brushed-brass architectural lever pointing toward +X (center of door)
    add_box("Handle_LeverBar", (128 * MM, 11 * MM, 20 * MM), (hx + 56 * MM, slab_front_y - 44 * MM, hz), brass, bevel=3.5 * MM, segments=3, smooth=True)
    add_cyl("Handle_LeverElbow", 10.5 * MM, 14 * MM, (hx, slab_front_y - 43 * MM, hz), (math.pi / 2, 0, 0), brass, 20)

    # Matching upper brushed-brass deadbolt / privacy thumbturn
    dz = 1105 * MM
    add_cyl("Deadbolt_Rose", 28 * MM, 9 * MM, (hx, slab_front_y - 4.5 * MM, dz), (math.pi / 2, 0, 0), brass, 32)
    add_cyl("Deadbolt_Core", 12 * MM, 16 * MM, (hx, slab_front_y - 12 * MM, dz), (math.pi / 2, 0, 0), brass_dark, 24)
    add_box("Deadbolt_Thumbturn", (10 * MM, 18 * MM, 34 * MM), (hx, slab_front_y - 22 * MM, dz), brass, bevel=2.5 * MM, smooth=True)

    # 6. Three Brushed-Brass Ball-Bearing Butt Hinges along the +X Hinge Jamb
    hinge_x = DOOR_W * 0.5 - 1 * MM
    hinge_y = slab_front_y - 4 * MM
    for hi, hgz in enumerate([280 * MM, 1070 * MM, 1860 * MM]):
        add_cyl(f"Door_HingeBarrel_{hi}", 7.2 * MM, 102 * MM, (hinge_x, hinge_y, hgz), (0, 0, 0), brass, 18)
        add_cyl(f"Door_HingeCapTop_{hi}", 8.0 * MM, 6 * MM, (hinge_x, hinge_y, hgz + 53 * MM), (0, 0, 0), brass_dark, 18)
        add_cyl(f"Door_HingeCapBot_{hi}", 8.0 * MM, 6 * MM, (hinge_x, hinge_y, hgz - 53 * MM), (0, 0, 0), brass_dark, 18)

    # 7. Cylindrical Brushed-Brass Wall Doorstop with Rubber Bumper Tip beside Hinge Casing
    ds_x = DOOR_W * 0.5 + CASING_W + 58 * MM
    add_cyl("Doorstop_Base", 15 * MM, 6 * MM, (ds_x, -3 * MM, 85 * MM), (math.pi / 2, 0, 0), brass, 20)
    add_cyl("Doorstop_Stem", 7.5 * MM, 74 * MM, (ds_x, -40 * MM, 85 * MM), (math.pi / 2, 0, 0), brass, 18)
    add_cyl("Doorstop_Tip", 9.5 * MM, 12 * MM, (ds_x, -78 * MM, 85 * MM), (math.pi / 2, 0, 0), rubber_blk, 18)

    # 8. Modern Screwless Architectural Wall Light Switch / Dimmer Plate beside Latch Casing (-X)
    sw_x = -DOOR_W * 0.5 - CASING_W - 115 * MM
    sw_z = 1140 * MM
    add_box("WallSwitch_Plate", (116 * MM, 9 * MM, 118 * MM), (sw_x, -4.5 * MM, sw_z), switch_plate, bevel=1.8 * MM)
    for si, sx_off in enumerate([-24 * MM, 24 * MM]):
        add_box(f"WallSwitch_Recess_{si}", (34 * MM, 10 * MM, 68 * MM), (sw_x + sx_off, -5.5 * MM, sw_z), jamb_shadow)
        add_box(f"WallSwitch_Rocker_{si}", (30 * MM, 11 * MM, 64 * MM), (sw_x + sx_off, -9.0 * MM, sw_z), switch_rocker, bevel=1.2 * MM, rot=(math.radians(4.5), 0, 0))
    add_box("WallSwitch_DimmerLED", (10 * MM, 4 * MM, 3.0 * MM), (sw_x - 24 * MM, -14.2 * MM, sw_z - 20 * MM), switch_led)

    out_blend = os.path.join(OUT_DIR, "office_door.blend")
    bpy.ops.wm.save_as_mainfile(filepath=out_blend)
    print(f"SAVED: {out_blend}")


if __name__ == "__main__":
    build_office_door()
