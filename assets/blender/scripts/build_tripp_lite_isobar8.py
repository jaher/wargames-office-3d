#!/usr/bin/env python3
"""Build a studio-grade Tripp Lite (Eaton) ISOBAR8ULTRA 8-Outlet Surge Suppressor in headless Blender.

Geometry & PBR material modeling only (rendered live in Three.js in the browser — ZERO Blender Cycles rendering!).
Exact real-world Tripp Lite ISOBAR8ULTRA specifications:
- Heavy-duty all-metal light-grey steel housing: 235 x 90 x 65 mm (9.28" x 3.56" x 2.57")
- Ribbed/stamped industrial steel top with mounting keyhole flanges at both ends
- 8 black NEMA 5-15R grounded AC outlets arranged in 4 widely-spaced isolated filter banks (2 outlets per bank)
- Red-illuminated rocker power switch with safety guard + integrated 12A circuit breaker
- 3 diagnostic status LEDs: LINE OK (green), PROTECTION PRESENT (green), LINE FAULT (off/dark)
- Crisp silkscreened TRIPP LITE / ISOBAR 8 ULTRA / ISOLATED FILTER BANKS top faceplate
- Heavy-duty black strain-relief boot for the 12-foot power cord

Outputs:
  assets/blender/tripp_lite_isobar8.blend
"""
import math
import os
import bpy
from PIL import Image, ImageDraw, ImageFont

MM = 0.001
W = 235.0 * MM
D = 90.0 * MM
H = 65.0 * MM

OUT_DIR = os.path.abspath("/workspace/assets/blender")
TEX_DIR = os.path.join(OUT_DIR, "textures")
os.makedirs(TEX_DIR, exist_ok=True)


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0


def generate_top_texture():
    tw, th = 1024, 384
    img = Image.new("RGB", (tw, th), (192, 194, 190))
    d = ImageDraw.Draw(img)
    # Subtle industrial powder-coat metal border & bank divider lines
    d.rectangle((8, 8, tw - 9, th - 9), outline=(146, 148, 144), width=5)
    # Dark control-strip silkscreen panel on the left end (power switch + 3 diagnostic LEDs)
    d.rounded_rectangle((22, 26, 224, th - 26), radius=10, fill=(36, 39, 44), outline=(92, 96, 102), width=3)
    try:
        f_brand = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 34)
        f_model = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 26)
        f_sm = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 17)
        f_xs = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 13)
    except Exception:
        f_brand = f_model = f_sm = f_xs = ImageFont.load_default()

    # Crisp Tripp Lite ISOBAR 8 ULTRA header strip along the front edge
    d.text((246, 20), "TRIPP LITE", fill=(28, 32, 38), font=f_brand)
    d.text((466, 24), "ISOBAR 8 ULTRA", fill=(168, 28, 28), font=f_model)
    d.text((734, 30), "ISOLATED FILTER BANKS", fill=(62, 66, 72), font=f_sm)
    d.line((242, 64, tw - 24, 64), fill=(116, 120, 124), width=3)

    # 4 Isolated Filter Bank brackets & labels
    bank_xs = [278, 456, 634, 812]
    for bi, bx in enumerate(bank_xs):
        d.line((bx - 22, 74, bx - 22, th - 26), fill=(154, 158, 154), width=2)
        d.text((bx + 56, th - 36), f"BANK {bi + 1}", fill=(58, 62, 68), font=f_xs, anchor="mm")

    # Left control-panel labels
    d.text((123, 52), "POWER / 12A", fill=(214, 218, 224), font=f_xs, anchor="mm")
    d.text((123, 210), "DIAGNOSTIC", fill=(180, 186, 194), font=f_xs, anchor="mm")
    d.text((64, 326), "PROT", fill=(164, 214, 174), font=f_xs, anchor="mm")
    d.text((123, 326), "FAULT", fill=(214, 146, 146), font=f_xs, anchor="mm")
    d.text((182, 326), "OK", fill=(164, 214, 174), font=f_xs, anchor="mm")

    p_top = os.path.join(TEX_DIR, "tripp_lite_isobar8_top.png")
    img.save(p_top)
    return p_top


def make_mat(name, color, metallic=0.4, roughness=0.45, emit=None, emit_strength=0.0):
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


def make_tex_mat(name, path, metallic=0.35, roughness=0.44):
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


def add_cyl(name, r, depth, loc, rot, mat, verts=18):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(mat)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def build_isobar8():
    clear_scene()
    p_top = generate_top_texture()

    # Classic Tripp Lite ISOBAR8ULTRA industrial light-grey powder-coated all-metal steel body
    steel_grey = make_mat("Isobar_SteelGrey", (0.50, 0.51, 0.49), metallic=0.42, roughness=0.46)
    steel_flange = make_mat("Isobar_FlangeSteel", (0.44, 0.45, 0.43), metallic=0.48, roughness=0.42)
    top_plate_mat = make_tex_mat("Isobar_TopFace", p_top, metallic=0.35, roughness=0.45)
    outlet_black = make_mat("Isobar_OutletBlack", (0.018, 0.020, 0.024), metallic=0.05, roughness=0.62)
    slot_dark = make_mat("Isobar_SlotDark", (0.004, 0.005, 0.006), metallic=0.0, roughness=0.95)
    rubber_cord = make_mat("Isobar_RubberBoot", (0.014, 0.015, 0.018), metallic=0.0, roughness=0.88)
    red_switch = make_mat("Isobar_RedSwitch", (0.78, 0.06, 0.04), metallic=0.05, roughness=0.26, emit=(0.95, 0.14, 0.06), emit_strength=1.8)
    led_green = make_mat("Isobar_LEDGreen", (0.12, 0.88, 0.34), metallic=0.0, roughness=0.22, emit=(0.14, 0.95, 0.38), emit_strength=2.4)
    led_off = make_mat("Isobar_LEDOff", (0.12, 0.04, 0.04), metallic=0.0, roughness=0.32)
    screw_metal = make_mat("Isobar_Screw", (0.68, 0.70, 0.74), metallic=0.90, roughness=0.25)

    # 1. Heavy-duty all-metal rectangular steel enclosure + end mounting flanges + rubber feet
    add_box("Isobar_MainBody", (W, D, H - 3 * MM), (0, 0, H * 0.5 + 1.5 * MM), steel_grey, bevel=3.2 * MM, segments=3)
    for sx in (-1, 1):
        # Industrial stamped steel mounting keyhole tabs at both ends
        add_box(f"Isobar_Flange_{sx}", (14 * MM, D - 8 * MM, 4 * MM), (sx * (W * 0.5 + 5 * MM), 0, 5 * MM), steel_flange, bevel=0.8 * MM)
        add_cyl(f"Isobar_Keyhole_{sx}", 3.5 * MM, 4.5 * MM, (sx * (W * 0.5 + 6 * MM), 0, 5 * MM), (0, 0, 0), slot_dark, 14)
        for sy in (-1, 1):
            add_cyl(f"Isobar_Foot_{sx}_{sy}", 7 * MM, 3 * MM, (sx * (W * 0.5 - 16 * MM), sy * (D * 0.5 - 14 * MM), 1.5 * MM), (0, 0, 0), rubber_cord, 14)

    # Ribbed industrial top faceplate with silkscreened markings
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0, 0, H + 0.3 * MM))
    tp = bpy.context.active_object
    tp.name = "Isobar_TopPlate"
    tp.scale = (W - 8 * MM, D - 8 * MM, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    tp.data.materials.append(top_plate_mat)

    # 2. Left Control Panel: Red-Illuminated Rocker Power Switch + Protective Bezel + 3 Diagnostic LEDs
    sw_x = -W * 0.5 + 31 * MM
    add_box("Isobar_SwitchGuard", (20 * MM, 26 * MM, 7 * MM), (sw_x, 8 * MM, H + 3.0 * MM), outlet_black, bevel=1.2 * MM)
    add_box("Isobar_RedRocker", (12 * MM, 18 * MM, 7 * MM), (sw_x, 8 * MM, H + 5.2 * MM), red_switch, bevel=1.0 * MM, rot=(0.14, 0, 0))
    # 3 Diagnostic Status LEDs (PROT=green, FAULT=off, LINE OK=green)
    for lx, lmat, lname in [
        (sw_x - 13 * MM, led_green, "LED_Prot"),
        (sw_x, led_off, "LED_Fault"),
        (sw_x + 13 * MM, led_green, "LED_OK"),
    ]:
        add_cyl(f"Isobar_{lname}Ring", 3.4 * MM, 2.2 * MM, (lx, -18 * MM, H + 1.1 * MM), (0, 0, 0), outlet_black, 14)
        add_cyl(f"Isobar_{lname}", 2.3 * MM, 3.0 * MM, (lx, -18 * MM, H + 1.6 * MM), (0, 0, 0), lmat, 14)

    # 3. 8 Black Grounded NEMA 5-15R AC Outlets arranged in 4 Widely-Spaced Isolated Filter Banks (2 rows x 4 banks!)
    bank_xs = [-W * 0.5 + 78 * MM + i * 41 * MM for i in range(4)]
    for bi, bx in enumerate(bank_xs):
        for ri, by in enumerate([16 * MM, -18 * MM]):
            # Molded black NEMA 5-15R receptacle block
            add_box(f"Isobar_Outlet_{bi}_{ri}", (25 * MM, 26 * MM, 4.2 * MM), (bx, by, H + 2.0 * MM), outlet_black, bevel=1.4 * MM)
            # Hot, Neutral & Ground prong slots
            add_box(f"Isobar_SlotN_{bi}_{ri}", (2.2 * MM, 7.6 * MM, 1.5 * MM), (bx - 5.5 * MM, by + 2.5 * MM, H + 4.1 * MM), slot_dark)
            add_box(f"Isobar_SlotH_{bi}_{ri}", (2.2 * MM, 6.2 * MM, 1.5 * MM), (bx + 5.5 * MM, by + 2.5 * MM, H + 4.1 * MM), slot_dark)
            add_cyl(f"Isobar_SlotG_{bi}_{ri}", 2.2 * MM, 1.5 * MM, (bx, by - 5.5 * MM, H + 4.1 * MM), (0, 0, 0), slot_dark, 12)

    # Corner chassis screws + heavy-duty black cord strain-relief boot on the left end (-X)
    for sx in (-1, 1):
        for sy in (-1, 1):
            add_cyl(f"Isobar_Screw_{sx}_{sy}", 2.2 * MM, 1.6 * MM, (sx * (W * 0.5 - 7 * MM), sy * (D * 0.5 - 7 * MM), H + 0.6 * MM), (0, 0, 0), screw_metal, 12)
    add_cyl("Isobar_CordBoot", 7.8 * MM, 26 * MM, (-W * 0.5 - 10 * MM, 0, 26 * MM), (0, math.pi / 2, 0), rubber_cord, 16)

    out_blend = os.path.join(OUT_DIR, "tripp_lite_isobar8.blend")
    bpy.ops.wm.save_as_mainfile(filepath=out_blend)
    print(f"SAVED: {out_blend}")


if __name__ == "__main__":
    build_isobar8()
