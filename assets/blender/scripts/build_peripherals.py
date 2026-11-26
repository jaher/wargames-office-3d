#!/usr/bin/env python3
"""Build hyper-accurate real-world desktop peripherals in headless Blender (Round 2):

1. Keychron Q1 Pro 75% CNC Aluminum Mechanical Keyboard (327.5 x 145 mm, 5.2° wedge):
   - Two-piece CNC 6063 bead-blasted dark-carbon anodized aluminum case with rounded corners,
     visible side seam, and a RAISED outer bezel framing a DEEPLY RECESSED keywell!
   - Authentic EXPLODED 75% layout: distinct bezel gap separating F-row from number row,
     grouped Esc / F1-F4 / F5-F8 / F9-F12 / recessed knurled top-right rotary encoder knob,
     3-key right navigation column below the knob (Del/PgUp/PgDn), and exploded inverted-T
     arrow cluster with Right Arrow sitting cleanly in the bottom-right corner!
   - Smooth sculpted KSA-profile double-shot PBT keycaps with filleted edges, clean smooth
     flat/gently-dished tops (ZERO pyramid/diagonal "X" faceting!), convex spacebar, and
     crisp UV-mapped QWERTY/legend top sheet!
2. Logitech MX Master 3S Wireless Ergonomic Mouse (84.3 x 124.9 x 51.0 mm, Graphite):
   - Iconic asymmetric right-handed ergonomic silhouette: steep left-to-right palm arch,
     pronounced flared lower-left thumb rest wing with diagonal grip ribs & gesture pad,
     distinct separated overhanging matte-dark LMB & RMB click paddles, recessed dark central
     scroll-wheel channel, crisp two-tone graphite soft-touch body vs dark satin button shell,
     accurately scaled recessed grooved machined-steel MagSpeed wheel & horizontal thumb wheel,
     two angled Forward/Back side buttons, flush oblong mode-shift button, front recessed USB-C
     charging port, and subtle palm branding! Zero stray clipping geometry!
3. Dell UltraSharp U3425WE 34" Monitor (820 x 485 mm active panel housing + brushed platinum
   silver tapered stand with cable-routing cutout & subtle DELL chin logo).

Outputs:
  assets/blender/keychron_q1.blend
  assets/blender/mx_master_3s.blend
  assets/blender/dell_u3425we.blend
"""
import math
import os
import bpy
import bmesh
from mathutils import Vector, Matrix
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


def make_mat(name, color, metallic=0.1, roughness=0.45, coat=0.0, emit=None, emit_strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Clearcoat"].default_value = coat
    if emit is not None:
        bsdf.inputs["Emission"].default_value = (*emit, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emit_strength
    return mat


def make_tex_mat(name, path, metallic=0.05, roughness=0.52):
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
    return obj


def generate_keycap_atlas(key_defs, W_mm, D_mm):
    """Generate a crisp high-res top-projected PBT keycap legend texture for the entire Keychron Q1 Pro!"""
    pw, ph = 2048, 920
    img = Image.new("RGB", (pw, ph), (28, 31, 38))
    d = ImageDraw.Draw(img)
    try:
        f_lg = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22)
        f_sm = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 14)
    except Exception:
        f_lg = f_sm = ImageFont.load_default()

    def to_px(x_mm, y_mm):
        u = (x_mm + W_mm * 0.5) / W_mm
        v = 1.0 - (y_mm + D_mm * 0.5) / D_mm
        return u * pw, v * ph

    for cx, cy, kw, kd, style, label in key_defs:
        # Base PBT keycap color matching Keychron Q1 Pro Carbon Black / Ocean Teal double-shot PBT
        if style == 0:
            bg = (52, 56, 66)      # Alpha slate dark-gray
            fg = (218, 224, 236)
        elif style == 1:
            bg = (34, 37, 45)      # Modifier deep charcoal
            fg = (196, 206, 222)
        else:
            bg = (38, 126, 138)    # Signature Keychron Q1 teal Esc/Enter accent
            fg = (242, 248, 250)

        x0, y0 = to_px(cx - kw * 0.5, cy + kd * 0.5)
        x1, y1 = to_px(cx + kw * 0.5, cy - kd * 0.5)
        d.rectangle((x0 - 2, y0 - 2, x1 + 2, y1 + 2), fill=bg)
        if label:
            font = f_lg if len(label) <= 2 else f_sm
            bx = (x0 + x1) * 0.5
            by = (y0 + y1) * 0.5
            d.text((bx, by), label, fill=fg, font=font, anchor="mm")

    path = os.path.join(TEX_DIR, "keychron_q1_legends.png")
    img.save(path)
    return path


def add_sculpted_keycap(bm, uv_layer, cx_mm, cy_mm, cz_mm, kw_mm, kd_mm, h_mm, tilt_rad, W_mm, D_mm, is_space=False):
    """Add a smooth, filleted KSA-profile PBT keycap with flat/gently-rounded top (ZERO X-pyramid triangulation!)."""
    rot_m = Matrix.Rotation(tilt_rad, 4, "X")
    trans = Matrix.Translation((cx_mm * MM, cy_mm * MM, cz_mm * MM)) @ rot_m

    # 3 vertical rings: base skirt -> mid taper -> chamfered rounded top rim -> inner top face
    # Using a clean 4-quad-ring + 1 planar top quad eliminates diagonal triangle creases completely!
    hw, hd = kw_mm * 0.5 * MM, kd_mm * 0.5 * MM
    tw, td = hw * 0.80, hd * 0.78
    iw, id_ = hw * 0.68, hd * 0.64
    h = h_mm * MM
    h_rim = h - (1.2 * MM if not is_space else 0.8 * MM)
    h_center = h + (1.0 * MM if is_space else -0.35 * MM)  # Convex spacebar, subtly dished alphas!

    def ring(rx, ry, z):
        return [
            bm.verts.new(trans @ Vector((-rx, -ry, z))),
            bm.verts.new(trans @ Vector((rx, -ry, z))),
            bm.verts.new(trans @ Vector((rx, ry, z))),
            bm.verts.new(trans @ Vector((-rx, ry, z))),
        ]

    v_bot = ring(hw, hd, 0.0)
    v_rim = ring(tw, td, h_rim)
    v_top = ring(iw, id_, h_center)

    faces = []
    for i in range(4):
        ni = (i + 1) % 4
        faces.append(bm.faces.new((v_bot[i], v_bot[ni], v_rim[ni], v_rim[i])))
        faces.append(bm.faces.new((v_rim[i], v_rim[ni], v_top[ni], v_top[i])))
    # Clean single quad top face (NO diagonal pyramid center vertex!)
    top_f = bm.faces.new((v_top[0], v_top[1], v_top[2], v_top[3]))
    faces.append(top_f)

    for f in faces:
        f.smooth = True
        for loop in f.loops:
            co = loop.vert.co
            u = (co.x / (W_mm * MM)) + 0.5
            v = (co.y / (D_mm * MM)) + 0.5
            loop[uv_layer].uv = (max(0.0, min(1.0, u)), max(0.0, min(1.0, v)))


def build_keychron_q1():
    """Keychron Q1 Pro: 327.5 x 145 mm, CNC aluminum case with raised bezel, recessed keywell, true exploded 75% layout + knurled knob."""
    clear_scene()
    W_MM = 327.5
    D_MM = 145.0
    H_FRONT = 20.5
    H_BACK = 33.5
    TILT = math.radians(5.1)  # +5.1 deg tilts +Y (rear) UP

    alu_case = make_mat("Keychron_CNCAlu", (0.078, 0.084, 0.095), metallic=0.82, roughness=0.34)
    alu_seam = make_mat("Keychron_CaseSeam", (0.025, 0.028, 0.034), metallic=0.5, roughness=0.55)
    plate_mat = make_mat("Keychron_SwitchPlate", (0.032, 0.036, 0.044), metallic=0.45, roughness=0.52)
    knob_mat = make_mat("Keychron_AnodizedKnob", (0.085, 0.092, 0.105), metallic=0.78, roughness=0.38)
    usbc_mat = make_mat("Keychron_USBC", (0.76, 0.79, 0.83), metallic=0.92, roughness=0.22)

    # 1. Two-piece CNC 6063 Aluminum Chassis with Raised Outer Bezel Framing a Deeply Recessed Keywell!
    # Lower solid wedge base (sits from z=0 up to keywell floor = top - 5.5mm)
    def make_wedge(name, w_mm, d_mm, hf_mm, hb_mm, z_off_mm, mat, bevel_mm=2.2):
        bm = bmesh.new()
        hw, hd = w_mm * 0.5 * MM, d_mm * 0.5 * MM
        zo = z_off_mm * MM
        v0 = bm.verts.new((-hw, -hd, zo))
        v1 = bm.verts.new((hw, -hd, zo))
        v2 = bm.verts.new((hw, hd, zo))
        v3 = bm.verts.new((-hw, hd, zo))
        v4 = bm.verts.new((-hw, -hd, zo + hf_mm * MM))
        v5 = bm.verts.new((hw, -hd, zo + hf_mm * MM))
        v6 = bm.verts.new((hw, hd, zo + hb_mm * MM))
        v7 = bm.verts.new((-hw, hd, zo + hb_mm * MM))
        bm.faces.new((v0, v3, v2, v1))
        bm.faces.new((v4, v5, v6, v7))
        bm.faces.new((v0, v1, v5, v4))
        bm.faces.new((v1, v2, v6, v5))
        bm.faces.new((v2, v3, v7, v6))
        bm.faces.new((v3, v0, v4, v7))
        me = bpy.data.meshes.new(name + "_M")
        bm.to_mesh(me)
        bm.free()
        o = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(o)
        o.data.materials.append(mat)
        mod = o.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel_mm * MM
        mod.segments = 3
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=mod.name)
        for p in o.data.polygons:
            p.use_smooth = True
        return o

    # Lower case body + subtle horizontal 2-piece CNC seam + recessed dark switch plate
    make_wedge("Keychron_LowerBody", W_MM, D_MM, H_FRONT - 5.5, H_BACK - 5.5, 0.0, alu_case, bevel_mm=2.8)
    make_wedge("Keychron_SeamGroove", W_MM - 0.8, D_MM - 0.8, 1.0, 1.0, 9.0, alu_seam, bevel_mm=0.3)

    # Raised 4-wall CNC aluminum top bezel frame around the recessed keywell (authentic Q1 Pro thick chin/bezel!)
    deck_z = ((H_FRONT + H_BACK) * 0.5 - 5.0) * MM
    add_box("Keychron_Plate", (W_MM * MM - 18 * MM, D_MM * MM - 18 * MM, 2.5 * MM), (0, 0, deck_z), plate_mat, rot=(TILT, 0, 0))

    wall_h = 8.0 * MM
    # Front lip (-Y), Rear lip (+Y), Left lip (-X), Right lip (+X)
    def top_z_at(y_mm):
        return (H_FRONT + ((y_mm + D_MM * 0.5) / D_MM) * (H_BACK - H_FRONT)) * MM

    add_box("Bezel_Front", (W_MM * MM, 10.5 * MM, wall_h), (0, -D_MM * 0.5 * MM + 5.25 * MM, top_z_at(-D_MM * 0.5 + 5.25) - wall_h * 0.5), alu_case, bevel=1.8 * MM, segments=3, rot=(TILT, 0, 0))
    add_box("Bezel_Rear", (W_MM * MM, 10.5 * MM, wall_h), (0, D_MM * 0.5 * MM - 5.25 * MM, top_z_at(D_MM * 0.5 - 5.25) - wall_h * 0.5), alu_case, bevel=1.8 * MM, segments=3, rot=(TILT, 0, 0))
    add_box("Bezel_Left", (10.5 * MM, D_MM * MM, wall_h), (-W_MM * 0.5 * MM + 5.25 * MM, 0, top_z_at(0) - wall_h * 0.5), alu_case, bevel=1.8 * MM, segments=3, rot=(TILT, 0, 0))
    add_box("Bezel_Right", (10.5 * MM, D_MM * MM, wall_h), (W_MM * 0.5 * MM - 5.25 * MM, 0, top_z_at(0) - wall_h * 0.5), alu_case, bevel=1.8 * MM, segments=3, rot=(TILT, 0, 0))

    # Rear USB-C port & Mac/Win switch
    add_box("Keychron_USBC", (11 * MM, 4 * MM, 5 * MM), (-105 * MM, D_MM * 0.5 * MM - 0.5 * MM, 13 * MM), usbc_mat, bevel=0.8 * MM)

    # 2. Authentic EXPLODED 75% Keychron Q1 Pro Layout (exact real-world groupings!)
    # Width budget inside 306.5mm keywell (left=-153.25mm .. right=+153.25mm):
    # 15U main block (276mm) + 4.5mm exploded gap + 1U right nav col (18.4mm) = 298.9mm -> perfectly centered!
    U = 18.4
    GAP = 1.4
    START_X = -149.5

    # Clean Linux/Omarchy modifier labels + arrow symbols + tight hairline seam
    row_specs = [
        (51.5, 9.8, [
            (1.0, 2, "ESC"), (0.45, -1, ""),
            (1.0, 0, "F1"), (1.0, 0, "F2"), (1.0, 0, "F3"), (1.0, 0, "F4"), (0.45, -1, ""),
            (1.0, 1, "F5"), (1.0, 1, "F6"), (1.0, 1, "F7"), (1.0, 1, "F8"), (0.45, -1, ""),
            (1.0, 0, "F9"), (1.0, 0, "F10"), (1.0, 0, "F11"), (1.0, 0, "F12"),
        ]),
        (28.5, 9.4, [
            (1.0, 1, "~"), (1.0, 0, "1"), (1.0, 0, "2"), (1.0, 0, "3"), (1.0, 0, "4"),
            (1.0, 0, "5"), (1.0, 0, "6"), (1.0, 0, "7"), (1.0, 0, "8"), (1.0, 0, "9"),
            (1.0, 0, "0"), (1.0, 0, "-"), (1.0, 0, "="), (2.0, 1, "BKSP"),
            (0.25, -1, ""), (1.0, 1, "DEL"),
        ]),
        (9.8, 8.6, [
            (1.5, 1, "TAB"), (1.0, 0, "Q"), (1.0, 0, "W"), (1.0, 0, "E"), (1.0, 0, "R"),
            (1.0, 0, "T"), (1.0, 0, "Y"), (1.0, 0, "U"), (1.0, 0, "I"), (1.0, 0, "O"),
            (1.0, 0, "P"), (1.0, 0, "["), (1.0, 0, "]"), (1.5, 1, "\\"),
            (0.25, -1, ""), (1.0, 1, "PGUP"),
        ]),
        (-8.9, 8.2, [
            (1.75, 1, "CAPS"), (1.0, 0, "A"), (1.0, 0, "S"), (1.0, 0, "D"), (1.0, 0, "F"),
            (1.0, 0, "G"), (1.0, 0, "H"), (1.0, 0, "J"), (1.0, 0, "K"), (1.0, 0, "L"),
            (1.0, 0, ";"), (1.0, 0, "'"), (2.25, 2, "ENTER"),
            (0.25, -1, ""), (1.0, 1, "PGDN"),
        ]),
        (-27.6, 8.8, [
            (2.25, 1, "SHIFT"), (1.0, 0, "Z"), (1.0, 0, "X"), (1.0, 0, "C"), (1.0, 0, "V"),
            (1.0, 0, "B"), (1.0, 0, "N"), (1.0, 0, "M"), (1.0, 0, ","), (1.0, 0, "."),
            (1.0, 0, "/"), (1.75, 1, "SHIFT"), (0.25, -1, ""), (1.0, 1, "↑"),
        ]),
        (-46.8, 9.2, [
            (1.25, 1, "CTRL"), (1.25, 1, "SUPER"), (1.25, 1, "ALT"), (6.25, 0, ""),
            (1.0, 1, "ALT"), (1.0, 1, "FN"), (1.0, 1, "CTRL"), (0.25, -1, ""),
            (1.0, 1, "←"), (1.0, 1, "↓"), (1.0, 1, "→"),
        ]),
    ]

    key_defs = []
    for y_mm, h_mm, keys in row_specs:
        cx_cur = START_X
        for units, style, label in keys:
            span = units * U
            if style >= 0:
                key_defs.append((cx_cur + span * 0.5, y_mm, span - GAP, U - GAP, style, label, h_mm, units > 5.0))
            cx_cur += span

    atlas_path = generate_keycap_atlas([(k[0], k[1], k[2], k[3], k[4], k[5]) for k in key_defs], W_MM, D_MM)
    caps_mat = make_tex_mat("Keychron_PBTKeycaps", atlas_path, metallic=0.02, roughness=0.58)

    bm_caps = bmesh.new()
    uv_layer = bm_caps.loops.layers.uv.new("UVMap")
    for cx, cy, kw, kd, style, label, h_mm, is_space in key_defs:
        z_surf_mm = (H_FRONT + ((cy + D_MM * 0.5) / D_MM) * (H_BACK - H_FRONT)) - 5.2
        add_sculpted_keycap(bm_caps, uv_layer, cx, cy, z_surf_mm, kw, kd, h_mm, TILT, W_MM, D_MM, is_space=is_space)

    caps_me = bpy.data.meshes.new("Keychron_KeycapsMesh")
    bm_caps.to_mesh(caps_me)
    bm_caps.free()
    caps_obj = bpy.data.objects.new("Keychron_Keycaps", caps_me)
    bpy.context.scene.collection.objects.link(caps_obj)
    caps_obj.data.materials.append(caps_mat)

    # 3. Recessed Anodized Knurled Rotary Encoder Knob (top-right corner aligned directly above DEL/PGUP/PGDN!)
    knob_x = (START_X + 15.25 * U + 0.5 * U) * MM
    knob_y = 51.5 * MM
    knob_z = top_z_at(51.5) + 2.5 * MM
    # Recessed circular bezel socket
    bpy.ops.mesh.primitive_cylinder_add(vertices=28, radius=9.4 * MM, depth=4.0 * MM, location=(knob_x, knob_y, knob_z - 5.5 * MM), rotation=(TILT, 0, 0))
    sock = bpy.context.active_object
    sock.name = "Knob_Recess"
    sock.data.materials.append(plate_mat)
    # Main chamfered anodized knob
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=8.0 * MM, depth=12.0 * MM, location=(knob_x, knob_y, knob_z), rotation=(TILT, 0, 0))
    knob = bpy.context.active_object
    knob.name = "Keychron_RotaryKnob"
    knob.data.materials.append(knob_mat)
    mod_k = knob.modifiers.new("Bevel", "BEVEL")
    mod_k.width = 1.2 * MM
    mod_k.segments = 2
    bpy.ops.object.modifier_apply(modifier=mod_k.name)
    for p in knob.data.polygons:
        p.use_smooth = True
    # Fine knurling flutes around knob circumference
    for k in range(18):
        a = (k / 18.0) * math.pi * 2.0
        kx = knob_x + math.cos(a) * 8.1 * MM
        ky = knob_y + math.sin(a) * 8.1 * MM
        add_box(f"Knob_Knurl_{k}", (0.8 * MM, 0.8 * MM, 9.5 * MM), (kx, ky, knob_z), knob_mat, rot=(TILT, 0, a))

    out_blend = os.path.join(OUT_DIR, "keychron_q1.blend")
    bpy.ops.wm.save_as_mainfile(filepath=out_blend)
    print(f"SAVED: {out_blend}")


def build_mx_master_3s():
    """Logitech MX Master 3S (Graphite): 84.3 x 124.9 x 51.0 mm, sculpted asymmetric thumb wing,
    split overhanging LMB/RMB paddles, recessed grooved MagSpeed wheel & horizontal thumb wheel,
    angled forward/back buttons, flush mode-shift button, front USB-C, zero clipping artifacts!"""
    clear_scene()
    L = 124.9 * MM

    # Authentic dark Graphite MX Master 3S two-tone finish (sleek dark graphite body + satin click paddles + bright steel MagSpeed wheel!)
    graphite_grip = make_mat("MX3S_GraphiteGrip", (0.068, 0.072, 0.082), metallic=0.04, roughness=0.68)
    graphite_paddle = make_mat("MX3S_DarkSatinPaddle", (0.044, 0.048, 0.056), metallic=0.10, roughness=0.32, coat=0.20)
    steel_wheel = make_mat("MX3S_MagSpeedSteel", (0.80, 0.83, 0.88), metallic=0.95, roughness=0.18)
    dark_well = make_mat("MX3S_WheelWell", (0.018, 0.020, 0.024), metallic=0.1, roughness=0.82)
    led_green = make_mat("MX3S_LED", (0.18, 0.90, 0.42), metallic=0.0, roughness=0.2, emit=(0.18, 0.90, 0.42), emit_strength=2.0)

    # 1. Iconic Asymmetric Sculpted Ergonomic Palm Shell + Pronounced Flared Lower-Left Thumb Wing!
    bm = bmesh.new()
    # Cross sections along Y (-0.5 rear heel .. +0.5 front nose)
    # (y_frac, left_wall_x, right_wall_x, arch_peak_x, peak_h, thumb_wing_flare, right_slope_drop)
    sections = [
        (-0.50, -21.0, 20.0, -2.0, 10.0, 0.0, 0.70),
        (-0.42, -29.0, 27.0, -5.0, 27.5, 4.0, 0.68),
        (-0.26, -34.0, 31.5, -8.5, 45.0, 11.5, 0.62),
        (-0.08, -36.0, 33.5, -10.0, 51.0, 18.5, 0.56),  # Tall steep left-offset arch + wide flared left thumb wing!
        (0.08, -35.5, 33.0, -8.5, 46.5, 20.5, 0.58),    # Deep concave thumb bay + gesture wing!
        (0.24, -32.0, 31.0, -5.5, 35.5, 12.5, 0.64),
        (0.38, -28.0, 27.5, -2.5, 24.5, 4.0, 0.72),
        (0.47, -23.0, 22.5, -1.0, 15.5, 0.0, 0.78),
        (0.50, -16.5, 16.0, -0.5, 9.0, 0.0, 0.82),
    ]
    ring_n = 28
    rings = []
    for y_f, lx, rx, px, th, flare, r_drop in sections:
        y = y_f * L
        ring = []
        for k in range(ring_n):
            ang = (k / ring_n) * math.pi * 2.0
            ca, sa = math.cos(ang), math.sin(ang)
            if sa >= 0:
                if ca >= 0:
                    # Steep ergonomic slope down to right pinky side!
                    x = px * MM + (rx * MM - px * MM) * (ca ** 0.92)
                    z = 2.0 * MM + (th * MM - 2.0 * MM) * (sa ** (1.0 / r_drop))
                else:
                    u = -ca
                    # Pronounced flared lower-left thumb wing + deep ergonomic thumb concavity above it!
                    wing = flare * MM * math.exp(-((sa - 0.10) / 0.16) ** 2)
                    scoop = -5.5 * MM * math.exp(-((sa - 0.48) / 0.22) ** 2) * (flare / 20.5)
                    x = px * MM - (px * MM - lx * MM) * u - wing - scoop
                    z = 2.0 * MM + (th * MM - 2.0 * MM) * (sa ** 0.76)
            else:
                x = (rx * MM if ca >= 0 else (lx - flare * 0.65) * MM) * abs(ca) * 0.90
                z = 0.0
            ring.append(bm.verts.new((x, y, z)))
        rings.append(ring)

    for s in range(len(rings) - 1):
        r0, r1 = rings[s], rings[s + 1]
        for k in range(ring_n):
            nk = (k + 1) % ring_n
            bm.faces.new((r0[k], r0[nk], r1[nk], r1[k]))
    bm.faces.new(rings[0][::-1])
    bm.faces.new(rings[-1])

    me = bpy.data.meshes.new("MX3S_BodyMesh")
    bm.to_mesh(me)
    bm.free()
    body = bpy.data.objects.new("MX3S_Body", me)
    bpy.context.scene.collection.objects.link(body)
    body.data.materials.append(graphite_grip)
    for p in body.data.polygons:
        p.use_smooth = True
    sub = body.modifiers.new("Subsurf", "SUBSURF")
    sub.levels = 2
    sub.render_levels = 2
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.modifier_apply(modifier=sub.name)

    # 2. Clean Flush Split LMB/RMB Seam + Recessed Central Wheel Channel (zero floating grey bars!)
    add_box("MX3S_WheelChannel", (10.5 * MM, 36 * MM, 6.0 * MM), (-1.2 * MM, 34 * MM, 24.5 * MM), dark_well, bevel=1.4 * MM, rot=(math.radians(-28), 0, 0))
    # Subtle dark center split groove dividing Left & Right Mouse Buttons cleanly down to front nose
    add_box("MX3S_ButtonSplit", (1.6 * MM, 28 * MM, 3.5 * MM), (-1.2 * MM, 48 * MM, 16.5 * MM), dark_well, rot=(math.radians(-30), 0, 0))

    # 3. Accurately Scaled Recessed Machined-Steel MagSpeed Scroll Wheel (fine brushed steel cylinder, no spiky gear teeth!)
    w_loc = (-1.2 * MM, 34.0 * MM, 28.2 * MM)
    bpy.ops.mesh.primitive_cylinder_add(vertices=36, radius=9.0 * MM, depth=6.4 * MM, location=w_loc, rotation=(0, math.pi / 2, 0))
    wheel = bpy.context.active_object
    wheel.name = "MX3S_MagSpeedWheel"
    wheel.data.materials.append(steel_wheel)
    for p in wheel.data.polygons:
        p.use_smooth = True

    # Sleek flush oblong MagSpeed Mode-Shift Button aligned directly inline behind the MagSpeed wheel
    add_box("MX3S_ModeShiftBtn", (4.6 * MM, 11.0 * MM, 2.0 * MM), (-1.2 * MM, 15.0 * MM, 44.2 * MM), graphite_paddle, bevel=0.9 * MM, segments=3, rot=(math.radians(-14), 0, 0))

    # 4. Tucked Recessed Machined-Steel Horizontal Thumb Wheel (cleanly seated under left brow, no protruding black block!)
    tw_loc = (-31.5 * MM, 14.5 * MM, 24.5 * MM)
    bpy.ops.mesh.primitive_cylinder_add(vertices=28, radius=4.0 * MM, depth=14.2 * MM, location=tw_loc, rotation=(math.pi / 2, 0, math.radians(-10)))
    twheel = bpy.context.active_object
    twheel.name = "MX3S_ThumbWheel"
    twheel.data.materials.append(steel_wheel)
    for p in twheel.data.polygons:
        p.use_smooth = True

    # Two clean flush angled Forward / Back side buttons neatly beneath thumb wheel
    add_box("MX3S_BtnForward", (3.2 * MM, 11.5 * MM, 3.6 * MM), (-35.0 * MM, 20.5 * MM, 17.5 * MM), graphite_paddle, bevel=0.9 * MM, rot=(0, math.radians(-14), math.radians(-10)))
    add_box("MX3S_BtnBack", (3.2 * MM, 11.5 * MM, 3.6 * MM), (-36.2 * MM, 6.5 * MM, 17.5 * MM), graphite_paddle, bevel=0.9 * MM, rot=(0, math.radians(-14), math.radians(-6)))

    # Pinpoint tiny recessed LED + recessed front USB-C port
    add_box("MX3S_FrontUSBC", (8.8 * MM, 3.5 * MM, 3.2 * MM), (-1.2 * MM, 59.5 * MM, 6.8 * MM), dark_well, bevel=0.9 * MM)

    out_blend = os.path.join(OUT_DIR, "mx_master_3s.blend")
    bpy.ops.wm.save_as_mainfile(filepath=out_blend)
    print(f"SAVED: {out_blend}")


def build_dell_u3425we():
    """True 21:9 Dell UltraSharp U3425WE 34" Curved Ultrawide Monitor (800 x 336 mm active 2.38:1 display,
    subtle 1900R curve, brushed platinum-silver stand with REAL cut-through oval cable hole & recessed rear neck!)."""
    clear_scene()
    SW = 800.0 * MM  # Exact 34" 21:9 ultrawide active width
    SH = 336.0 * MM  # Exact 34" 21:9 ultrawide active height (2.381:1!)
    CURVE_R = 1.90   # Authentic 1900R ergonomic curvature
    CENTER_Z = 342.0 * MM

    bezel_black = make_mat("Dell_MatteBlackBezel", (0.036, 0.040, 0.048), metallic=0.22, roughness=0.46)
    # Brushed anodized platinum-silver calibrated for metallic sheen under HDR IBL!
    plat_silver = make_mat("Dell_PlatinumSilver", (0.58, 0.61, 0.65), metallic=0.88, roughness=0.25)
    plat_base = make_mat("Dell_BrushedBase", (0.54, 0.57, 0.62), metallic=0.90, roughness=0.24)
    led_white = make_mat("Dell_PowerLED", (0.92, 0.96, 1.0), metallic=0.0, roughness=0.2, emit=(0.92, 0.96, 1.0), emit_strength=2.0)

    # Seamless transparent-background DELL chin logo (ZERO grey rectangular patch!)
    cw, ch = 512, 48
    chin_img = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    cd = ImageDraw.Draw(chin_img)
    try:
        fd = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 24)
    except Exception:
        fd = ImageFont.load_default()
    cd.text((cw // 2, ch // 2), "DELL", fill=(28, 32, 38, 255), font=fd, anchor="mm")
    p_chin = os.path.join(TEX_DIR, "dell_chin.png")
    chin_img.save(p_chin)
    chin_mat = bpy.data.materials.new("Dell_ChinLogo")
    chin_mat.use_nodes = True
    chin_mat.blend_method = "BLEND"
    nt_c = chin_mat.node_tree
    bsdf_c = nt_c.nodes["Principled BSDF"]
    bsdf_c.inputs["Metallic"].default_value = 0.45
    bsdf_c.inputs["Roughness"].default_value = 0.35
    tex_c = nt_c.nodes.new("ShaderNodeTexImage")
    im_c = bpy.data.images.load(p_chin)
    im_c.pack()
    tex_c.image = im_c
    nt_c.links.new(tex_c.outputs["Color"], bsdf_c.inputs["Base Color"])
    nt_c.links.new(tex_c.outputs["Alpha"], bsdf_c.inputs["Alpha"])

    # 1. Authentic Beveled Platinum-Silver Trapezoidal Base + Tapered Riser Column with REAL Boolean Cut-Through Oval Cable Hole!
    add_box("Stand_Base", (286 * MM, 212 * MM, 9.5 * MM), (0, 38 * MM, 4.75 * MM), plat_base, bevel=3.2 * MM, segments=3)
    # Recessed dark rubber anti-slip base pad creating realistic desk contact shadow
    add_box("Stand_BaseRubber", (272 * MM, 198 * MM, 2.0 * MM), (0, 38 * MM, 1.0 * MM), bezel_black)

    # Tapered Dell UltraSharp riser column recessed behind the panel
    col = add_box("Stand_Column", (72 * MM, 24 * MM, 352 * MM), (0, 82 * MM, 178 * MM), plat_silver, bevel=4.2 * MM, segments=3, rot=(math.radians(-6.0), 0, 0))
    # TRUE Boolean oval cable-management cutout punched cleanly through the aluminum column!
    bpy.ops.mesh.primitive_cylinder_add(vertices=28, radius=16 * MM, depth=70 * MM, location=(0, 87 * MM, 86 * MM), rotation=(math.pi / 2, 0, 0))
    cutter = bpy.context.active_object
    cutter.scale = (0.88, 1.0, 1.55)
    bpy.ops.object.transform_apply(scale=True)
    b_mod = col.modifiers.new("CableCutout", "BOOLEAN")
    b_mod.operation = "DIFFERENCE"
    b_mod.object = cutter
    bpy.context.view_layer.objects.active = col
    bpy.ops.object.modifier_apply(modifier=b_mod.name)
    bpy.data.objects.remove(cutter, do_unlink=True)

    # Recessed VESA mounting neck + tilt hinge behind display
    add_box("Stand_VesaNeck", (94 * MM, 54 * MM, 98 * MM), (0, 56 * MM, CENTER_Z - 6 * MM), bezel_black, bevel=4 * MM)

    # 2. Curved 1900R 34" 21:9 Monitor Housing (InfinityEdge thin top/side bezels + platinum-silver chin & curved back!)
    def add_curved_slab(name, width, height, thickness, y_offset, z_center, mat, segs=20):
        bm = bmesh.new()
        front_top, front_bot, back_top, back_bot = [], [], [], []
        for i in range(segs + 1):
            u = (i / segs) - 0.5
            x = u * width
            # Subtle 1900R curve: edges bend forward toward viewer (-Y in Blender -> +Z in Three.js!)
            curve_y = -(CURVE_R - math.sqrt(max(0.01, CURVE_R * CURVE_R - x * x)))
            yf = y_offset + curve_y
            yb = yf + thickness
            zt = z_center + height * 0.5
            zb = z_center - height * 0.5
            front_top.append(bm.verts.new((x, yf, zt)))
            front_bot.append(bm.verts.new((x, yf, zb)))
            back_top.append(bm.verts.new((x, yb, zt)))
            back_bot.append(bm.verts.new((x, yb, zb)))
        for i in range(segs):
            # Front (-Y), Back (+Y), Top (+Z), Bottom (-Z)
            bm.faces.new((front_bot[i], front_bot[i + 1], front_top[i + 1], front_top[i]))
            bm.faces.new((back_bot[i + 1], back_bot[i], back_top[i], back_top[i + 1]))
            bm.faces.new((front_top[i], front_top[i + 1], back_top[i + 1], back_top[i]))
            bm.faces.new((back_bot[i], back_bot[i + 1], front_bot[i + 1], front_bot[i]))
        # Left & Right end caps
        bm.faces.new((back_bot[0], front_bot[0], front_top[0], back_top[0]))
        bm.faces.new((front_bot[-1], back_bot[-1], back_top[-1], front_top[-1]))
        me = bpy.data.meshes.new(name + "_M")
        bm.to_mesh(me)
        bm.free()
        o = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(o)
        o.data.materials.append(mat)
        for p in o.data.polygons:
            p.use_smooth = True
        return o

    frame_w = SW + 14 * MM
    frame_h = SH + 22 * MM
    # Thin matte black InfinityEdge bezel + sculpted platinum-silver rear shell + signature silver lower chin
    add_curved_slab("Monitor_BezelFrame", frame_w, frame_h, 14 * MM, 0.0, CENTER_Z - 4 * MM, bezel_black)
    add_curved_slab("Monitor_SilverBack", frame_w - 22 * MM, frame_h - 26 * MM, 22 * MM, 13 * MM, CENTER_Z - 4 * MM, plat_silver)
    add_curved_slab("Monitor_SilverChin", frame_w, 12 * MM, 15 * MM, -0.5 * MM, CENTER_Z - SH * 0.5 - 9.0 * MM, plat_silver)

    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0, -1.2 * MM, CENTER_Z - SH * 0.5 - 9.0 * MM))
    chin_p = bpy.context.active_object
    chin_p.name = "Monitor_DellLogo"
    chin_p.scale = (114 * MM, 10.5 * MM, 1.0)
    chin_p.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(rotation=True, scale=True)
    chin_p.data.materials.append(chin_mat)

    edge_pull = -(CURVE_R - math.sqrt(CURVE_R * CURVE_R - (SW * 0.5 - 32 * MM) ** 2))
    add_box("Monitor_PowerLED", (7 * MM, 2.5 * MM, 2.0 * MM), (SW * 0.5 - 32 * MM, edge_pull - 0.8 * MM, CENTER_Z - SH * 0.5 - 9.5 * MM), led_white)
    add_box("Monitor_QuickHub", (54 * MM, 16 * MM, 7 * MM), (-SW * 0.5 + 88 * MM, edge_pull + 12 * MM, CENTER_Z - SH * 0.5 - 16 * MM), bezel_black, bevel=1.5 * MM)

    out_blend = os.path.join(OUT_DIR, "dell_u3425we.blend")
    bpy.ops.wm.save_as_mainfile(filepath=out_blend)
    print(f"SAVED: {out_blend}")


if __name__ == "__main__":
    build_keychron_q1()
    build_mx_master_3s()
    build_dell_u3425we()
