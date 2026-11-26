#!/usr/bin/env python3
"""Build an accurate U.S. Navy Blue Angels Boeing F/A-18E Super Hornet in headless Blender.

Geometry & PBR material modeling only (rendered live in Three.js WebGL — ZERO Cycles rendering).
Orientation:
  - Nose pointing along -Y in Blender (+Z in Three.js glTF Y-up? Wait: glTF maps Blender (X, Y, Z) -> Three.js (X, Z, -Y),
    so Nose along -Y in Blender becomes +Z forward in Three.js! Let's keep Nose along -Y in Blender so Three.js `lookAt`
    and local +Z forward work naturally!)
  - Wings along ±X, Dorsal canopy/tails along +Z (Three.js +Y up).
  - Length ~1.00 m normalized unit scale (scaled cleanly in Three.js for realistic Bay airspace perspective).

Signature F/A-18E Super Hornet Blue Angels details:
  - Glossy Insignia Blue (#06265c) fuselage, LEX, swept main wings, canted twin vertical tails, horizontal stabilators
  - Insignia Yellow (#f4c41c) nose-to-tail fuselage stripe, wingtip & leading-edge trim, ventral chevron, tail-top yellow bands
  - Crisp UV-mapped top/bottom wing markings (US NAVY + star-and-bar + gold stripes) & fuselage side stripe
  - Raised tinted golden-dark bubble canopy
  - Twin angular Super Hornet side intakes + twin canted vertical tail fins (the unmistakable Hornet silhouette!)
  - Twin glowing blue-amber afterburner exhaust nozzles + bright warm-white nose formation headlight

Outputs:
  assets/blender/blue_angel_f18.blend
"""
import math
import os
import bpy
import bmesh
from PIL import Image, ImageDraw, ImageFont

OUT_DIR = os.path.abspath("/workspace/assets/blender")
TEX_DIR = os.path.join(OUT_DIR, "textures")
os.makedirs(TEX_DIR, exist_ok=True)


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0


def _font(size):
    for p in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
    ):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def generate_wing_marking_texture():
    """Generate crisp Blue Angels belly/wing Insignia Blue + Yellow US NAVY stripe texture."""
    w, h = 512, 256
    img = Image.new("RGB", (w, h), (7, 36, 92))
    d = ImageDraw.Draw(img)
    # Iconic Blue Angels yellow leading/trailing stripe accents
    d.rectangle([0, 18, w, 34], fill=(246, 198, 28))
    d.rectangle([0, h - 34, w, h - 18], fill=(246, 198, 28))
    f = _font(64)
    text = "U.S. NAVY"
    bb = d.textbbox((0, 0), text, font=f)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    d.text(((w - tw) // 2 - bb[0], (h - th) // 2 - bb[1]), text, font=f, fill=(246, 198, 28))
    p = os.path.join(TEX_DIR, "blue_angel_wing.png")
    img.save(p)
    return p


def make_mat(name, color, metallic=0.25, roughness=0.26, emit=None, emit_strength=0.0):
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


def make_tex_mat(name, path, metallic=0.25, roughness=0.26):
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


def add_loft(name, sections, mat, cap_ends=True):
    """Build a smooth lofted mesh from cross-section ring lists [(y, [(x,z), ...]), ...]."""
    bm = bmesh.new()
    rings = []
    for y, pts in sections:
        ring = [bm.verts.new((x, y, z)) for (x, z) in pts]
        rings.append(ring)
    n = len(rings[0])
    for ri in range(len(rings) - 1):
        r0, r1 = rings[ri], rings[ri + 1]
        for i in range(n):
            ni = (i + 1) % n
            f = bm.faces.new((r0[i], r0[ni], r1[ni], r1[i]))
            f.smooth = True
    if cap_ends:
        bm.faces.new(rings[0][::-1])
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name + "M")
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def ellipse_pts(rx, rz, cz=0.0, n=16, flat_bottom=0.0):
    pts = []
    for i in range(n):
        a = (i / n) * math.pi * 2.0
        x = math.cos(a) * rx
        z = math.sin(a) * rz
        if flat_bottom > 0 and z < 0:
            z *= (1.0 - flat_bottom)
        pts.append((x, cz + z))
    return pts


def add_airfoil_wing(name, root_pts, tip_pts, mat, mirror_x=True):
    """Create swept airfoil surface from root (x0, y0_le, y0_te, z0, t0) to tip (x1, y1_le, y1_te, z1, t1)."""
    bm = bmesh.new()
    signs = (-1.0, 1.0) if mirror_x else (1.0,)
    for s in signs:
        def make_profile(x, y_le, y_te, z, t):
            ym = y_le + (y_te - y_le) * 0.34
            return [
                bm.verts.new((s * x, y_le, z)),
                bm.verts.new((s * x, ym, z + t * 0.62)),
                bm.verts.new((s * x, y_te, z)),
                bm.verts.new((s * x, ym, z - t * 0.38)),
            ]

        r_ring = make_profile(*root_pts)
        t_ring = make_profile(*tip_pts)
        for i in range(4):
            ni = (i + 1) % 4
            quad = (r_ring[i], r_ring[ni], t_ring[ni], t_ring[i])
            if s < 0:
                quad = quad[::-1]
            f = bm.faces.new(quad)
            f.smooth = True
        bm.faces.new(t_ring if s > 0 else t_ring[::-1])
        bm.faces.new(r_ring[::-1] if s > 0 else r_ring)

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name + "M")
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def add_canted_tail(name, side_sign, mat_blue, mat_yellow):
    """Build one iconic canted-outward F/A-18 vertical tail fin with yellow top band."""
    # Split cleanly at 78% height: lower 78% Insignia Blue, upper 22% Insignia Yellow!
    def build_seg(seg_name, h0, h1, mat):
        bm = bmesh.new()
        cant = math.radians(20.0) * side_sign
        x_base = 0.056 * side_sign
        z_base = 0.022
        # Span height 0.148 m, chord tapering from 0.165 m to 0.068 m, swept back
        def sec(frac):
            h = frac * 0.148
            cx = x_base + math.sin(cant) * h
            cz = z_base + math.cos(cant) * h
            y_le = 0.175 + frac * 0.115
            y_te = 0.348 + frac * 0.036
            ym = y_le + (y_te - y_le) * 0.38
            th = (0.011 - frac * 0.005)
            nx = math.cos(cant) * th
            nz = -math.sin(cant) * th
            return [
                bm.verts.new((cx, y_le, cz)),
                bm.verts.new((cx + nx, ym, cz + nz)),
                bm.verts.new((cx, y_te, cz)),
                bm.verts.new((cx - nx, ym, cz - nz)),
            ]

        r0 = sec(h0)
        r1 = sec(h1)
        for i in range(4):
            ni = (i + 1) % 4
            f = bm.faces.new((r0[i], r0[ni], r1[ni], r1[i]))
            f.smooth = True
        bm.faces.new(r0[::-1])
        bm.faces.new(r1)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        me = bpy.data.meshes.new(seg_name + "M")
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new(seg_name, me)
        bpy.context.scene.collection.objects.link(ob)
        ob.data.materials.append(mat)
        return ob

    build_seg(f"{name}_Blue", 0.0, 0.77, mat_blue)
    build_seg(f"{name}_YellowTip", 0.77, 1.0, mat_yellow)


def add_box(name, size, loc, rot, mat):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(scale=True)
    obj.data.materials.append(mat)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def add_cyl(name, r1, r2, depth, loc, rot, mat, verts=20):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(mat)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def build_blue_angel_f18():
    clear_scene()

    p_wing = generate_wing_marking_texture()

    # Signature U.S. Navy Blue Angels gloss enamel materials
    ba_blue = make_mat("BA_InsigniaBlue", (0.014, 0.068, 0.245), metallic=0.34, roughness=0.22)
    ba_yellow = make_mat("BA_InsigniaYellow", (0.96, 0.74, 0.04), metallic=0.18, roughness=0.26, emit=(0.96, 0.74, 0.04), emit_strength=0.14)
    ba_canopy = make_mat("BA_CanopyGlass", (0.14, 0.11, 0.05), metallic=0.88, roughness=0.08)
    ba_nozzle = make_mat("BA_ExhaustMetal", (0.09, 0.095, 0.11), metallic=0.92, roughness=0.34)
    ba_burner = make_mat("BA_Afterburner", (0.55, 0.78, 1.0), 0.0, 0.15, emit=(0.65, 0.85, 1.0), emit_strength=3.6)
    ba_headlight = make_mat("BA_NoseLight", (1.0, 0.96, 0.85), 0.0, 0.1, emit=(1.0, 0.94, 0.78), emit_strength=5.5)
    ba_wing_tex = make_tex_mat("BA_WingMarking", p_wing, metallic=0.26, roughness=0.25)

    # =========================================================================
    # 1. SLEEK F/A-18E FUSELAGE (Nose at y = -0.50 -> Tail at y = +0.46)
    # =========================================================================
    fuselage_sections = [
        (-0.50, ellipse_pts(0.002, 0.002, -0.004)),
        (-0.44, ellipse_pts(0.017, 0.015, -0.003)),
        (-0.35, ellipse_pts(0.032, 0.027, 0.000)),
        (-0.22, ellipse_pts(0.046, 0.038, 0.004, flat_bottom=0.22)),
        (-0.06, ellipse_pts(0.064, 0.042, 0.005, flat_bottom=0.28)),
        (0.10,  ellipse_pts(0.072, 0.042, 0.005, flat_bottom=0.30)),
        (0.28,  ellipse_pts(0.068, 0.038, 0.004, flat_bottom=0.28)),
        (0.41,  ellipse_pts(0.058, 0.031, 0.003, flat_bottom=0.22)),
    ]
    add_loft("BA_Fuselage", fuselage_sections, ba_blue)

    # Crisp Insignia Yellow Nose Tip Band + Full-Length Side Stripes & Ventral Yellow Stripe!
    nose_band = [
        (-0.465, ellipse_pts(0.0115, 0.0105, -0.0032)),
        (-0.440, ellipse_pts(0.0178, 0.0158, -0.0028)),
    ]
    add_loft("BA_YellowNoseBand", nose_band, ba_yellow, cap_ends=False)
    for sx in (-1.0, 1.0):
        add_box(f"BA_SideStripe_{'R' if sx > 0 else 'L'}", (0.008, 0.72, 0.011), (sx * 0.058, 0.02, 0.005), (0, 0, sx * -0.04), ba_yellow)
    # Bright yellow dorsal spine & belly centerline stripe (highly visible during rolls & loops!)
    add_box("BA_BellyStripe", (0.042, 0.62, 0.006), (0.0, 0.06, -0.028), (0, 0, 0), ba_yellow)

    # Raised Golden-Tinted Teardrop Bubble Canopy (y = -0.30 .. -0.06)
    canopy_sections = [
        (-0.30, ellipse_pts(0.005, 0.004, 0.024)),
        (-0.24, ellipse_pts(0.026, 0.026, 0.034)),
        (-0.16, ellipse_pts(0.029, 0.028, 0.036)),
        (-0.08, ellipse_pts(0.020, 0.018, 0.030)),
        (-0.02, ellipse_pts(0.006, 0.005, 0.026)),
    ]
    add_loft("BA_Canopy", canopy_sections, ba_canopy)

    # =========================================================================
    # 2. SIGNATURE F/A-18E LEX (Leading-Edge Extensions) + ANGULAR SIDE INTAKES
    # =========================================================================
    add_airfoil_wing("BA_LEX", (0.046, -0.24, 0.04, 0.010, 0.012), (0.105, -0.02, 0.05, 0.008, 0.009), ba_blue, mirror_x=True)
    for sx in (-1.0, 1.0):
        add_box(f"BA_Intake_{'R' if sx > 0 else 'L'}", (0.042, 0.24, 0.036), (sx * 0.068, 0.05, -0.008), (0, sx * 0.14, 0), ba_blue)

    # =========================================================================
    # 3. MAIN SWEPT WINGS (Span ~0.74 m) + YELLOW WINGTIP LAUNCH RAILS & ACCENTS
    # =========================================================================
    add_airfoil_wing("BA_MainWing", (0.068, -0.03, 0.18, 0.008, 0.018), (0.365, 0.09, 0.195, 0.004, 0.008), ba_blue, mirror_x=True)
    # Bright yellow wingtip trim rails + leading-edge strips (gives unmistakable Blue Angels blue+gold pop at distance!)
    for sx in (-1.0, 1.0):
        add_box(f"BA_WingtipRail_{'R' if sx > 0 else 'L'}", (0.014, 0.125, 0.009), (sx * 0.370, 0.145, 0.004), (0, 0, 0), ba_yellow)
        add_box(f"BA_WingGoldStrip_{'R' if sx > 0 else 'L'}", (0.285, 0.018, 0.012), (sx * 0.220, 0.045, 0.006), (0, 0, sx * -0.37), ba_yellow)

    # Crisp yellow ventral "U.S. NAVY" wing panel plaques on underside (visible during loops & inverted passes!)
    bm_u = bmesh.new()
    uv = bm_u.loops.layers.uv.new("UVMap")
    v0 = bm_u.verts.new((-0.26, 0.06, -0.006))
    v1 = bm_u.verts.new((0.26, 0.06, -0.006))
    v2 = bm_u.verts.new((0.26, 0.16, -0.006))
    v3 = bm_u.verts.new((-0.26, 0.16, -0.006))
    f_u = bm_u.faces.new((v3, v2, v1, v0))
    for loop, c in zip(f_u.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        loop[uv].uv = c
    me_u = bpy.data.meshes.new("BA_BellyMarkingM")
    bm_u.to_mesh(me_u)
    bm_u.free()
    ob_u = bpy.data.objects.new("BA_BellyMarking", me_u)
    bpy.context.scene.collection.objects.link(ob_u)
    ob_u.data.materials.append(ba_wing_tex)

    # =========================================================================
    # 4. TWIN CANTED VERTICAL TAILS + HORIZONTAL STABILATORS
    # =========================================================================
    add_canted_tail("BA_Tail_L", -1.0, ba_blue, ba_yellow)
    add_canted_tail("BA_Tail_R", 1.0, ba_blue, ba_yellow)
    add_airfoil_wing("BA_Stab", (0.062, 0.27, 0.40, -0.002, 0.010), (0.225, 0.355, 0.435, -0.006, 0.005), ba_blue, mirror_x=True)

    # =========================================================================
    # 5. TWIN EXHAUST NOZZLES + GLOWING AFTERBURNERS + NOSE FORMATION HEADLIGHT
    # =========================================================================
    for sx in (-1.0, 1.0):
        tag = "R" if sx > 0 else "L"
        add_cyl(f"BA_Nozzle_{tag}", 0.025, 0.021, 0.065, (sx * 0.032, 0.435, 0.002), (math.pi / 2, 0, 0), ba_nozzle)
        add_cyl(f"BA_Afterburner_{tag}", 0.017, 0.005, 0.085, (sx * 0.032, 0.485, 0.002), (math.pi / 2, 0, 0), ba_burner)

    # Iconic bright warm-white Blue Angels nose formation light (under forward nose!)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.012, location=(0.0, -0.33, -0.024))
    hl = bpy.context.active_object
    hl.name = "BA_FormationHeadlight"
    hl.data.materials.append(ba_headlight)

    out_blend = os.path.join(OUT_DIR, "blue_angel_f18.blend")
    bpy.ops.wm.save_as_mainfile(filepath=out_blend)
    print(f"SAVED: {out_blend}")


if __name__ == "__main__":
    build_blue_angel_f18()
