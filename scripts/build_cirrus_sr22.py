#!/usr/bin/env python3
"""Headless Blender builder for a museum-grade 1:40 scale Cirrus SR22 (G6/G7 Carbon Edition).

Verified real-world Cirrus SR22 dimensions:
  - Wingspan:           11.68 m  (38 ft 4 in) -> 292.0 mm at 1:40 scale
  - Overall Length:      7.92 m  (26 ft 0 in) -> 198.0 mm at 1:40 scale
  - Overall Height:      2.72 m  ( 8 ft 11 in) ->  68.0 mm at 1:40 scale
  - Propeller Diameter:  1.98 m  ( 6 ft 6 in) ->  49.5 mm at 1:40 scale
  - Cabin Width/Height:  1.24 m / 1.27 m      ->  31.0 mm / 31.8 mm at 1:40 scale

Key signature SR22 visual features modeled from real SR22 G6/G7 photos:
  1. Composite teardrop fuselage with twin kidney cowling cooling intakes & chin scoop
  2. Parabolic painted spinner + 3-blade twisted Hartzell scimitar prop with safety tip stripes
  3. Wrap-around raked windshield + swept dark-tinted cabin & rear windows + gull-wing door seams
  4. Dorsal CAPS (Cirrus Airframe Parachute System) flush hatch + red warning placard on aft spine
  5. Low wing with ~5 deg dihedral, smooth Karman root fairings, cuffed outboard leading edge,
     wing-root boarding steps, port pitot probe, and upswept Spectra LED wingtips (red/green nav)
  6. Fixed tricycle landing gear with faired main struts, nose strut, sleek composite wheel pants
     (spats), and rubber tires resting flush on Z = 0.000
  7. Swept vertical stabilizer with curved dorsal fillet, red top beacon, and low horizontal tail
  8. Crisp Cirrus Carbon Edition livery (Snow White + Anthracite Carbon + Crimson Red accent,
     SR22 cowling mark, N228SR registration, wing walk strips, Cirrus tail emblem)

Outputs:
  - assets/blender/cirrus_sr22.blend
  - assets/models/cirrus_sr22.glb
  - /tmp/sr22_preview_3q.png, /tmp/sr22_preview_side.png, /tmp/sr22_preview_top.png
"""
import math
import os
import bpy
import bmesh
from mathutils import Vector, Matrix
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BLEND_OUT = os.path.join(ROOT, "assets", "blender", "cirrus_sr22.blend")
GLB_OUT = os.path.join(ROOT, "assets", "models", "cirrus_sr22.glb")
TEX_DIR = os.path.join(ROOT, "assets", "blender", "textures")
os.makedirs(os.path.dirname(BLEND_OUT), exist_ok=True)
os.makedirs(os.path.dirname(GLB_OUT), exist_ok=True)
os.makedirs(TEX_DIR, exist_ok=True)

# 1:40 museum scale in metres (Blender Z-up, +Y = forward nose, +X = starboard/right wing)
SCALE = 1.0 / 40.0
WINGSPAN = 11.68 * SCALE       # 0.2920 m
HALF_SPAN = WINGSPAN * 0.5     # 0.1460 m
LENGTH = 7.92 * SCALE          # 0.1980 m
PROP_RAD = (1.98 * 0.5) * SCALE  # 0.02475 m

# Longitudinal stations: y_nose = +0.108, y_tail = -0.090 (total = 0.198 m)
Y_SPINNER_TIP = 0.108
Y_COWL_FRONT = 0.096
Y_TAIL_END = -0.090
# Ground clearance of fuselage centerline (leaves room for nose gear & prop clearance)
Z_FUSE_DATUM = 0.0295


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1.0


def load_font(size, bold=True):
    paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ]
    for p in paths:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def generate_livery_texture():
    """Generate crisp 1024x1024 Cirrus SR22 G6/G7 Carbon Edition livery texture.

    UV layout (planar side-projection for fuselage & tail, top-projection for wings):
      - Upper half  (V in [0.50..1.00]): Fuselage + Tail side profile (U: 0=tail, 1=nose; V: 0.52=belly, 0.96=tailtop)
      - Lower-left  (U in [0.00..0.55], V in [0.00..0.48]): Wing upper/lower surface (spanwise U, chordwise V)
      - Lower-right (U in [0.58..0.98], V in [0.02..0.46]): Dorsal fuselage top (CAPS hatch, warning placard, stripes)
    """
    W, H = 1024, 1024
    img = Image.new("RGB", (W, H), (244, 244, 242))  # Glossy Cirrus Snow White
    draw = ImageDraw.Draw(img)

    # Helper: convert (u, v) in [0..1] (Blender V=0 bottom, V=1 top) -> PIL (px, py)
    def uv(u, v):
        return (int(round(u * (W - 1))), int(round((1.0 - v) * (H - 1))))

    # ==========================================================
    # 1. FUSELAGE & VERTICAL TAIL SIDE PROFILE (V: 0.50 .. 1.00)
    #    u = (y - Y_TAIL_END) / (Y_SPINNER_TIP - Y_TAIL_END)  [0=tail .. 1=nose]
    #    v = 0.52 + ((z - 0.010) / 0.068) * 0.44
    # ==========================================================
    # Glossy Snow White upper region already filled.
    # Sweeping Cirrus Carbon Edition Anthracite Charcoal lower hull & sweeping aft tail accent
    charcoal = (38, 42, 48)
    slate = (68, 75, 86)
    crimson = (188, 28, 36)
    silver = (196, 200, 206)

    # Sweeping lower carbon belly rising cleanly up toward the tailcone
    belly_poly = [
        uv(0.00, 0.50), uv(1.00, 0.50),
        uv(1.00, 0.625), uv(0.86, 0.622), uv(0.72, 0.612),
        uv(0.56, 0.608), uv(0.40, 0.628), uv(0.24, 0.665),
        uv(0.11, 0.725), uv(0.02, 0.805), uv(0.00, 0.835),
    ]
    draw.polygon(belly_poly, fill=charcoal)

    # Mid metallic slate dynamic sweep swoosh along fuselage flank into the vertical tail
    swoosh_poly = [
        uv(0.95, 0.630), uv(0.78, 0.626), uv(0.60, 0.624),
        uv(0.42, 0.646), uv(0.26, 0.688), uv(0.12, 0.752),
        uv(0.03, 0.840), uv(0.06, 0.875), uv(0.17, 0.770),
        uv(0.32, 0.704), uv(0.48, 0.660), uv(0.66, 0.640),
        uv(0.86, 0.642), uv(0.96, 0.642),
    ]
    draw.polygon(swoosh_poly, fill=slate)

    # Iconic razor-sharp Cirrus Crimson Red accent stripe hugging the upper edge of the carbon sweep
    red_pts = [
        uv(0.96, 0.644), uv(0.82, 0.644), uv(0.64, 0.642),
        uv(0.46, 0.662), uv(0.30, 0.708), uv(0.16, 0.774),
        uv(0.05, 0.880),
    ]
    draw.line(red_pts, fill=crimson, width=6)

    # Thin silver pinstripe just beneath the crimson line
    sil_pts = [
        uv(0.94, 0.636), uv(0.78, 0.634), uv(0.60, 0.633),
        uv(0.42, 0.653), uv(0.26, 0.696), uv(0.12, 0.760),
    ]
    draw.line(sil_pts, fill=silver, width=2)

    # Vertical tail upper crimson tip accent & stylized Cirrus wing logo
    tail_red = [uv(0.01, 0.905), uv(0.14, 0.905), uv(0.11, 0.935), uv(0.01, 0.935)]
    draw.polygon(tail_red, fill=crimson)

    # Gull-wing cabin door outline seam (distinctive SR22 upward-opening composite door)
    door_pts = [
        uv(0.555, 0.625), uv(0.555, 0.745), uv(0.695, 0.755),
        uv(0.742, 0.715), uv(0.732, 0.625), uv(0.555, 0.625),
    ]
    draw.line(door_pts, fill=(115, 120, 128), width=2)
    # Recessed chrome door handle
    draw.rounded_rectangle([uv(0.578, 0.680), uv(0.602, 0.668)], radius=2, fill=(170, 176, 184), outline=(70, 76, 84))

    # Cowling split seam & oil filler access door
    draw.line([uv(0.775, 0.605), uv(0.775, 0.730)], fill=(138, 142, 148), width=2)
    draw.rectangle([uv(0.845, 0.705), uv(0.875, 0.686)], outline=(138, 142, 148), width=2)

    # Crisp authentic markings: "SR22" on forward cowling & "N228SR" on aft fuselage flank
    f_reg = load_font(26, bold=True)
    f_sr = load_font(19, bold=True)
    f_tail = load_font(16, bold=True)
    draw.text(uv(0.815, 0.676), "SR22", fill=(42, 46, 54), font=f_sr)
    draw.text(uv(0.255, 0.742), "N228SR", fill=(36, 40, 48), font=f_reg)
    draw.text(uv(0.032, 0.892), "CIRRUS", fill=(242, 244, 246), font=f_tail)

    # Small red-bordered CAPS safety placard on aft fuselage side near dorsal hatch
    draw.rectangle([uv(0.395, 0.715), uv(0.432, 0.695)], fill=(246, 246, 244), outline=crimson, width=2)
    tri_c = [uv(0.413, 0.712), uv(0.402, 0.698), uv(0.425, 0.698)]
    draw.polygon(tri_c, fill=crimson)

    # ==========================================================
    # 2. WING UPPER/LOWER TEXTURE (U: 0.00..0.55, V: 0.00..0.48)
    #    u_wing: 0.02 = root, 0.53 = wingtip
    #    v_wing: 0.04 = trailing edge, 0.44 = leading edge
    # ==========================================================
    # Subtle silver-gray structural wing panel & flap/aileron control surface lines
    draw.line([uv(0.03, 0.13), uv(0.27, 0.13)], fill=(140, 145, 152), width=2)  # Flap hinge
    draw.line([uv(0.27, 0.04), uv(0.27, 0.13)], fill=(140, 145, 152), width=2)  # Flap/aileron split
    draw.line([uv(0.27, 0.12), uv(0.49, 0.12)], fill=(140, 145, 152), width=2)  # Aileron hinge

    # Iconic black anti-slip wing-walk grip strip on inboard wing root (for stepping into the gull-wing cabin!)
    draw.rounded_rectangle([uv(0.048, 0.275), uv(0.132, 0.148)], radius=3, fill=(44, 47, 52), outline=(88, 92, 98), width=2)
    # Red "NO STEP" border strip along flap edge
    draw.line([uv(0.048, 0.140), uv(0.132, 0.140)], fill=crimson, width=3)

    # Carbon & Crimson swept wingtip accent stripe matching the fuselage livery
    draw.polygon([uv(0.44, 0.04), uv(0.54, 0.04), uv(0.54, 0.45), uv(0.47, 0.45)], fill=charcoal)
    draw.polygon([uv(0.42, 0.04), uv(0.445, 0.04), uv(0.475, 0.45), uv(0.452, 0.45)], fill=crimson)
    # Fuel cap stainless circle on mid-wing
    fc = uv(0.22, 0.33)
    draw.ellipse([fc[0] - 8, fc[1] - 8, fc[0] + 8, fc[1] + 8], fill=(182, 188, 196), outline=(92, 98, 106), width=2)

    # ==========================================================
    # 3. DORSAL SPINE & CAPS PARACHUTE HATCH (U: 0.58..0.98, V: 0.02..0.46)
    # ==========================================================
    # Clean dorsal white deck with dark recessed CAPS hatch seam, twin strap channels, and red warning emblem!
    hx0, hy0 = uv(0.67, 0.36)
    hx1, hy1 = uv(0.89, 0.14)
    draw.rounded_rectangle([hx0, hy0, hx1, hy1], radius=14, fill=(236, 236, 234), outline=(58, 62, 70), width=4)
    # Inner gasket seal bevel around the CAPS breakaway composite cover
    draw.rounded_rectangle([hx0 + 6, hy0 + 6, hx1 - 6, hy1 - 6], radius=10, outline=(145, 150, 158), width=2)
    # Twin subtle dorsal Kevlar harness cover tracks extending forward toward the cabin roof
    draw.line([uv(0.72, 0.36), uv(0.71, 0.44)], fill=(140, 145, 152), width=3)
    draw.line([uv(0.84, 0.36), uv(0.85, 0.44)], fill=(140, 145, 152), width=3)
    # Authentic red-and-white CAPS rocket/chute warning triangle + label directly on the CAPS cover
    tri_top = [uv(0.78, 0.32), uv(0.725, 0.21), uv(0.835, 0.21)]
    draw.polygon(tri_top, fill=crimson, outline=(120, 16, 22))
    # Tiny white parachute canopy icon inside red triangle
    draw.pieslice([uv(0.755, 0.295)[0], uv(0.755, 0.295)[1], uv(0.805, 0.248)[0], uv(0.805, 0.248)[1]], 180, 360, fill=(250, 250, 250))
    draw.line([uv(0.760, 0.272), uv(0.780, 0.228)], fill=(250, 250, 250), width=2)
    draw.line([uv(0.800, 0.272), uv(0.780, 0.228)], fill=(250, 250, 250), width=2)
    f_caps = load_font(20, bold=True)
    draw.text(uv(0.735, 0.192), "CAPS", fill=(42, 46, 52), font=f_caps)

    out_path = os.path.join(TEX_DIR, "cirrus_sr22_livery.jpg")
    img.save(out_path, "JPEG", quality=92, optimize=True)
    return out_path


def make_materials(livery_path):
    mats = {}

    # 1. Main UV-mapped Glossy Composite Airframe Livery
    m_liv = bpy.data.materials.new("SR22_Livery")
    m_liv.use_nodes = True
    nt = m_liv.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(livery_path)
    tex.image.pack()
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.22
    bsdf.inputs["Metallic"].default_value = 0.05
    mats["livery"] = m_liv

    def simple_mat(name, rgba, rough=0.3, metal=0.0, emit=None, emit_str=0.0):
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        b = m.node_tree.nodes["Principled BSDF"]
        b.inputs["Base Color"].default_value = rgba
        b.inputs["Roughness"].default_value = rough
        b.inputs["Metallic"].default_value = metal
        if emit is not None:
            b.inputs["Emission"].default_value = emit
            b.inputs["Emission Strength"].default_value = emit_str
        return m

    mats["white"] = simple_mat("SR22_SnowWhite", (0.94, 0.94, 0.93, 1.0), rough=0.18, metal=0.04)
    mats["carbon"] = simple_mat("SR22_CarbonCharcoal", (0.11, 0.125, 0.145, 1.0), rough=0.26, metal=0.18)
    mats["crimson"] = simple_mat("SR22_CrimsonAccent", (0.68, 0.06, 0.08, 1.0), rough=0.20, metal=0.10)
    mats["glass"] = simple_mat("SR22_CabinGlass", (0.012, 0.018, 0.028, 1.0), rough=0.04, metal=0.18)
    mats["intake"] = simple_mat("SR22_IntakeCavity", (0.025, 0.028, 0.032, 1.0), rough=0.85, metal=0.05)
    mats["chrome"] = simple_mat("SR22_PolishedMetal", (0.82, 0.84, 0.88, 1.0), rough=0.14, metal=0.95)
    mats["prop"] = simple_mat("SR22_PropComposite", (0.05, 0.055, 0.062, 1.0), rough=0.28, metal=0.12)
    mats["tire"] = simple_mat("SR22_RubberTire", (0.06, 0.062, 0.066, 1.0), rough=0.86, metal=0.0)
    mats["nav_red"] = simple_mat("SR22_NavRed", (0.85, 0.08, 0.06, 1.0), rough=0.15, metal=0.05, emit=(1.0, 0.12, 0.08, 1.0), emit_str=0.6)
    mats["nav_green"] = simple_mat("SR22_NavGreen", (0.06, 0.80, 0.25, 1.0), rough=0.15, metal=0.05, emit=(0.10, 1.0, 0.35, 1.0), emit_str=0.6)
    mats["nav_white"] = simple_mat("SR22_StrobeWhite", (0.96, 0.98, 1.0, 1.0), rough=0.12, metal=0.1, emit=(1.0, 1.0, 1.0, 1.0), emit_str=0.5)
    return mats


def set_smooth(obj):
    for poly in obj.data.polygons:
        poly.use_smooth = True


def build_fuselage(mats):
    """Loft an authentic 26-station Cirrus SR22 composite fuselage with superellipse cross-sections."""
    # Stations: (y, half_w, z_top, z_bot, squarish_exp)
    # Nose firewall at y=+0.096, windshield base y=+0.055, cabin roof peak y=+0.020, tail end y=-0.090
    d = Z_FUSE_DATUM
    stations = [
        (0.0960, 0.0052, d + 0.0055, d - 0.0050, 2.0),  # Behind spinner flange
        (0.0940, 0.0092, d + 0.0085, d - 0.0075, 2.1),  # Front cowling ring
        (0.0890, 0.0124, d + 0.0102, d - 0.0105, 2.3),  # Cowling intakes station
        (0.0800, 0.0140, d + 0.0110, d - 0.0120, 2.4),  # Mid cowling
        (0.0680, 0.0148, d + 0.0116, d - 0.0126, 2.4),  # Rear cowling / firewall
        (0.0560, 0.0153, d + 0.0125, d - 0.0130, 2.5),  # Windshield base
        (0.0440, 0.0158, d + 0.0172, d - 0.0132, 2.6),  # Mid raked windshield
        (0.0320, 0.0160, d + 0.0206, d - 0.0132, 2.6),  # Windshield header / front seats
        (0.0180, 0.0159, d + 0.0212, d - 0.0130, 2.6),  # Cabin crown (49" wide x 50" tall!)
        (0.0020, 0.0154, d + 0.0204, d - 0.0122, 2.5),  # Rear seats
        (-0.0140, 0.0142, d + 0.0184, d - 0.0108, 2.4), # Aft cabin / CAPS compartment front
        (-0.0280, 0.0122, d + 0.0158, d - 0.0090, 2.3), # CAPS hatch center!
        (-0.0420, 0.0100, d + 0.0132, d - 0.0072, 2.2), # Tailcone taper
        (-0.0560, 0.0078, d + 0.0108, d - 0.0052, 2.1), # Mid tailcone
        (-0.0700, 0.0056, d + 0.0086, d - 0.0032, 2.0), # Aft tailcone
        (-0.0820, 0.0034, d + 0.0070, d - 0.0014, 2.0), # Tail base
        (-0.0900, 0.0012, d + 0.0055, d + 0.0005, 2.0), # Tailcone end cap
    ]

    segs = 28
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new("UVMap")
    rings = []

    for y, hw, zt, zb, exp in stations:
        zc = 0.5 * (zt + zb)
        hz = 0.5 * (zt - zb)
        ring = []
        for i in range(segs):
            th = (2.0 * math.pi * i) / segs  # 0=+X, pi/2=+Z, pi=-X, 3pi/2=-Z
            ct, st = math.cos(th), math.sin(th)
            # Superellipse cross-section for authentic rounded-square Cirrus shoulder width
            sx = math.copysign(abs(ct) ** (2.0 / exp), ct)
            sz = math.copysign(abs(st) ** (2.0 / exp), st)
            vx = hw * sx
            vz = zc + hz * sz
            ring.append(bm.verts.new((vx, y, vz)))
        rings.append(ring)

    # Connect rings into smooth quads
    for ri in range(len(rings) - 1):
        r0 = rings[ri]
        r1 = rings[ri + 1]
        for i in range(segs):
            j = (i + 1) % segs
            f = bm.faces.new((r0[i], r0[j], r1[j], r1[i]))
            f.smooth = True

    # Cap front & rear cleanly
    f_front = bm.faces.new(list(reversed(rings[0])))
    f_front.smooth = True
    f_back = bm.faces.new(rings[-1])
    f_back.smooth = True

    # Assign planar side-projection UVs matching the upper half of cirrus_sr22_livery.jpg
    for f in bm.faces:
        for loop in f.loops:
            co = loop.vert.co
            u = max(0.005, min(0.995, (co.y - Y_TAIL_END) / (Y_SPINNER_TIP - Y_TAIL_END)))
            v = max(0.505, min(0.985, 0.52 + ((co.z - 0.010) / 0.068) * 0.44))
            loop[uv_layer].uv = (u, v)

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new("SR22_FuselageM")
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new("SR22_Fuselage", mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mats["livery"])
    set_smooth(obj)
    return obj


def build_caps_hatch(mats):
    """Build the signature flush-mounted dorsal CAPS parachute hatch on the aft fuselage spine."""
    d = Z_FUSE_DATUM
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new("UVMap")

    # Conforms precisely to fuselage upper spine from y=-0.014 to y=-0.036
    y_vals = [-0.015, -0.020, -0.026, -0.032, -0.036]
    x_half = [0.0068, 0.0072, 0.0068, 0.0060, 0.0050]
    z_top = [d + 0.0185, d + 0.0176, d + 0.0165, d + 0.0153, d + 0.0145]

    cols = 7
    grid = []
    for ri, y in enumerate(y_vals):
        row = []
        hw = x_half[ri]
        zt = z_top[ri]
        for ci in range(cols):
            t = -1.0 + 2.0 * (ci / (cols - 1))
            vx = hw * t
            # Parabolic crown matching the fuselage spine curvature + 0.45 mm proud panel bezel
            vz = zt - 0.0014 * (t * t) + 0.00045
            row.append(bm.verts.new((vx, y, vz)))
        grid.append(row)

    for ri in range(len(grid) - 1):
        for ci in range(cols - 1):
            f = bm.faces.new((grid[ri][ci], grid[ri][ci + 1], grid[ri + 1][ci + 1], grid[ri + 1][ci]))
            f.smooth = True
            for loop in f.loops:
                co = loop.vert.co
                u_norm = (co.x / 0.0076) * 0.5 + 0.5  # 0..1 across width
                v_norm = (co.y - (-0.036)) / ((-0.015) - (-0.036))  # 0..1 aft..fwd
                loop[uv_layer].uv = (0.64 + u_norm * 0.28, 0.11 + v_norm * 0.28)

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new("SR22_CAPSHatchM")
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("SR22_CAPSHatch", mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mats["livery"])
    set_smooth(obj)
    return obj


def build_cabin_windows(mats):
    """Build flush, curved dark-tinted wrap-around windshield & swept side cabin windows."""
    d = Z_FUSE_DATUM
    bm = bmesh.new()

    def fuse_profile(y):
        """Interpolate fuselage (hw, zt, zb, exp) along y."""
        pts = [
            (0.0560, 0.0153, d + 0.0125, d - 0.0130, 2.5),
            (0.0440, 0.0158, d + 0.0172, d - 0.0132, 2.6),
            (0.0320, 0.0160, d + 0.0206, d - 0.0132, 2.6),
            (0.0180, 0.0159, d + 0.0212, d - 0.0130, 2.6),
            (0.0020, 0.0154, d + 0.0204, d - 0.0122, 2.5),
            (-0.0140, 0.0142, d + 0.0184, d - 0.0108, 2.4),
        ]
        for i in range(len(pts) - 1):
            y0, hw0, zt0, zb0, e0 = pts[i]
            y1, hw1, zt1, zb1, e1 = pts[i + 1]
            if y0 >= y >= y1:
                t = (y0 - y) / (y0 - y1)
                return (
                    hw0 + (hw1 - hw0) * t,
                    zt0 + (zt1 - zt0) * t,
                    zb0 + (zb1 - zb0) * t,
                    e0 + (e1 - e0) * t,
                )
        return pts[-1][1:]

    def fuse_pt(y, th, lift=0.00045):
        hw, zt, zb, exp = fuse_profile(y)
        zc = 0.5 * (zt + zb)
        hz = 0.5 * (zt - zb)
        ct, st = math.cos(th), math.sin(th)
        sx = math.copysign(abs(ct) ** (2.0 / exp), ct)
        sz = math.copysign(abs(st) ** (2.0 / exp), st)
        nx, nz = sx, sz
        nl = math.hypot(nx, nz) + 1e-9
        return (hw * sx + lift * (nx / nl), y, zc + hz * sz + lift * (nz / nl))

    # 1. Wrap-around raked front windshield (theta from 20 deg to 160 deg, y from 0.055 to 0.032)
    ny, nt_s = 7, 15
    grid = []
    for iy in range(ny):
        fy = iy / (ny - 1)
        y = 0.0555 - fy * 0.0235
        row = []
        for it in range(nt_s):
            ft = it / (nt_s - 1)
            # Slightly narrower at bottom corners, wider along top header
            th_min = math.radians(24 - fy * 6)
            th_max = math.radians(156 + fy * 6)
            th = th_min + ft * (th_max - th_min)
            row.append(bm.verts.new(fuse_pt(y, th, lift=0.00055)))
        grid.append(row)
    for iy in range(ny - 1):
        for it in range(nt_s - 1):
            f = bm.faces.new((grid[iy][it], grid[iy][it + 1], grid[iy + 1][it + 1], grid[iy + 1][it]))
            f.smooth = True

    # 2. Left & Right swept front door windows + rear teardrop passenger windows (distinctive SR22 silhouette!)
    for side in (-1, 1):
        # Front cabin door window (y: +0.030 .. +0.008) & Rear passenger window (y: +0.004 .. -0.012)
        win_defs = [
            # (y_fwd, y_aft, th_bot_fwd, th_bot_aft, th_top_fwd, th_top_aft)
            (0.0305, 0.0085, 8.0, 12.0, 58.0, 56.0),
            (0.0045, -0.0115, 14.0, 26.0, 54.0, 44.0),
        ]
        for yf, ya, b0, b1, t0, t1 in win_defs:
            g = []
            for iy in range(6):
                fy = iy / 5.0
                y = yf + (ya - yf) * fy
                # Rounded corners via smooth end squeeze
                end_taper = math.sin(fy * math.pi) ** 0.25
                tb = b0 + (b1 - b0) * fy
                tt = t0 + (t1 - t0) * fy
                mid = 0.5 * (tb + tt)
                half = 0.5 * (tt - tb) * (0.68 + 0.32 * end_taper)
                row = []
                for iz in range(5):
                    fz = iz / 4.0
                    deg = (mid - half) + fz * (2.0 * half)
                    th = math.radians(deg) if side > 0 else math.radians(180.0 - deg)
                    row.append(bm.verts.new(fuse_pt(y, th, lift=0.00050)))
                g.append(row)
            for iy in range(5):
                for iz in range(4):
                    if side > 0:
                        f = bm.faces.new((g[iy][iz], g[iy][iz + 1], g[iy + 1][iz + 1], g[iy + 1][iz]))
                    else:
                        f = bm.faces.new((g[iy][iz], g[iy + 1][iz], g[iy + 1][iz + 1], g[iy][iz + 1]))
                    f.smooth = True

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new("SR22_CabinGlassM")
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("SR22_CabinGlass", mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mats["glass"])
    set_smooth(obj)
    return obj


def build_cowling_intakes_and_prop(mats):
    """Build Cirrus twin kidney cooling intakes, chin scoop, parabolic spinner, and 3-blade Hartzell scimitar prop."""
    d = Z_FUSE_DATUM
    objs = []

    # 1. Twin side-by-side Cirrus cowling cooling intake dark cavities + lower chin air scoop
    for side in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, radius=1.0, location=(side * 0.0072, 0.0942, d + 0.0004))
        o = bpy.context.active_object
        o.name = f"SR22_CowlIntake_{'R' if side > 0 else 'L'}"
        o.scale = (0.0036, 0.0022, 0.0026)
        o.rotation_euler.z = side * math.radians(-16)
        bpy.ops.object.transform_apply(scale=True, rotation=True)
        o.data.materials.append(mats["intake"])
        set_smooth(o)
        objs.append(o)

    # Lower chin induction/oil-cooler air scoop beneath spinner
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, radius=1.0, location=(0.0, 0.0915, d - 0.0086))
    chin = bpy.context.active_object
    chin.name = "SR22_ChinScoop"
    chin.scale = (0.0048, 0.0042, 0.0024)
    bpy.ops.object.transform_apply(scale=True)
    chin.data.materials.append(mats["intake"])
    set_smooth(chin)
    objs.append(chin)

    # 2. Glossy White Parabolic Spinner Cone (y: +0.0955 .. +0.1080)
    bm = bmesh.new()
    segs = 24
    rings = []
    for i in range(9):
        t = i / 8.0  # 0=base, 1=tip
        y = 0.0955 + t * (Y_SPINNER_TIP - 0.0955)
        rad = 0.0056 * ((1.0 - t) ** 0.56)
        if i == 8:
            rad = 0.00025
        ring = [bm.verts.new((rad * math.cos(2 * math.pi * k / segs), y, d + 0.0005 + rad * math.sin(2 * math.pi * k / segs))) for k in range(segs)]
        rings.append(ring)
    for ri in range(len(rings) - 1):
        for k in range(segs):
            k2 = (k + 1) % segs
            f = bm.faces.new((rings[ri][k], rings[ri][k2], rings[ri + 1][k2], rings[ri + 1][k]))
            f.smooth = True
    bm.faces.new(rings[-1]).smooth = True
    bm.faces.new(list(reversed(rings[0]))).smooth = True
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    smesh = bpy.data.meshes.new("SR22_SpinnerM")
    bm.to_mesh(smesh)
    bm.free()
    spinner = bpy.data.objects.new("SR22_Spinner", smesh)
    bpy.context.collection.objects.link(spinner)
    spinner.data.materials.append(mats["white"])
    set_smooth(spinner)
    objs.append(spinner)

    # 3. 3-Blade Twisted Hartzell Scimitar Composite Propeller (diameter = 49.5 mm)
    bm = bmesh.new()
    for b_idx in range(3):
        ang0 = math.radians(b_idx * 120.0 + 18.0)
        rot_y = Matrix.Rotation(ang0, 4, "Y")
        # Build sleek twisted scimitar blade from r=0.0038 to r=PROP_RAD (0.02475 m)
        n_r = 9
        ring_verts = []
        for ir in range(n_r):
            fr = ir / (n_r - 1)
            r = 0.0038 + fr * (PROP_RAD - 0.0038)
            chord = 0.0016 + 0.0024 * math.sin(fr * math.pi * 0.88) * (1.0 - 0.25 * fr)
            thick = 0.00055 * (1.0 - 0.65 * fr)
            pitch = math.radians(42.0 - 22.0 * fr)
            sweep = -0.0014 * (fr ** 2)  # Signature Hartzell scimitar sweep!
            # 6-point airfoil cross section in local (x_c, y_t)
            prof = [
                (0.50 * chord, 0.0),
                (0.15 * chord, 0.50 * thick),
                (-0.45 * chord, 0.28 * thick),
                (-0.50 * chord, 0.0),
                (-0.45 * chord, -0.22 * thick),
                (0.15 * chord, -0.35 * thick),
            ]
            ring = []
            cp, sp = math.cos(pitch), math.sin(pitch)
            for cx, cy in prof:
                lx = cx * cp - cy * sp + sweep
                ly = cx * sp + cy * cp
                pt = rot_y @ Vector((lx, 0.0, r))
                ring.append(bm.verts.new((pt.x, 0.0992 + ly, d + 0.0005 + pt.z)))
            ring_verts.append(ring)
        for ir in range(n_r - 1):
            for k in range(6):
                k2 = (k + 1) % 6
                f = bm.faces.new((ring_verts[ir][k], ring_verts[ir][k2], ring_verts[ir + 1][k2], ring_verts[ir + 1][k]))
                f.smooth = True
        bm.faces.new(ring_verts[-1]).smooth = True

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    pmesh = bpy.data.meshes.new("SR22_PropBladesM")
    bm.to_mesh(pmesh)
    bm.free()
    prop = bpy.data.objects.new("SR22_PropBlades", pmesh)
    bpy.context.collection.objects.link(prop)
    prop.data.materials.append(mats["prop"])
    set_smooth(prop)
    objs.append(prop)

    # Crimson prop-tip safety bands on all 3 blades
    bm_t = bmesh.new()
    for b_idx in range(3):
        ang0 = math.radians(b_idx * 120.0 + 18.0)
        rot_y = Matrix.Rotation(ang0, 4, "Y")
        r0, r1 = PROP_RAD - 0.0032, PROP_RAD - 0.0006
        rings = []
        for r in (r0, r1):
            ring = []
            for k in range(6):
                th = 2 * math.pi * k / 6
                lx = 0.0014 * math.cos(th) - 0.0012
                ly = 0.00038 * math.sin(th)
                pt = rot_y @ Vector((lx, 0.0, r))
                ring.append(bm_t.verts.new((pt.x, 0.0992 + ly, d + 0.0005 + pt.z)))
            rings.append(ring)
        for k in range(6):
            k2 = (k + 1) % 6
            bm_t.faces.new((rings[0][k], rings[0][k2], rings[1][k2], rings[1][k])).smooth = True
    bmesh.ops.recalc_face_normals(bm_t, faces=bm_t.faces)
    tmesh = bpy.data.meshes.new("SR22_PropTipsM")
    bm_t.to_mesh(tmesh)
    bm_t.free()
    ptips = bpy.data.objects.new("SR22_PropTips", tmesh)
    bpy.context.collection.objects.link(ptips)
    ptips.data.materials.append(mats["crimson"])
    set_smooth(ptips)
    objs.append(ptips)

    return objs


def airfoil_pts(chord, thick, n_half=7):
    """NACA 2412-like cambered airfoil profile (x_chord from +LE to -TE, z_thick)."""
    pts = []
    # Upper surface from LE (0) to TE (1)
    for i in range(n_half):
        t = (1.0 - math.cos(math.pi * i / (n_half - 1))) * 0.5
        yt = 5.0 * thick * (0.2969 * math.sqrt(max(t, 0.0)) - 0.1260 * t - 0.3516 * t**2 + 0.2843 * t**3 - 0.1015 * t**4)
        yc = 0.02 * chord * 4.0 * t * (1.0 - t)
        pts.append(((0.32 - t) * chord, yc + yt))
    # Lower surface from TE back to LE
    for i in range(n_half - 2, 0, -1):
        t = (1.0 - math.cos(math.pi * i / (n_half - 1))) * 0.5
        yt = 5.0 * thick * (0.2969 * math.sqrt(max(t, 0.0)) - 0.1260 * t - 0.3516 * t**2 + 0.2843 * t**3 - 0.1015 * t**4)
        yc = 0.02 * chord * 4.0 * t * (1.0 - t)
        pts.append(((0.32 - t) * chord, yc - yt * 0.85))
    return pts


def build_wings_and_tail(mats):
    """Build low wing (with 5 deg dihedral, cuffed outboard LE, Spectra wingtips, nav lights, steps, pitot) + empennage."""
    d = Z_FUSE_DATUM
    objs = []

    # 1. Left & Right Low Wings (span = 292 mm, exact Cirrus SR22 tapered planform + cuffed outboard LE!)
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new("UVMap")
    dihedral = math.radians(5.0)
    z_root = d - 0.0086

    # Wing stations: (span_x, y_le, chord, thick_ratio, tip_cant_z)
    # Note the authentic Cirrus SR22 cuffed leading-edge step forward at span_x = 0.084 (58% semispan)!
    w_stations = [
        (0.0110, 0.0445, 0.0410, 0.15, 0.0),      # Root inside fuselage fillet
        (0.0200, 0.0415, 0.0375, 0.145, 0.0),     # Wing-root Karman fillet end
        (0.0520, 0.0390, 0.0340, 0.135, 0.0),     # Mid-inboard wing (main gear mount)
        (0.0815, 0.0365, 0.0308, 0.130, 0.0),     # Just inboard of SR22 leading-edge cuff
        (0.0840, 0.0384, 0.0322, 0.132, 0.0),     # Iconic Cirrus SR22 cuffed/drooped outboard LE!
        (0.1180, 0.0338, 0.0260, 0.120, 0.0),     # Mid-outboard wing
        (0.1395, 0.0298, 0.0205, 0.110, 0.0012),  # Wingtip transition (Spectra upswept tip)
        (0.1460, 0.0258, 0.0135, 0.095, 0.0038),  # Spectra wingtip cap
    ]

    for side in (-1, 1):
        rings = []
        for sx, y_le, chord, tr, z_cant in w_stations:
            prof = airfoil_pts(chord, chord * tr, n_half=7)
            y_ref = y_le - 0.32 * chord
            z_base = z_root + sx * math.tan(dihedral) + z_cant
            ring = []
            for dy, dz in prof:
                vx = side * sx
                vy = y_ref + dy
                vz = z_base + dz
                ring.append(bm.verts.new((vx, vy, vz)))
            rings.append(ring)

        n_p = len(rings[0])
        for ri in range(len(rings) - 1):
            for k in range(n_p):
                k2 = (k + 1) % n_p
                if side > 0:
                    f = bm.faces.new((rings[ri][k], rings[ri][k2], rings[ri + 1][k2], rings[ri + 1][k]))
                else:
                    f = bm.faces.new((rings[ri][k], rings[ri + 1][k], rings[ri + 1][k2], rings[ri][k2]))
                f.smooth = True
        # Cap wingtip cleanly
        cap = bm.faces.new(rings[-1] if side > 0 else list(reversed(rings[-1])))
        cap.smooth = True

    # UV map wings onto the lower-left wing zone of cirrus_sr22_livery.jpg (U: 0.02..0.53, V: 0.04..0.44)
    for f in bm.faces:
        for loop in f.loops:
            co = loop.vert.co
            u_span = min(1.0, abs(co.x) / HALF_SPAN)
            v_chord = max(0.0, min(1.0, (co.y - 0.002) / 0.044))
            loop[uv_layer].uv = (0.02 + u_span * 0.51, 0.04 + v_chord * 0.40)

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    wmesh = bpy.data.meshes.new("SR22_WingsM")
    bm.to_mesh(wmesh)
    bm.free()
    wings = bpy.data.objects.new("SR22_Wings", wmesh)
    bpy.context.collection.objects.link(wings)
    wings.data.materials.append(mats["livery"])
    set_smooth(wings)
    objs.append(wings)

    # Spectra LED wingtip navigation lights tucked sleekly into wingtip leading edge (Red Port / Green Starboard)
    for side, mkey in ((-1, "nav_red"), (1, "nav_green")):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=8, radius=0.00105, location=(side * 0.1456, 0.0242, z_root + 0.145 * math.tan(dihedral) + 0.0038))
        nav = bpy.context.active_object
        nav.name = f"SR22_NavLight_{'R' if side > 0 else 'L'}"
        nav.scale = (0.75, 1.6, 0.65)
        bpy.ops.object.transform_apply(scale=True)
        nav.data.materials.append(mats[mkey])
        set_smooth(nav)
        objs.append(nav)

    # Signature Cirrus compact rear-facing cabin boarding steps tucked behind the wing trailing edge
    for side in (-1, 1):
        bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.00050, depth=0.0062, location=(side * 0.0160, -0.0018, d - 0.0118))
        step = bpy.context.active_object
        step.name = f"SR22_CabinStep_{'R' if side > 0 else 'L'}"
        step.rotation_euler.y = side * math.radians(38)
        bpy.ops.object.transform_apply(rotation=True)
        step.data.materials.append(mats["carbon"])
        set_smooth(step)
        objs.append(step)

    # Port under-wing stainless L-shaped pitot tube
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.00035, depth=0.0065, location=(-0.068, 0.032, z_root + 0.068 * math.tan(dihedral) - 0.0042))
    pitot = bpy.context.active_object
    pitot.name = "SR22_PitotTube"
    pitot.rotation_euler.x = math.radians(90)
    bpy.ops.object.transform_apply(rotation=True)
    pitot.data.materials.append(mats["chrome"])
    objs.append(pitot)

    # 2. Vertical Stabilizer with Curved Dorsal Fin Fillet (Height = 68 mm total from Z=0!)
    bm_v = bmesh.new()
    uv_v = bm_v.loops.layers.uv.new("UVMap")
    v_stations = [
        (d + 0.0055, -0.0440, 0.0440, 0.0038),  # Smooth forward dorsal fillet base
        (d + 0.0110, -0.0560, 0.0335, 0.0034),  # Lower fin
        (d + 0.0220, -0.0645, 0.0260, 0.0028),  # Mid fin
        (d + 0.0335, -0.0725, 0.0195, 0.0022),  # Upper fin
        (d + 0.0385, -0.0770, 0.0135, 0.0014),  # Rounded tip cap (Z = 0.0680 m = 68 mm!)
    ]
    v_rings = []
    for vz, y_le, chord, thick in v_stations:
        prof = airfoil_pts(chord, thick, n_half=6)
        y_ref = y_le - 0.32 * chord
        ring = [bm_v.verts.new((dz, y_ref + dy, vz)) for dy, dz in prof]
        v_rings.append(ring)
    n_vp = len(v_rings[0])
    for ri in range(len(v_rings) - 1):
        for k in range(n_vp):
            k2 = (k + 1) % n_vp
            f = bm_v.faces.new((v_rings[ri][k], v_rings[ri][k2], v_rings[ri + 1][k2], v_rings[ri + 1][k]))
            f.smooth = True
    bm_v.faces.new(v_rings[-1]).smooth = True

    for f in bm_v.faces:
        for loop in f.loops:
            co = loop.vert.co
            u = max(0.005, min(0.995, (co.y - Y_TAIL_END) / (Y_SPINNER_TIP - Y_TAIL_END)))
            v = max(0.505, min(0.985, 0.52 + ((co.z - 0.010) / 0.068) * 0.44))
            loop[uv_v].uv = (u, v)

    bmesh.ops.recalc_face_normals(bm_v, faces=bm_v.faces)
    vmesh = bpy.data.meshes.new("SR22_VerticalTailM")
    bm_v.to_mesh(vmesh)
    bm_v.free()
    vtail = bpy.data.objects.new("SR22_VerticalTail", vmesh)
    bpy.context.collection.objects.link(vtail)
    vtail.data.materials.append(mats["livery"])
    set_smooth(vtail)
    objs.append(vtail)

    # Red anti-collision beacon lens on top of vertical stabilizer
    bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=8, radius=0.0014, location=(0.0, -0.0795, d + 0.0392))
    beacon = bpy.context.active_object
    beacon.name = "SR22_TailBeacon"
    beacon.data.materials.append(mats["nav_red"])
    set_smooth(beacon)
    objs.append(beacon)

    # 3. Horizontal Stabilizer (Tailplane, span = 96 mm)
    bm_h = bmesh.new()
    h_stations = [
        (0.0020, -0.0665, 0.0225, 0.11),
        (0.0260, -0.0705, 0.0190, 0.10),
        (0.0440, -0.0740, 0.0145, 0.095),
        (0.0485, -0.0762, 0.0095, 0.085),
    ]
    z_ht = d + 0.0055
    for side in (-1, 1):
        h_rings = []
        for sx, y_le, chord, tr in h_stations:
            prof = airfoil_pts(chord, chord * tr, n_half=6)
            y_ref = y_le - 0.32 * chord
            ring = [bm_h.verts.new((side * sx, y_ref + dy, z_ht + dz)) for dy, dz in prof]
            h_rings.append(ring)
        n_hp = len(h_rings[0])
        for ri in range(len(h_rings) - 1):
            for k in range(n_hp):
                k2 = (k + 1) % n_hp
                if side > 0:
                    f = bm_h.faces.new((h_rings[ri][k], h_rings[ri][k2], h_rings[ri + 1][k2], h_rings[ri + 1][k]))
                else:
                    f = bm_h.faces.new((h_rings[ri][k], h_rings[ri + 1][k], h_rings[ri + 1][k2], h_rings[ri][k2]))
                f.smooth = True
        bm_h.faces.new(h_rings[-1] if side > 0 else list(reversed(h_rings[-1]))).smooth = True
    bmesh.ops.recalc_face_normals(bm_h, faces=bm_h.faces)
    hmesh = bpy.data.meshes.new("SR22_HorizTailM")
    bm_h.to_mesh(hmesh)
    bm_h.free()
    htail = bpy.data.objects.new("SR22_HorizTail", hmesh)
    bpy.context.collection.objects.link(htail)
    htail.data.materials.append(mats["white"])
    set_smooth(htail)
    objs.append(htail)

    return objs


def make_wheel_pant(name, cx, cy, pant_len, pant_w, pant_h, tire_r, tire_w, mats):
    """Build a sculpted aerodynamic Cirrus composite wheel fairing (pant/spat) + black rubber tire resting at Z=0."""
    objs = []
    # Teardrop composite wheel fairing sculpted along Y (nose=+Y, pointed tail=-Y)
    bm = bmesh.new()
    segs = 18
    rings = []
    z_pant = tire_r * 1.18
    for i in range(11):
        t = i / 10.0  # 0=front nose, 1=pointed rear tail
        y = cy + pant_len * (0.42 - t)
        # Authentic Cirrus G6/G7 streamlined teardrop profile
        env = math.sin(math.pi * (t ** 0.72)) if t < 0.99 else 0.04
        rw = (pant_w * 0.5) * max(0.05, env)
        rh = (pant_h * 0.5) * max(0.05, env)
        z_drop = -0.0012 * (t - 0.35)
        ring = []
        for k in range(segs):
            th = 2 * math.pi * k / segs
            vx = cx + rw * math.cos(th)
            # Slightly flattened lower skirt around tire opening
            sv = math.sin(th)
            vz = z_pant + z_drop + rh * (sv if sv >= 0 else sv * 0.80)
            ring.append(bm.verts.new((vx, y, vz)))
        rings.append(ring)
    for ri in range(len(rings) - 1):
        for k in range(segs):
            k2 = (k + 1) % segs
            f = bm.faces.new((rings[ri][k], rings[ri][k2], rings[ri + 1][k2], rings[ri + 1][k]))
            f.smooth = True
    bm.faces.new(list(reversed(rings[0]))).smooth = True
    bm.faces.new(rings[-1]).smooth = True
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    pmesh = bpy.data.meshes.new(name + "M")
    bm.to_mesh(pmesh)
    bm.free()
    pant = bpy.data.objects.new(name, pmesh)
    bpy.context.collection.objects.link(pant)
    pant.data.materials.append(mats["white"])
    set_smooth(pant)
    objs.append(pant)

    # Matching carbon-charcoal lower accent band on the wheel fairing
    bpy.ops.mesh.primitive_cylinder_add(vertices=18, radius=tire_r, depth=tire_w, location=(cx, cy + pant_len * 0.06, tire_r))
    tire = bpy.context.active_object
    tire.name = name + "_Tire"
    tire.rotation_euler.y = math.radians(90)
    bpy.ops.object.transform_apply(rotation=True)
    # Bevel tire shoulders for plump realistic rubber sidewall
    bev = tire.modifiers.new("TireBev", "BEVEL")
    bev.width = tire_w * 0.28
    bev.segments = 2
    bpy.ops.object.modifier_apply(modifier=bev.name)
    tire.data.materials.append(mats["tire"])
    set_smooth(tire)
    objs.append(tire)
    return objs


def build_tricycle_gear(mats):
    """Build Cirrus SR22 signature fixed tricycle landing gear: faired main legs + nose leg + 3 wheel pants."""
    d = Z_FUSE_DATUM
    objs = []

    # 1. Main Landing Gear (Left & Right): swept aerodynamic struts from wing underside to main wheel pants
    main_x = 0.0365
    main_y = 0.0110
    main_tire_r = 0.0052
    for side in (-1, 1):
        # Swept faired main gear strut (elliptical aero cross-section)
        p0 = Vector((side * 0.0255, 0.0175, d - 0.0075))  # Wing underside socket
        p1 = Vector((side * main_x, main_y, main_tire_r * 1.25))  # Wheel pant entry
        mid = (p0 + p1) * 0.5
        vec = p1 - p0
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=1.0, depth=vec.length, location=mid)
        leg = bpy.context.active_object
        leg.name = f"SR22_MainGearLeg_{'R' if side > 0 else 'L'}"
        leg.scale = (0.0014, 0.0032, 1.0)
        leg.rotation_mode = "QUATERNION"
        leg.rotation_quaternion = vec.to_track_quat("Z", "Y")
        bpy.ops.object.transform_apply(scale=True, rotation=True)
        leg.data.materials.append(mats["white"])
        set_smooth(leg)
        objs.append(leg)

        # Wing-to-strut upper cuff fairing
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=1.0, location=p0 + Vector((0, 0, -0.001)))
        cuff = bpy.context.active_object
        cuff.name = f"SR22_MainGearCuff_{'R' if side > 0 else 'L'}"
        cuff.scale = (0.0028, 0.0055, 0.0024)
        bpy.ops.object.transform_apply(scale=True)
        cuff.data.materials.append(mats["white"])
        set_smooth(cuff)
        objs.append(cuff)

        objs.extend(make_wheel_pant(
            f"SR22_MainPant_{'R' if side > 0 else 'L'}",
            side * main_x, main_y,
            pant_len=0.0295, pant_w=0.0092, pant_h=0.0112,
            tire_r=main_tire_r, tire_w=0.0044,
            mats=mats,
        ))

    # 2. Fixed Nose Landing Gear: cantilevered forward-raked tubular/faired strut + nose wheel pant
    nose_y = 0.0725
    nose_tire_r = 0.0044
    np0 = Vector((0.0, 0.0685, d - 0.0105))  # Lower firewall mount
    np1 = Vector((0.0, nose_y, nose_tire_r * 1.28))
    nmid = (np0 + np1) * 0.5
    nvec = np1 - np0
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=1.0, depth=nvec.length, location=nmid)
    nleg = bpy.context.active_object
    nleg.name = "SR22_NoseGearLeg"
    nleg.scale = (0.0014, 0.0024, 1.0)
    nleg.rotation_mode = "QUATERNION"
    nleg.rotation_quaternion = nvec.to_track_quat("Z", "Y")
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    nleg.data.materials.append(mats["white"])
    set_smooth(nleg)
    objs.append(nleg)

    objs.extend(make_wheel_pant(
        "SR22_NosePant",
        0.0, nose_y,
        pant_len=0.0250, pant_w=0.0080, pant_h=0.0096,
        tire_r=nose_tire_r, tire_w=0.0038,
        mats=mats,
    ))

    # Subtle twin exhaust pipes protruding cleanly under rear firewall cowling
    for side in (-1, 1):
        bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.00085, depth=0.007, location=(side * 0.0052, 0.065, d - 0.0138))
        exh = bpy.context.active_object
        exh.name = f"SR22_Exhaust_{'R' if side > 0 else 'L'}"
        exh.rotation_euler.x = math.radians(52)
        bpy.ops.object.transform_apply(rotation=True)
        exh.data.materials.append(mats["chrome"])
        set_smooth(exh)
        objs.append(exh)

    return objs


def build_antennas(mats):
    """Build dorsal COM VHF whip antenna & ventral transponder blade antenna."""
    d = Z_FUSE_DATUM
    objs = []
    # Dorsal swept-back white VHF blade antenna behind cabin crown
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.00045, depth=0.0115, location=(0.0, 0.004, d + 0.0245))
    ant = bpy.context.active_object
    ant.name = "SR22_ComAntenna"
    ant.scale = (0.45, 2.2, 1.0)
    ant.rotation_euler.x = math.radians(-24)
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    ant.data.materials.append(mats["white"])
    objs.append(ant)
    return objs


def ground_and_merge_by_material():
    """Shift entire aircraft so lowest tire vertex sits strictly at Z = 0.000, then merge static parts by material."""
    mesh_objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    min_z = min((o.matrix_world @ v.co).z for o in mesh_objs for v in o.data.vertices)
    for o in mesh_objs:
        o.location.z -= min_z
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    # Merge objects sharing the exact same single material to keep GLB draw calls minimal (~8 meshes total!)
    by_mat = {}
    for o in list(bpy.context.scene.objects):
        if o.type == "MESH" and len(o.material_slots) == 1 and o.material_slots[0].material:
            by_mat.setdefault(o.material_slots[0].material.name, []).append(o)
    for mname, group in by_mat.items():
        if len(group) < 2:
            continue
        bpy.ops.object.select_all(action="DESELECT")
        for o in group:
            o.select_set(True)
        bpy.context.view_layer.objects.active = group[0]
        bpy.ops.object.join()
        group[0].name = mname
    bpy.ops.object.select_all(action="DESELECT")


def render_previews():
    """Render 3 Cycles studio preview images (3/4 hero, side profile, top view) to /tmp for visual inspection."""
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.use_denoising = False
    scene.cycles.samples = 28
    scene.render.resolution_x = 900
    scene.render.resolution_y = 600
    scene.render.image_settings.file_format = "PNG"

    # Bright studio world + key/rim lighting
    world = bpy.data.worlds.new("StudioWorld")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.72, 0.74, 0.78, 1.0)
    bg.inputs[1].default_value = 0.75

    # Warm wood tabletop stand plane for preview only (removed before export!)
    bpy.ops.mesh.primitive_plane_add(size=1.2, location=(0, 0, -0.0002))
    floor = bpy.context.active_object
    floor.name = "_PreviewFloor"
    fm = bpy.data.materials.new("_PreviewWood")
    fm.use_nodes = True
    fm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.28, 0.17, 0.10, 1.0)
    fm.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.55
    floor.data.materials.append(fm)

    # Key & fill area lights
    lights = []
    for lname, loc, energy, size in (
        ("_KeyL", (0.35, 0.35, 0.42), 18.0, 0.35),
        ("_FillL", (-0.38, 0.15, 0.28), 8.0, 0.45),
        ("_RimL", (0.0, -0.45, 0.30), 10.0, 0.30),
    ):
        ld = bpy.data.lights.new(lname, type="AREA")
        ld.energy = energy
        ld.size = size
        lo = bpy.data.objects.new(lname, ld)
        bpy.context.collection.objects.link(lo)
        lo.location = loc
        direction = Vector((0.0, 0.01, 0.03)) - Vector(loc)
        lo.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        lights.append(lo)

    cam_d = bpy.data.cameras.new("_PreviewCam")
    cam_d.lens = 58
    cam = bpy.data.objects.new("_PreviewCam", cam_d)
    bpy.context.collection.objects.link(cam)
    scene.camera = cam

    views = [
        ("/tmp/sr22_preview_3q.png", (0.24, 0.23, 0.125), (0.0, 0.010, 0.028)),
        ("/tmp/sr22_preview_side.png", (0.34, 0.008, 0.040), (0.0, 0.008, 0.032)),
        ("/tmp/sr22_preview_top.png", (0.0, -0.02, 0.42), (0.0, 0.008, 0.024)),
    ]
    for path, loc, tgt in views:
        cam.location = loc
        direction = Vector(tgt) - Vector(loc)
        cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)

    # Clean up preview helpers before saving/exporting
    for o in [floor, cam] + lights:
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.outliner.orphans_purge(do_recursive=True)


def main():
    clear_scene()
    livery_path = generate_livery_texture()
    mats = make_materials(livery_path)

    build_fuselage(mats)
    build_caps_hatch(mats)
    build_cabin_windows(mats)
    build_cowling_intakes_and_prop(mats)
    build_wings_and_tail(mats)
    build_tricycle_gear(mats)
    build_antennas(mats)
    ground_and_merge_by_material()

    # Measure verified bounding box
    mesh_objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    xs = [(o.matrix_world @ v.co).x for o in mesh_objs for v in o.data.vertices]
    ys = [(o.matrix_world @ v.co).y for o in mesh_objs for v in o.data.vertices]
    zs = [(o.matrix_world @ v.co).z for o in mesh_objs for v in o.data.vertices]
    tris = sum(len(o.data.polygons) for o in mesh_objs)
    print(f"SR22 BBOX: span={(max(xs)-min(xs))*1000:.1f}mm, len={(max(ys)-min(ys))*1000:.1f}mm, h={(max(zs)-min(zs))*1000:.1f}mm, minZ={min(zs)*1000:.2f}mm, meshes={len(mesh_objs)}, polys={tris}")

    # Save working .blend and export lightweight Y-up .glb
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_OUT)
    bpy.ops.export_scene.gltf(
        filepath=GLB_OUT,
        export_format="GLB",
        export_apply=True,
        export_yup=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_cameras=False,
        export_lights=False,
    )
    print(f"EXPORTED {GLB_OUT}: {os.path.getsize(GLB_OUT)/1024:.1f} KB")

    # Render Cycles studio previews for visual inspection
    render_previews()


if __name__ == "__main__":
    main()
