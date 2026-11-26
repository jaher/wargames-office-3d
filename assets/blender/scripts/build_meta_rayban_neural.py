#!/usr/bin/env python3
"""Build accurate Meta Ray-Ban Display Smart Glasses AND Meta Neural Band (sEMG Wristband) in headless Blender.

Geometry & PBR material modeling only (rendered live in Three.js in the browser — ZERO Blender Cycles rendering!).
Crafted to match the real Meta Ray-Ban Display ecosystem (Shiny Black + Charcoal Black Neural Band):
1. Meta Ray-Ban Display Glasses (~148 x 150 x 47 mm):
   - Classic Wayfarer silhouette in Shiny Black polished acetate with authentic sculpted nose bridge & thick smart temples
   - Subtle flush circular camera lens in upper-left frame corner + tiny white LED privacy indicator in upper-right corner
   - Iconic silver oval hinge pins on front corners & sleek silver Ray-Ban temple accents
   - Gently curved dark-tinted reflective Transitions lenses with ultra-subtle right-lens AR micro-display waveguide glint
2. Meta Neural Band (~70 x 56 x 26 mm elliptical sEMG wristband):
   - Sleek minimalist Charcoal Black high-performance soft-touch woven textile strap
   - Interior low-profile matte dark-titanium sEMG muscle-sensor contact pads & subtle outer status pill + clasp seam

Outputs:
  assets/blender/meta_rayban_display.blend
  assets/blender/meta_neural_band.blend
"""
import math
import os
import bpy
import bmesh
from mathutils import Vector
from PIL import Image, ImageDraw, ImageFont

MM = 0.001
OUT_DIR = os.path.abspath("/workspace/assets/blender")
TEX_DIR = os.path.join(OUT_DIR, "textures")
os.makedirs(TEX_DIR, exist_ok=True)


def _font(size, italic=False):
    paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif-BoldItalic.ttf" if italic else "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]
    for p in paths:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def generate_rayban_temple_logo():
    """Crisp silver Ray-Ban italic script emblem on glossy black temple background."""
    w, h = 512, 128
    img = Image.new("RGB", (w, h), (10, 11, 14))
    d = ImageDraw.Draw(img)
    f = _font(72, italic=True)
    text = "Ray-Ban"
    bb = d.textbbox((0, 0), text, font=f)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    d.text(((w - tw) // 2 - bb[0], (h - th) // 2 - bb[1] - 4), text, font=f, fill=(224, 228, 236))
    p = os.path.join(TEX_DIR, "meta_rb_temple_logo.png")
    img.save(p)
    return p


def generate_rayban_waveguide_texture():
    """Subtle Meta Ray-Ban Display right-lens reflective waveguide HUD & corner Ray-Ban etch."""
    w, h = 512, 384
    base = Image.new("RGB", (w, h), (18, 24, 30))
    emit = Image.new("RGB", (w, h), (0, 0, 0))
    db = ImageDraw.Draw(base)
    de = ImageDraw.Draw(emit)

    # Subtle diagonal geometric waveguide facet lines inside right-center optical combiner zone
    gx0, gy0, gx1, gy1 = 155, 105, 395, 295
    db.rounded_rectangle([gx0, gy0, gx1, gy1], radius=18, fill=(20, 38, 46), outline=(48, 128, 146), width=2)
    de.rounded_rectangle([gx0, gy0, gx1, gy1], radius=18, fill=(8, 34, 42), outline=(46, 172, 196), width=2)
    for k in range(-4, 14):
        x = gx0 + k * 24
        db.line([(x, gy0 + 6), (x - 42, gy1 - 6)], fill=(28, 56, 66), width=1)
        de.line([(x, gy0 + 6), (x - 42, gy1 - 6)], fill=(12, 46, 56), width=1)

    # Crisp minimalist Meta Display micro-HUD glyph (time + navigation arrow + subtle notification pill)
    f_hud = _font(32, italic=False)
    f_sm = _font(19, italic=False)
    de.text((gx0 + 34, gy0 + 34), "10:42", font=f_hud, fill=(138, 245, 230))
    de.text((gx0 + 36, gy0 + 82), "SF BAY  ·  18°C", font=f_sm, fill=(92, 206, 222))
    de.rounded_rectangle([gx0 + 34, gy0 + 118, gx1 - 34, gy0 + 156], radius=10, outline=(74, 192, 210), width=2)
    de.text((gx0 + 50, gy0 + 127), "NEURAL BAND READY", font=f_sm, fill=(120, 232, 220))
    db.text((gx0 + 34, gy0 + 34), "10:42", font=f_hud, fill=(138, 245, 230))

    # Subtle authentic white-etched Ray-Ban signature cleanly inside top-right lens corner
    f_rb = _font(24, italic=True)
    db.text((310, 38), "Ray-Ban", font=f_rb, fill=(214, 220, 228))
    de.text((310, 38), "Ray-Ban", font=f_rb, fill=(40, 44, 48))

    pb = os.path.join(TEX_DIR, "meta_rb_waveguide_base.png")
    pe = os.path.join(TEX_DIR, "meta_rb_waveguide_emit.png")
    base.save(pb)
    emit.save(pe)
    return pb, pe


def make_tex_mat(name, path, metallic=0.1, roughness=0.2, alpha=1.0, emit_path=None, emit_strength=0.0):
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
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        mat.blend_method = "BLEND"
    return mat


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0


def make_mat(name, color, metallic=0.1, roughness=0.3, alpha=1.0, emit=None, emit_strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if emit is not None:
        bsdf.inputs["Emission"].default_value = (*emit, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emit_strength
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        mat.blend_method = "BLEND"
    return mat


def add_box(name, size, loc, mat, bevel=0.0, segments=3, rot=(0, 0, 0)):
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


def add_cyl(name, r, depth, loc, rot, mat, verts=20):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(mat)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def _wayfarer_lens_loop(cx, cz, hw, hh, side_sign, n=40):
    """Return 2D (x, z) points for an authentic Ray-Ban Wayfarer / Meta Display squarish-trapezoid lens.
    `side_sign`: -1 for left (-X), +1 for right (+X).
    """
    pts = []
    for i in range(n):
        a = (i / n) * math.pi * 2.0
        ca, sa = math.cos(a), math.sin(a)
        # Superellipse exponent gives crisp Wayfarer flat top brow & squared upper corners, softer rounded lower cheek!
        exp = 3.6 if sa >= 0 else 2.45
        ux = math.copysign(abs(ca) ** (2.0 / exp), ca)
        uz = math.copysign(abs(sa) ** (2.0 / exp), sa)
        # Subtle Wayfarer trapezoid taper: wider across top brow, slightly narrower along bottom rim
        taper = 1.04 if uz > 0 else (1.0 + 0.06 * uz)
        x = ux * hw * taper
        z = uz * hh
        # Slight upward outer-corner brow flare (classic Wayfarer attitude!)
        if x * side_sign > 0 and z > 0:
            z += 1.8 * MM * (x * side_sign / hw) * (z / hh)
            x += 1.2 * MM * side_sign * (z / hh)
        # Gentle inward nasal relief near bridge
        if x * side_sign < 0 and z < 0:
            x -= 1.4 * MM * side_sign * (abs(z) / hh)
        pts.append((cx + x, cz + z))
    return pts


def _add_wayfarer_rim_band(name, cx, cz, hw, hh, rim_w, depth, side_sign, mat):
    """Build a solid beveled Wayfarer lens rim ring (inner aperture -> outer rim contour) with gentle wrap curve."""
    inner = _wayfarer_lens_loop(cx, cz, hw, hh, side_sign, n=44)
    # Outer rim is thicker along the bold top browline & outer endpiece, sleeker along the bottom rim
    outer = []
    for (ix, iz) in inner:
        dx = ix - cx
        dz = iz - cz
        dlen = max(1e-6, math.hypot(dx, dz))
        nx, nz = dx / dlen, dz / dlen
        # Bold top brow (5.6mm), strong outer corner (5.4mm), refined lower rim (4.2mm)
        rw = rim_w
        if nz > 0.2:
            rw += 1.3 * MM * nz
        if nx * side_sign > 0.35 and nz > 0.0:
            rw += 1.6 * MM * (nx * side_sign)
        outer.append((ix + nx * rw, iz + nz * rw))

    def wrap_y(x):
        # Gentle 6° ergonomic front wrap curvature (center slightly forward -Y, outer corners sweeping back +Y)
        return (x * x) * 0.65

    bm = bmesh.new()
    n = len(inner)
    half_d = depth * 0.5
    f_in, f_out, b_in, b_out = [], [], [], []
    for (ix, iz), (ox, oz) in zip(inner, outer):
        yi = wrap_y(ix)
        yo = wrap_y(ox)
        f_in.append(bm.verts.new((ix, yi - half_d, iz)))
        f_out.append(bm.verts.new((ox, yo - half_d, oz)))
        b_in.append(bm.verts.new((ix, yi + half_d, iz)))
        b_out.append(bm.verts.new((ox, yo + half_d, oz)))

    for i in range(n):
        ni = (i + 1) % n
        # Front face, back face, outer wall, inner lens groove wall
        for quad in [
            (f_in[i], f_out[i], f_out[ni], f_in[ni]),
            (b_in[i], b_in[ni], b_out[ni], b_out[i]),
            (f_out[i], b_out[i], b_out[ni], f_out[ni]),
            (f_in[i], f_in[ni], b_in[ni], b_in[i]),
        ]:
            f = bm.faces.new(quad)
            f.smooth = True

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name + "_M")
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)

    mod = obj.modifiers.new("Bevel", "BEVEL")
    mod.width = 1.25 * MM
    mod.segments = 3
    mod.limit_method = "ANGLE"
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.select_set(False)

    obj.data.materials.append(mat)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def _add_wayfarer_lens(name, cx, cz, hw, hh, side_sign, mat):
    """Build a gently curved UV-mapped Transitions lens matching the exact Wayfarer rim contour."""
    pts = _wayfarer_lens_loop(cx, cz, hw + 0.6 * MM, hh + 0.6 * MM, side_sign, n=44)
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")

    xs = [p[0] for p in pts]
    zs = [p[1] for p in pts]
    min_x, max_x = min(xs), max(xs)
    min_z, max_z = min(zs), max(zs)

    def wrap_y(x, z):
        # Slight convex optical meniscus dome + frame wrap
        dx = (x - cx) / max(hw, 1e-5)
        dz = (z - cz) / max(hh, 1e-5)
        dome = -1.6 * MM * (1.0 - min(1.0, dx * dx * 0.55 + dz * dz * 0.45))
        return (x * x) * 0.65 + dome

    th = 1.4 * MM
    front_v = [bm.verts.new((x, wrap_y(x, z) - th * 0.5, z)) for (x, z) in pts]
    back_v = [bm.verts.new((x, wrap_y(x, z) + th * 0.5, z)) for (x, z) in pts]

    # Front & back lens surfaces with clean 0..1 UVs (for waveguide display & Ray-Ban corner etching)
    f_front = bm.faces.new(front_v)
    f_back = bm.faces.new(back_v[::-1])
    for face in (f_front, f_back):
        face.smooth = True
        for loop in face.loops:
            vx, _, vz = loop.vert.co
            u = (vx - min_x) / max(1e-6, max_x - min_x)
            v = (vz - min_z) / max(1e-6, max_z - min_z)
            loop[uv].uv = (u, v)

    n = len(pts)
    for i in range(n):
        ni = (i + 1) % n
        f = bm.faces.new((front_v[i], back_v[i], back_v[ni], front_v[ni]))
        f.smooth = True

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name + "_M")
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def add_meta_display_temple(name, side, mat):
    """Build the signature chunky, flat-sided sculpted Meta Ray-Ban Display temple arm (150 mm long).
    Houses the LCoS optical projector (right temple), battery, touchpad & open-ear speakers.
    """
    s = side  # -1 left (-X), +1 right (+X)
    # Right temple is subtly thicker near hinge to house the LCoS optical display engine!
    extra_w = 0.9 * MM if s > 0 else 0.0
    # Control stations along Y (from hinge at y=5mm to curved ear tip resting near desk at y=148mm)
    stations = [
        # (cx, y, cz, width_x, height_z)
        (s * 71.5 * MM, 4.5 * MM, 34.0 * MM, 7.6 * MM + extra_w, 15.8 * MM),
        (s * 73.2 * MM, 28.0 * MM, 33.6 * MM, 7.4 * MM + extra_w, 15.2 * MM),
        (s * 73.4 * MM, 62.0 * MM, 32.8 * MM, 6.8 * MM + extra_w * 0.6, 13.8 * MM),
        (s * 71.8 * MM, 98.0 * MM, 30.8 * MM, 5.8 * MM, 11.4 * MM),
        (s * 68.5 * MM, 122.0 * MM, 24.5 * MM, 5.0 * MM, 9.2 * MM),
        (s * 63.5 * MM, 138.0 * MM, 13.5 * MM, 4.4 * MM, 7.8 * MM),
        (s * 59.5 * MM, 148.5 * MM, 4.4 * MM, 3.8 * MM, 6.6 * MM),
    ]

    # Chamfered flat-sided rectangular cross-section (signature Meta Ray-Ban Display look — NOT a round noodle!)
    def rect_prof(w, h):
        hw, hh = w * 0.5, h * 0.5
        c = min(hw, hh) * 0.34
        return [
            (-hw + c, -hh), (hw - c, -hh), (hw, -hh + c), (hw, hh - c),
            (hw - c, hh), (-hw + c, hh), (-hw, hh - c), (-hw, -hh + c),
        ]

    bm = bmesh.new()
    rings = []
    for (px, py, pz, w, h) in stations:
        ring = [bm.verts.new((px + dx, py, pz + dz)) for (dx, dz) in rect_prof(w, h)]
        rings.append(ring)

    np = len(rings[0])
    for ri in range(len(rings) - 1):
        for i in range(np):
            ni = (i + 1) % np
            f = bm.faces.new((rings[ri][i], rings[ri][ni], rings[ri + 1][ni], rings[ri + 1][i]))
            f.smooth = True
    bm.faces.new(rings[0][::-1]).smooth = True
    bm.faces.new(rings[-1]).smooth = True
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

    me = bpy.data.meshes.new(name + "_M")
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def add_planar_decal(name, w, h, loc, rot, mat):
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    hw, hh = w * 0.5, h * 0.5
    v0 = bm.verts.new((-hw, -hh, 0.0))
    v1 = bm.verts.new((hw, -hh, 0.0))
    v2 = bm.verts.new((hw, hh, 0.0))
    v3 = bm.verts.new((-hw, hh, 0.0))
    f = bm.faces.new((v0, v1, v2, v3))
    for loop, c in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        loop[uv].uv = c
    me = bpy.data.meshes.new(name + "_M")
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    obj.location = loc
    obj.rotation_euler = rot
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def build_meta_rayban_display():
    clear_scene()

    p_logo = generate_rayban_temple_logo()
    p_wg_b, p_wg_e = generate_rayban_waveguide_texture()

    # Shiny Black polished high-gloss acetate + hardware PBR materials
    acetate = make_mat("MetaRB_ShinyBlack", (0.014, 0.015, 0.019), metallic=0.08, roughness=0.11)
    nosepad_mat = make_mat("MetaRB_NosePad", (0.024, 0.026, 0.030), metallic=0.02, roughness=0.72)
    lens_left = make_mat("MetaRB_Lens", (0.032, 0.042, 0.052), metallic=0.16, roughness=0.04, alpha=0.52)
    lens_right = make_tex_mat("MetaRB_DisplayLens", p_wg_b, metallic=0.18, roughness=0.05, alpha=0.58, emit_path=p_wg_e, emit_strength=0.65)
    silver_pin = make_mat("MetaRB_SilverAccent", (0.82, 0.85, 0.90), metallic=0.96, roughness=0.15)
    hinge_steel = make_mat("MetaRB_SpringHinge", (0.66, 0.70, 0.76), metallic=0.94, roughness=0.22)
    cam_bezel = make_mat("MetaRB_CamBezel", (0.14, 0.16, 0.19), metallic=0.88, roughness=0.22)
    cam_glass = make_mat("MetaRB_CameraLens", (0.02, 0.05, 0.14), metallic=0.65, roughness=0.04)
    privacy_led = make_mat("MetaRB_PrivacyLED", (0.96, 0.98, 1.0), metallic=0.0, roughness=0.18, emit=(0.95, 0.98, 1.0), emit_strength=1.5)
    gold_pin = make_mat("MetaRB_ChargePin", (0.86, 0.68, 0.22), metallic=0.95, roughness=0.20)
    temple_logo_mat = make_tex_mat("MetaRB_TempleLogo", p_logo, metallic=0.45, roughness=0.20)

    # =========================================================================
    # 1. CHUNKY WAYFARER-INSPIRED FRONT FRAME (51-23-150, 47 mm height, 6.8 mm depth!)
    # =========================================================================
    lens_cx = 36.5 * MM  # 23 mm bridge + 51 mm lens width -> centers at ±36.5 mm!
    lens_cz = 25.0 * MM
    lens_hw = 25.5 * MM
    lens_hh = 19.6 * MM

    _add_wayfarer_rim_band("RayBan_RimL", -lens_cx, lens_cz, lens_hw, lens_hh, 4.4 * MM, 6.8 * MM, -1.0, acetate)
    _add_wayfarer_rim_band("RayBan_RimR", lens_cx, lens_cz, lens_hw, lens_hh, 4.4 * MM, 6.8 * MM, 1.0, acetate)

    # Sculpted integrated single Wayfarer saddle/keyhole nose bridge spanning flush between both inner rims
    add_box("RayBan_SaddleBridge", (24.5 * MM, 6.7 * MM, 11.8 * MM), (0, -0.15 * MM, lens_cz + 15.2 * MM), acetate, bevel=2.6 * MM)
    # Soft matte integrated nose pads + 3 subtle gold magnetic charging contacts under the bridge
    for sx in (-1.0, 1.0):
        add_box(f"RayBan_NosePad_{'R' if sx > 0 else 'L'}", (5.5 * MM, 6.5 * MM, 13.5 * MM), (sx * 10.6 * MM, 3.8 * MM, lens_cz + 2.5 * MM), nosepad_mat, bevel=1.8 * MM, rot=(0, sx * 0.22, sx * -0.18))
    for ci, cx in enumerate((-3.2, 0.0, 3.2)):
        add_cyl(f"RayBan_ChargePin_{ci}", 0.7 * MM, 1.0 * MM, (cx * MM, 3.1 * MM, lens_cz + 8.0 * MM), (math.pi / 2, 0, 0), gold_pin, 10)

    # Bold flared outer front endpieces (corners) transitioning smoothly into chunky smart temples!
    for sx in (-1.0, 1.0):
        tag = "R" if sx > 0 else "L"
        add_box(f"RayBan_Endpiece_{tag}", (18.5 * MM, 9.2 * MM, 16.5 * MM), (sx * 66.2 * MM, 2.2 * MM, lens_cz + 10.2 * MM), acetate, bevel=2.8 * MM)
        # Exposed brushed-steel 5-barrel spring hinge visible on inside corner
        add_box(f"RayBan_SpringHinge_{tag}", (4.2 * MM, 9.0 * MM, 8.2 * MM), (sx * 67.2 * MM, 5.2 * MM, lens_cz + 9.2 * MM), hinge_steel, bevel=0.8 * MM)
        # Iconic horizontal silver oval Ray-Ban Wayfarer front corner rivet pins!
        add_box(f"RayBan_OvalPin_{tag}", (5.4 * MM, 1.6 * MM, 2.2 * MM), (sx * 69.2 * MM, -2.5 * MM, lens_cz + 11.2 * MM), silver_pin, bevel=0.7 * MM)

    # Flush 12MP Ultra-Wide Camera (upper-left endpiece, -X) + Privacy Capture LED (upper-right endpiece, +X)
    cam_x, cam_y, cam_z = -62.5 * MM, -2.4 * MM, lens_cz + 12.2 * MM
    add_cyl("RayBan_CameraBezel", 3.6 * MM, 1.8 * MM, (cam_x, cam_y, cam_z), (math.pi / 2, 0, 0), cam_bezel, 20)
    add_cyl("RayBan_CameraOptic", 2.3 * MM, 2.1 * MM, (cam_x, cam_y - 0.3 * MM, cam_z), (math.pi / 2, 0, 0), cam_glass, 20)

    led_x, led_y, led_z = 62.5 * MM, -2.4 * MM, lens_cz + 12.2 * MM
    add_cyl("RayBan_LEDBezel", 2.5 * MM, 1.6 * MM, (led_x, led_y, led_z), (math.pi / 2, 0, 0), cam_bezel, 16)
    add_cyl("RayBan_PrivacyLED", 1.7 * MM, 1.9 * MM, (led_x, led_y - 0.3 * MM, led_z), (math.pi / 2, 0, 0), privacy_led, 16)

    # =========================================================================
    # 2. CONTOURED WAYFARER TRANSITIONS LENSES + RIGHT-LENS WAVEGUIDE DISPLAY
    # =========================================================================
    _add_wayfarer_lens("RayBan_LensL", -lens_cx, lens_cz, lens_hw, lens_hh, -1.0, lens_left)
    _add_wayfarer_lens("RayBan_LensR", lens_cx, lens_cz, lens_hw, lens_hh, 1.0, lens_right)

    # =========================================================================
    # 3. CHUNKY FLAT-SIDED SMART TEMPLE ARMS + RAY-BAN SCRIPT LOGOS + CONTROLS
    # =========================================================================
    add_meta_display_temple("RayBan_TempleL", -1.0, acetate)
    add_meta_display_temple("RayBan_TempleR", 1.0, acetate)

    # Crisp silver Ray-Ban script plaques flush on the outer face of both chunky temples
    add_planar_decal("RayBan_LogoL", 22.0 * MM, 6.4 * MM, (-77.2 * MM, 26.0 * MM, 33.8 * MM), (math.pi / 2, 0, -math.pi / 2), temple_logo_mat)
    add_planar_decal("RayBan_LogoR", 22.0 * MM, 6.4 * MM, (77.8 * MM, 26.0 * MM, 33.8 * MM), (math.pi / 2, 0, math.pi / 2), temple_logo_mat)

    # Tactile capture shutter button on top edge of right smart temple + speaker acoustic ports underneath
    add_box("RayBan_CaptureButton", (4.0 * MM, 9.5 * MM, 1.8 * MM), (73.4 * MM, 24.0 * MM, 41.6 * MM), cam_bezel, bevel=0.5 * MM)
    for sx in (-1.0, 1.0):
        add_box(f"RayBan_SpeakerSlot_{'R' if sx > 0 else 'L'}", (2.4 * MM, 12.0 * MM, 1.0 * MM), (sx * 72.5 * MM, 74.0 * MM, 25.4 * MM), cam_bezel)

    # Ground entire assembly cleanly at Z = 0.0 (resting naturally on bottom rims & curved temple tips!)
    all_objs = list(bpy.context.scene.objects)
    min_z = min(
        (obj.matrix_world @ v.co).z
        for obj in all_objs
        if obj.type == "MESH"
        for v in obj.data.vertices
    )
    for obj in all_objs:
        obj.location.z -= min_z

    out_blend = os.path.join(OUT_DIR, "meta_rayban_display.blend")
    bpy.ops.wm.save_as_mainfile(filepath=out_blend)
    print(f"SAVED: {out_blend}")


def build_meta_neural_band():
    clear_scene()
    # Charcoal Black woven high-performance soft-touch textile (Vectran-weave look) + matte titanium EMG pods
    band_fabric = make_mat("NeuralBand_CharcoalTextile", (0.046, 0.049, 0.056), metallic=0.05, roughness=0.88)
    band_edge = make_mat("NeuralBand_EdgeTrim", (0.028, 0.031, 0.036), metallic=0.14, roughness=0.72)
    emg_pod = make_mat("NeuralBand_EMGPod", (0.14, 0.15, 0.17), metallic=0.78, roughness=0.34)
    clasp_metal = make_mat("NeuralBand_Clasp", (0.18, 0.19, 0.22), metallic=0.86, roughness=0.28)
    status_led = make_mat("NeuralBand_StatusLED", (0.45, 0.88, 0.82), metallic=0.0, roughness=0.20, emit=(0.45, 0.88, 0.82), emit_strength=1.6)

    # 1. Sculpted Elliptical Wristband Loop resting upright/slightly canted on the desk (72 x 58 mm oval, 26 mm band width)
    bm = bmesh.new()
    rx_out, ry_out = 36 * MM, 28 * MM
    thick = 4.6 * MM
    bw = 25.5 * MM
    n_seg = 48
    # 4-corner rounded cross-section swept cleanly around elliptical wrist loop
    prof = [
        (-thick * 0.5, -bw * 0.44),
        (-thick * 0.35, -bw * 0.50),
        (thick * 0.35, -bw * 0.50),
        (thick * 0.5, -bw * 0.44),
        (thick * 0.5, bw * 0.44),
        (thick * 0.35, bw * 0.50),
        (-thick * 0.35, bw * 0.50),
        (-thick * 0.5, bw * 0.44),
    ]
    rings = []
    for i in range(n_seg):
        a = (i / n_seg) * math.pi * 2.0
        ca, sa = math.cos(a), math.sin(a)
        cx, cy = ca * rx_out, sa * ry_out
        # Outward normal approximation
        nx, ny = ca / rx_out, sa / ry_out
        nl = math.hypot(nx, ny)
        nx /= nl
        ny /= nl
        # Subtle ribbed textile texture ripple along outer circumference
        rib = 0.25 * MM * math.sin(i * 4.0)
        ring = []
        for dr, dz in prof:
            r_eff = dr + (rib if dr > 0 else 0.0)
            ring.append(bm.verts.new((cx + nx * r_eff, cy + ny * r_eff, bw * 0.5 + dz)))
        rings.append(ring)
    np = len(prof)
    for i in range(n_seg):
        ni = (i + 1) % n_seg
        for j in range(np):
            nj = (j + 1) % np
            f = bm.faces.new((rings[i][j], rings[i][nj], rings[ni][nj], rings[ni][j]))
            f.smooth = True
    me = bpy.data.meshes.new("NeuralBand_StrapM")
    bm.to_mesh(me)
    bm.free()
    strap = bpy.data.objects.new("NeuralBand_Strap", me)
    bpy.context.scene.collection.objects.link(strap)
    strap.data.materials.append(band_fabric)

    # 2. Sleek Flush Outer Matte-Titanium Clasp / Control Pod + Subtle Cyan-Teal Status Indicator LED
    add_box("NeuralBand_ClaspPlate", (14 * MM, 5.8 * MM, 22 * MM), (0, -ry_out - 0.5 * MM, bw * 0.5), clasp_metal, bevel=1.4 * MM)
    add_cyl("NeuralBand_StatusLED", 1.1 * MM, 1.5 * MM, (0, -ry_out - 3.2 * MM, bw * 0.5), (math.pi / 2, 0, 0), status_led, 12)

    # 3. 8 Low-Profile Matte-Titanium Interior sEMG Electrode Pods lining the inner band wall!
    for k in range(8):
        a = (k / 8) * math.pi * 2.0 + math.pi / 8
        px = math.cos(a) * (rx_out - 2.6 * MM)
        py = math.sin(a) * (ry_out - 2.6 * MM)
        add_box(f"NeuralBand_EMG_{k}", (7.5 * MM, 2.2 * MM, 14.0 * MM), (px, py, bw * 0.5), emg_pod, bevel=0.7 * MM, rot=(0, 0, a + math.pi / 2))

    # Subtle stitched top/bottom edge trim rings
    for sz in (1.2 * MM, bw - 1.2 * MM):
        bpy.ops.mesh.primitive_torus_add(major_radius=32 * MM, minor_radius=0.8 * MM, major_segments=48, minor_segments=10, location=(0, 0, sz))
        tr = bpy.context.active_object
        tr.name = f"NeuralBand_Trim_{sz:.3f}"
        tr.scale = (rx_out / (32 * MM), ry_out / (32 * MM), 1.0)
        bpy.ops.object.transform_apply(scale=True)
        tr.data.materials.append(band_edge)

    out_blend = os.path.join(OUT_DIR, "meta_neural_band.blend")
    bpy.ops.wm.save_as_mainfile(filepath=out_blend)
    print(f"SAVED: {out_blend}")


if __name__ == "__main__":
    build_meta_rayban_display()
    build_meta_neural_band()
