#!/usr/bin/env python3
"""Build an accurate Mathmos Astro Classic Lava Lamp (430 x 140 mm) in headless Blender.

Geometry & PBR material modeling only (rendered live in Three.js WebGL — ZERO Cycles rendering).
Based on official Mathmos Astro dimensions & real product proportions:
- Total height: 430.0 mm
- Spun brushed aluminum hourglass base: 155 mm tall, 140 mm bottom diameter, 71 mm waist, 99 mm top cup
- Heavy molded glass bottle (carboy): 276 mm tall (z = 136..412 mm), 96 mm max belly diameter
- Spun brushed aluminum conical cap: 54 mm tall (z = 376..430 mm)
- Internal chrome reflector, glowing warm halogen bulb, helical bottom heating coil
- Translucent vertical-gradient backlit liquid volume (strictly 3.5 mm inside glass -> ZERO z-fighting)
- Sculpted molten wax pool + 6 organic fluid wax blobs (named LavaBlob_0..5 for live Three.js animation!)

Outputs:
  assets/blender/lava_lamp.blend
"""
import math
import os
import random
import bpy
import bmesh
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


def generate_spun_alu_texture():
    """Subtle radial/lathe-spun brushed silver aluminum grain (1024x512)."""
    rng = random.Random(1963)
    w, h = 1024, 512
    img = Image.new("RGB", (w, h), (192, 198, 206))
    px = img.load()
    for y in range(h):
        band = rng.randint(-9, 9)
        r0 = max(165, min(225, 194 + band))
        g0 = max(170, min(230, 199 + band))
        b0 = max(176, min(236, 207 + band))
        for x in range(0, w, 4):
            d = rng.randint(-3, 3)
            c = (r0 + d, g0 + d, b0 + d)
            px[x, y] = c
            px[x + 1, y] = c
            px[x + 2, y] = c
            px[x + 3, y] = c
    p = os.path.join(TEX_DIR, "lava_spun_alu.png")
    img.save(p)
    return p


def generate_liquid_gradient_texture():
    """Backlit Mathmos Astro liquid vertical gradient: incandescent golden-amber bottom -> rich ruby-violet top."""
    w, h = 64, 512
    img = Image.new("RGB", (w, h))
    px = img.load()
    # PIL y=0 is top (v=1), y=h-1 is bottom (v=0)
    stops = [
        (0.00, (58, 12, 74)),    # Top deep rich Mathmos violet-indigo liquid
        (0.30, (98, 16, 78)),    # Upper-mid luminous royal plum-magenta
        (0.60, (168, 30, 52)),   # Mid-lower glowing deep ruby-crimson
        (0.84, (224, 78, 22)),   # Lower intense molten tangerine
        (1.00, (255, 148, 38)),  # Bottom bulb-lit rich warm amber-orange
    ]

    def sample(t):
        for i in range(len(stops) - 1):
            t0, c0 = stops[i]
            t1, c1 = stops[i + 1]
            if t0 <= t <= t1:
                f = (t - t0) / max(1e-6, t1 - t0)
                return tuple(int(c0[k] + (c1[k] - c0[k]) * f) for k in range(3))
        return stops[-1][1]

    for y in range(h):
        c = sample(y / (h - 1))
        for x in range(w):
            px[x, y] = c
    p = os.path.join(TEX_DIR, "lava_liquid_grad.png")
    img.save(p)
    return p


def make_mat(name, color, metallic=0.0, roughness=0.4, emit=None, emit_strength=0.0, alpha=1.0):
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


def make_tex_mat(name, path, metallic=0.0, roughness=0.35, emit_strength=0.0, alpha=1.0):
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
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        mat.blend_method = "BLEND"
    return mat


def add_lathe(name, profile_rz, mat, segs=64, cap_bottom=True, cap_top=True):
    """Build a clean radially lathed mesh with cylindrical UVs from [(r_mm, z_mm), ...] bottom-to-top."""
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new("UVMap")
    z_min = min(z for _, z in profile_rz)
    z_max = max(z for _, z in profile_rz)
    z_span = max(1e-4, z_max - z_min)

    rings = []
    for r_mm, z_mm in profile_rz:
        r = r_mm * MM
        z = z_mm * MM
        ring = []
        for i in range(segs):
            a = (i / segs) * math.pi * 2.0
            ring.append(bm.verts.new((math.cos(a) * r, math.sin(a) * r, z)))
        rings.append((ring, (z_mm - z_min) / z_span))

    for ri in range(len(rings) - 1):
        r0, v0 = rings[ri]
        r1, v1 = rings[ri + 1]
        for i in range(segs):
            ni = (i + 1) % segs
            u0 = i / segs
            u1 = (i + 1) / segs
            f = bm.faces.new((r0[i], r0[ni], r1[ni], r1[i]))
            f.smooth = True
            for loop, uv in zip(f.loops, ((u0, v0), (u1, v0), (u1, v1), (u0, v1))):
                loop[uv_layer].uv = uv

    if cap_bottom and profile_rz[0][0] > 0.2:
        r0, v0 = rings[0]
        vc = bm.verts.new((0.0, 0.0, profile_rz[0][1] * MM))
        for i in range(segs):
            ni = (i + 1) % segs
            f = bm.faces.new((vc, r0[ni], r0[i]))
            f.smooth = False
            for loop in f.loops:
                loop[uv_layer].uv = (0.5, 0.0)

    if cap_top and profile_rz[-1][0] > 0.2:
        rt, vt = rings[-1]
        vc = bm.verts.new((0.0, 0.0, profile_rz[-1][1] * MM))
        for i in range(segs):
            ni = (i + 1) % segs
            f = bm.faces.new((vc, rt[i], rt[ni]))
            f.smooth = False
            for loop in f.loops:
                loop[uv_layer].uv = (0.5, 1.0)

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name + "M")
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def add_organic_blob(name, center_xyz_mm, rx_mm, ry_mm, rz_mm, mat, seed=0, pinch_z=0.0):
    """Create a smooth organic fluid wax blob (deformed UV sphere with teardrop/meniscus sculpting)."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=28, v_segments=20, radius=1.0)
    for v in bm.verts:
        x, y, z = v.co.x, v.co.y, v.co.z
        # Teardrop / necking deformation + gentle organic harmonic undulation
        taper = 1.0 + pinch_z * z + 0.10 * math.sin(z * 2.8 + seed)
        ang = math.atan2(y, x)
        wobble = 1.0 + 0.06 * math.sin(ang * 2.0 + z * 2.4 + seed) + 0.04 * math.cos(ang * 3.0 - z * 1.9 + seed * 1.7)
        v.co.x = x * rx_mm * MM * taper * wobble
        v.co.y = y * ry_mm * MM * taper * wobble
        v.co.z = z * rz_mm * MM
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        f.smooth = True
    me = bpy.data.meshes.new(name + "M")
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    obj.location = (center_xyz_mm[0] * MM, center_xyz_mm[1] * MM, center_xyz_mm[2] * MM)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def add_heating_coil(name, major_r_mm, coil_r_mm, wire_r_mm, z_mm, mat, turns=42, segs_per_turn=8):
    """Authentic Mathmos helical metal spring coil resting inside the bottom of the glass bottle."""
    bm = bmesh.new()
    total_pts = turns * segs_per_turn
    ring_segs = 6
    rings = []
    for i in range(total_pts):
        t = (i / total_pts) * math.pi * 2.0
        u = i / segs_per_turn * math.pi * 2.0
        # Center of coil wire along torus helix
        rc = major_r_mm + coil_r_mm * math.cos(u)
        zc = z_mm + coil_r_mm * math.sin(u)
        px = rc * math.cos(t) * MM
        py = rc * math.sin(t) * MM
        pz = zc * MM
        # Tangent approx
        t2 = ((i + 1) / total_pts) * math.pi * 2.0
        u2 = (i + 1) / segs_per_turn * math.pi * 2.0
        rc2 = major_r_mm + coil_r_mm * math.cos(u2)
        zc2 = z_mm + coil_r_mm * math.sin(u2)
        tx = rc2 * math.cos(t2) * MM - px
        ty = rc2 * math.sin(t2) * MM - py
        tz = zc2 * MM - pz
        tl = max(1e-9, math.sqrt(tx * tx + ty * ty + tz * tz))
        tx, ty, tz = tx / tl, ty / tl, tz / tl
        # Local frame
        upx, upy, upz = 0.0, 0.0, 1.0
        if abs(tz) > 0.9:
            upx, upy, upz = 1.0, 0.0, 0.0
        bx = ty * upz - tz * upy
        by = tz * upx - tx * upz
        bz = tx * upy - ty * upx
        bl = max(1e-9, math.sqrt(bx * bx + by * by + bz * bz))
        bx, by, bz = bx / bl, by / bl, bz / bl
        nx = by * tz - bz * ty
        ny = bz * tx - bx * tz
        nz = bx * ty - by * tx
        ring = []
        wr = wire_r_mm * MM
        for j in range(ring_segs):
            a = (j / ring_segs) * math.pi * 2.0
            ca, sa = math.cos(a), math.sin(a)
            ring.append(bm.verts.new((px + wr * (ca * bx + sa * nx), py + wr * (ca * by + sa * ny), pz + wr * (ca * bz + sa * nz))))
        rings.append(ring)

    for i in range(total_pts):
        r0 = rings[i]
        r1 = rings[(i + 1) % total_pts]
        for j in range(ring_segs):
            nj = (j + 1) % ring_segs
            f = bm.faces.new((r0[j], r0[nj], r1[nj], r1[j]))
            f.smooth = True

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name + "M")
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def build_lava_lamp():
    clear_scene()

    p_alu = generate_spun_alu_texture()
    p_liq = generate_liquid_gradient_texture()

    mat_alu = make_tex_mat("LavaLamp_SpunAlu", p_alu, metallic=0.92, roughness=0.25)
    mat_felt = make_mat("LavaLamp_FeltPad", (0.018, 0.019, 0.022), metallic=0.0, roughness=0.95)
    mat_grommet = make_mat("LavaLamp_Grommet", (0.015, 0.016, 0.018), metallic=0.04, roughness=0.78)
    mat_reflector = make_mat("LavaLamp_Reflector", (0.92, 0.88, 0.78), metallic=0.96, roughness=0.14)
    mat_bulb = make_mat("LavaLamp_BulbCore", (1.0, 0.82, 0.42), metallic=0.0, roughness=0.15, emit=(1.0, 0.78, 0.34), emit_strength=6.5)
    mat_coil = make_mat("LavaLamp_HeatingCoil", (0.62, 0.56, 0.50), metallic=0.92, roughness=0.34)
    mat_glass = make_mat("LavaLamp_Glass", (0.96, 0.94, 0.98), metallic=0.0, roughness=0.06, alpha=0.22)
    mat_liquid = make_tex_mat("LavaLamp_Liquid", p_liq, metallic=0.0, roughness=0.18, emit_strength=0.95, alpha=0.52)
    # Molten translucent glowing lava-orange / coral-red wax (saturated so ACES tone mapping keeps rich molten color!)
    mat_wax_hot = make_mat("LavaLamp_WaxHot", (0.96, 0.28, 0.03), metallic=0.0, roughness=0.30, emit=(1.0, 0.34, 0.04), emit_strength=1.25)
    mat_wax_mid = make_mat("LavaLamp_WaxMid", (0.88, 0.16, 0.03), metallic=0.0, roughness=0.32, emit=(0.96, 0.20, 0.03), emit_strength=0.95)
    mat_wax_cool = make_mat("LavaLamp_WaxCool", (0.76, 0.09, 0.04), metallic=0.0, roughness=0.36, emit=(0.82, 0.11, 0.03), emit_strength=0.72)

    # 1. Bottom Anti-Slip Charcoal Felt Pad (z = 0..2.2 mm)
    add_lathe("Lava_FeltPad", [(67.5, 0.0), (68.0, 1.0), (67.5, 2.2)], mat_felt, segs=64)

    # 2. Iconic Mathmos Astro Spun Brushed Aluminum Hourglass Base (z = 2.0..155.0 mm, Ø 140 mm bottom, Ø 71 mm waist, Ø 99 mm cup rim)
    base_profile = [
        (69.2, 2.0),
        (70.0, 4.5),     # Bottom rounded rolled rim (Ø 140 mm)
        (69.0, 10.0),
        (61.0, 34.0),
        (51.5, 62.0),
        (43.0, 88.0),
        (36.2, 108.0),
        (35.4, 112.5),   # Iconic pinched hourglass waist (Ø 70.8 mm)
        (36.5, 115.0),   # Subtle stepped waist collar seam
        (37.2, 118.0),
        (41.5, 130.0),
        (46.2, 144.0),
        (49.6, 153.5),   # Rolled upper cup lip (Ø 99.2 mm)
        (49.2, 155.2),
        (47.8, 155.0),   # Inner cup lip wall (cleanly wraps Ø 96 mm bottle without coplanar overlap!)
        (45.5, 142.0),
        (37.5, 123.0),   # Inner reflector cavity floor
    ]
    add_lathe("Lava_SpunBase", base_profile, mat_alu, segs=64, cap_bottom=True, cap_top=True)

    # 3. Internal Parabolic Reflector & Glowing Halogen Bulb (visible glowing through bottom of glass!)
    add_lathe("Lava_Reflector", [(14.0, 124.0), (24.0, 130.0), (35.5, 141.0)], mat_reflector, segs=40, cap_bottom=True, cap_top=False)
    add_organic_blob("Lava_BulbCore", (0.0, 0.0, 136.0), 12.5, 12.5, 9.5, mat_bulb, seed=0)

    # 4. Rear AC Cord Strain-Relief Grommet (on +Y rear side -> Three.js -Z facing back of desk!)
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=4.2 * MM, depth=10 * MM, location=(0.0, 68.0 * MM, 11.0 * MM), rotation=(math.pi / 2, 0.0, 0.0))
    grom = bpy.context.active_object
    grom.name = "Lava_CordGrommet"
    grom.data.materials.append(mat_grommet)

    # 5. Thick Molded Clear Glass Bottle (Carboy: z = 138..410 mm, max belly Ø 96 mm at z = 170 mm!)
    glass_profile = [
        (39.0, 138.0),
        (44.5, 143.0),
        (47.4, 154.0),
        (48.0, 168.0),   # Exact 96.0 mm max bottle belly diameter!
        (47.2, 186.0),
        (44.8, 214.0),
        (41.4, 248.0),
        (37.6, 286.0),
        (33.4, 326.0),
        (29.2, 362.0),
        (26.2, 382.0),   # Smooth shoulder into neck
        (24.8, 392.0),
        (24.6, 408.0),   # Glass mouth tucked safely inside aluminum cap
    ]
    add_lathe("Lava_GlassBottle", glass_profile, mat_glass, segs=64, cap_bottom=True, cap_top=True)

    # 6. Inner Translucent Backlit Liquid Volume (strictly 3.8 mm inside outer glass -> ZERO z-fighting!)
    liquid_profile = [
        (36.0, 144.0),
        (41.2, 150.0),
        (44.0, 168.0),
        (43.2, 186.0),
        (40.8, 214.0),
        (37.4, 248.0),
        (33.6, 286.0),
        (29.4, 326.0),
        (25.6, 360.0),
        (23.8, 374.5),   # Liquid meniscus right at the cap lower rim!
    ]
    add_lathe("Lava_LiquidVolume", liquid_profile, mat_liquid, segs=56, cap_bottom=True, cap_top=True)

    # 7. Helical Metal Heating Spring Coil Resting Inside Bottom of Bottle (z = 149 mm)
    add_heating_coil("Lava_HeatingCoil", major_r_mm=33.5, coil_r_mm=2.6, wire_r_mm=0.72, z_mm=149.0, mat=mat_coil)

    # 8. Molten Bottom Wax Pool + Budding Dome (hugging the bottom coil, z = 146..182 mm)
    pool_profile = [
        (34.5, 146.0),
        (39.0, 152.0),
        (41.2, 162.0),
        (38.0, 171.0),
        (28.5, 178.0),
        (17.5, 184.0),
        (9.5, 188.0),
        (2.0, 189.5),
    ]
    add_lathe("LavaWax_Pool", pool_profile, mat_wax_hot, segs=44, cap_bottom=True, cap_top=True)

    # 9. Six Organic Molten Wax Blobs (strictly inside liquid clearance, named LavaBlob_0..5 for live Three.js animation!)
    # Each blob is placed at well-separated heights & slight radial offsets inside the cone!
    blobs = [
        # (name, (x, y, z) mm, rx, ry, rz mm, mat, seed, pinch_z)
        ("LavaBlob_0", (-6.0, 4.0, 206.0), 17.5, 16.5, 22.0, mat_wax_hot, 1.1, -0.22),   # Rising hot teardrop detaching from pool
        ("LavaBlob_1", (8.5, -5.0, 242.0), 15.5, 15.0, 17.5, mat_wax_mid, 2.3, 0.14),    # Mid-height glowing orb
        ("LavaBlob_2", (-7.5, -6.5, 278.0), 13.5, 14.0, 16.5, mat_wax_mid, 3.7, -0.15),  # Buoyant rising droplet
        ("LavaBlob_3", (5.5, 6.0, 314.0), 12.5, 11.8, 13.8, mat_wax_cool, 4.9, 0.18),    # Upper cooling globule
        ("LavaBlob_4", (-3.0, 2.5, 346.0), 11.0, 10.5, 10.5, mat_wax_cool, 6.2, 0.08),   # High hovering blob near cap
        ("LavaBlob_5", (12.0, 7.5, 192.0), 9.5, 9.2, 10.8, mat_wax_hot, 7.5, -0.18),     # Small hot satellite droplet
    ]
    for name, pos, rx, ry, rz, mat, seed, pinch in blobs:
        add_organic_blob(name, pos, rx, ry, rz, mat, seed=seed, pinch_z=pinch)

    # 10. Spun Brushed Aluminum Conical Cap (z = 374..430 mm -> EXACT 430.0 mm official Mathmos Astro height!)
    cap_profile = [
        (25.6, 374.0),   # Cleanly clears outer glass bottle (r = 26.2mm at 382mm, 27.6mm at 374mm -> widen to 28.4mm!)
    ]
    cap_profile = [
        (27.8, 374.0),   # Inner lip clears outer glass cleanly
        (28.8, 374.5),   # Rolled bottom rim of spun aluminum cap
        (28.5, 378.0),
        (25.8, 396.0),
        (22.4, 414.0),
        (19.6, 427.5),
        (18.6, 429.6),   # Crisp chamfered flat top crown
        (17.4, 430.0),   # Exact 430.0 mm total lamp height!
    ]
    add_lathe("Lava_SpunCap", cap_profile, mat_alu, segs=64, cap_bottom=False, cap_top=True)

    out_blend = os.path.join(OUT_DIR, "lava_lamp.blend")
    bpy.ops.wm.save_as_mainfile(filepath=out_blend)
    print(f"SAVED: {out_blend}")


if __name__ == "__main__":
    build_lava_lamp()
