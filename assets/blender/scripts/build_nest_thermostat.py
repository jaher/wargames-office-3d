#!/usr/bin/env python3
"""Build an accurate Google Nest Learning Thermostat (3rd Generation, Stainless Steel) in headless Blender.

Geometry & PBR material modeling only (rendered live in Three.js WebGL — ZERO Cycles rendering).
Based on official Google Nest Learning Thermostat 3rd Gen dimensions:
- Outer diameter: 84.0 mm (rotating brushed stainless steel outer ring)
- Total depth off wall: 31.0 mm (11 mm recessed base collar + stainless ring + gently domed mirror-glass face)
- Circular color LCD display: 53.0 mm diameter inside glossy black glass bezel with tick dial, "70", "HEATING", green Nest Leaf, and subtle "nest" bezel wordmark.

Orientation for export_glb.py (export_yup=True):
- Back wall mount plane flush at Blender Y = 0.0
- Front face points toward Blender -Y (-> Three.js +Z, facing straight into the room when mounted on z = -2.60 back wall!)
- Up is Blender +Z (-> Three.js +Y)

Outputs:
  assets/blender/nest_thermostat.blend
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


def _load_font(size, light=False):
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-ExtraLight.ttf" if light else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]
    for p in candidates:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def _draw_centered(draw, text, cx, cy, font, fill):
    bb = draw.textbbox((0, 0), text, font=font)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    draw.text((cx - tw / 2 - bb[0], cy - th / 2 - bb[1]), text, font=font, fill=fill)


def generate_stainless_ring_texture():
    """Brushed stainless steel radial texture for the iconic rotating Nest outer ring."""
    rng = random.Random(303)
    w, h = 1024, 256
    img = Image.new("RGB", (w, h), (206, 210, 216))
    px = img.load()
    for y in range(h):
        d = rng.randint(-8, 8)
        r = max(180, min(232, 206 + d))
        g = max(184, min(235, 210 + d))
        b = max(188, min(238, 216 + d))
        for x in range(0, w, 4):
            s = rng.randint(-2, 2)
            c = (r + s, g + s, b + s)
            px[x, y] = c
            px[x + 1, y] = c
            px[x + 2, y] = c
            px[x + 3, y] = c
    p = os.path.join(TEX_DIR, "nest_stainless.png")
    img.save(p)
    return p


def generate_nest_face_textures():
    """Generate razor-sharp 1024x1024 Nest 3rd Gen front bezel + circular 53mm LCD display & emission mask."""
    SZ = 1024
    cx = cy = SZ // 2
    # Outer glass face radius = 36.5mm -> maps to 512px; 53mm LCD radius = 26.5mm -> 372px!
    R_LCD = int(512 * (26.5 / 36.5))  # ~372 px

    base = Image.new("RGB", (SZ, SZ), (8, 9, 11))
    emit = Image.new("RGB", (SZ, SZ), (0, 0, 0))
    db = ImageDraw.Draw(base)
    de = ImageDraw.Draw(emit)

    # 1. Warm Nest Heating Orange circular LCD screen background (rich deep Nest terracotta-orange gradient)
    for r in range(R_LCD, 0, -2):
        f = r / R_LCD
        # Center slightly brighter Nest orange (#e2581c), outer edge rich deeper burnt orange (#b6370e)
        cr = int(226 - 48 * (f ** 1.6))
        cg = int(88 - 34 * (f ** 1.5))
        cb = int(28 - 14 * (f ** 1.4))
        db.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(cr, cg, cb))
        de.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(int(cr * 0.85), int(cg * 0.85), int(cb * 0.85)))

    # Crisp thin dark edge framing the 53mm circular LCD inside the glossy black bezel
    db.ellipse([cx - R_LCD, cy - R_LCD, cx + R_LCD, cy + R_LCD], outline=(24, 16, 14), width=5)

    # 2. Authentic Nest perimeter temperature dial tick marks (around 270° arc from 135° to 405°)
    r_tick_out = R_LCD - 18
    r_tick_in = R_LCD - 54
    r_tick_active_in = R_LCD - 62
    n_ticks = 76
    start_deg = 132.0
    sweep_deg = 276.0
    # Active heating band between ambient 68° (tick ~44) and target 70° (tick ~52)
    cur_idx = 43
    target_idx = 52

    for i in range(n_ticks + 1):
        ang = math.radians(start_deg + (i / n_ticks) * sweep_deg)
        ca, sa = math.cos(ang), math.sin(ang)
        is_band = cur_idx <= i <= target_idx
        is_target = i == target_idx
        is_cur = i == cur_idx
        r_in = r_tick_active_in if (is_target or is_cur) else r_tick_in
        r_out = r_tick_out + (4 if is_target else 0)
        p0 = (cx + ca * r_in, cy + sa * r_in)
        p1 = (cx + ca * r_out, cy + sa * r_out)
        if is_target:
            col = (255, 255, 255)
            ecol = (255, 250, 240)
            w = 9
        elif is_band:
            col = (255, 232, 206)
            ecol = (255, 224, 192)
            w = 5
        else:
            col = (232, 138, 96)
            ecol = (196, 108, 68)
            w = 3
        db.line([p0, p1], fill=col, width=w)
        de.line([p0, p1], fill=ecol, width=w)

    # Small ambient temperature marker "68" near the ambient tick
    ang_cur = math.radians(start_deg + (cur_idx / n_ticks) * sweep_deg)
    f_mini = _load_font(30)
    mx = cx + math.cos(ang_cur) * (r_tick_in - 32)
    my = cy + math.sin(ang_cur) * (r_tick_in - 32)
    _draw_centered(db, "68", mx, my, f_mini, (255, 222, 198))
    _draw_centered(de, "68", mx, my, f_mini, (240, 204, 178))

    # 3. Authentic Nest UI Typography: "HEATING" above + bold clean "70" centered + Green Nest Leaf below!
    f_hdr = _load_font(34)
    _draw_centered(db, "HEATING", cx, cy - 150, f_hdr, (255, 232, 214))
    _draw_centered(de, "HEATING", cx, cy - 150, f_hdr, (245, 218, 196))

    f_temp = _load_font(220)
    _draw_centered(db, "70", cx, cy + 4, f_temp, (255, 255, 255))
    _draw_centered(de, "70", cx, cy + 4, f_temp, (255, 252, 248))

    # Iconic Green Nest Eco Leaf icon cleanly centered below the temperature
    ly = cy + 168
    leaf_pts = [
        (cx - 26, ly + 14),
        (cx - 22, ly - 8),
        (cx - 4, ly - 24),
        (cx + 26, ly - 26),
        (cx + 20, ly + 4),
        (cx + 2, ly + 22),
    ]
    db.polygon(leaf_pts, fill=(104, 224, 118))
    de.polygon(leaf_pts, fill=(88, 216, 104))
    db.line([(cx - 32, ly + 22), (cx + 12, ly - 12)], fill=(215, 255, 220), width=4)
    de.line([(cx - 32, ly + 22), (cx + 12, ly - 12)], fill=(190, 248, 200), width=4)

    # 4. Subtle glossy black outer bezel details: top proximity sensor + bottom "nest" silver wordmark
    db.ellipse([cx - 6, cy - R_LCD - 58, cx + 6, cy - R_LCD - 46], fill=(28, 34, 42))
    # Tiny subtle green status micro-LED near top bezel
    db.ellipse([cx - 4, cy - R_LCD - 28, cx + 4, cy - R_LCD - 20], fill=(70, 220, 120))
    de.ellipse([cx - 4, cy - R_LCD - 28, cx + 4, cy - R_LCD - 20], fill=(50, 190, 95))

    f_logo = _load_font(30)
    _draw_centered(db, "nest", cx, cy + R_LCD + 52, f_logo, (116, 122, 132))

    p_base = os.path.join(TEX_DIR, "nest_display.png")
    p_emit = os.path.join(TEX_DIR, "nest_display_emit.png")
    base.save(p_base)
    emit.save(p_emit)
    return p_base, p_emit


def make_mat(name, color, metallic=0.0, roughness=0.4, alpha=1.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        mat.blend_method = "BLEND"
    return mat


def make_tex_mat(name, path, metallic=0.0, roughness=0.3, emit_path=None, emit_strength=0.0):
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


def add_wall_lathe(name, profile_rd, mat, segs=64, cap_front=False, planar_uv=False, max_r_mm=36.5):
    """Lathe around Blender -Y axis (d_mm = distance off wall toward -Y; +X right, +Z up)."""
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new("UVMap")
    d_min = min(d for _, d in profile_rd)
    d_max = max(d for _, d in profile_rd)
    d_span = max(1e-4, d_max - d_min)

    rings = []
    for r_mm, d_mm in profile_rd:
        r = r_mm * MM
        y = -d_mm * MM
        ring = []
        for i in range(segs):
            a = (i / segs) * math.pi * 2.0
            ring.append(bm.verts.new((math.cos(a) * r, y, math.sin(a) * r)))
        rings.append((ring, (d_mm - d_min) / d_span))

    for ri in range(len(rings) - 1):
        r0, v0 = rings[ri]
        r1, v1 = rings[ri + 1]
        for i in range(segs):
            ni = (i + 1) % segs
            f = bm.faces.new((r0[i], r1[i], r1[ni], r0[ni]))
            f.smooth = True
            for loop in f.loops:
                if planar_uv:
                    u = 0.5 + (loop.vert.co.x / (2.0 * max_r_mm * MM))
                    v = 0.5 + (loop.vert.co.z / (2.0 * max_r_mm * MM))
                    loop[uv_layer].uv = (u, v)
                else:
                    # Cylindrical brushed UV along ring circumference
                    ang = math.atan2(loop.vert.co.z, loop.vert.co.x)
                    u = (ang + math.pi) / (2.0 * math.pi)
                    v = (-loop.vert.co.y / MM - d_min) / d_span
                    loop[uv_layer].uv = (u, v)

    if cap_front and profile_rd[-1][0] > 0.1:
        rt, _ = rings[-1]
        vc = bm.verts.new((0.0, -profile_rd[-1][1] * MM, 0.0))
        for i in range(segs):
            ni = (i + 1) % segs
            f = bm.faces.new((vc, rt[ni], rt[i]))
            f.smooth = True
            for loop in f.loops:
                u = 0.5 + (loop.vert.co.x / (2.0 * max_r_mm * MM))
                v = 0.5 + (loop.vert.co.z / (2.0 * max_r_mm * MM))
                loop[uv_layer].uv = (u, v)

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name + "M")
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def build_nest_thermostat():
    clear_scene()

    p_steel = generate_stainless_ring_texture()
    p_face, p_face_emit = generate_nest_face_textures()

    mat_base = make_mat("Nest_WallBase", (0.14, 0.15, 0.17), metallic=0.10, roughness=0.58)
    mat_steel = make_tex_mat("Nest_StainlessRing", p_steel, metallic=0.95, roughness=0.20)
    mat_face = make_tex_mat("Nest_DisplayFace", p_face, metallic=0.05, roughness=0.14, emit_path=p_face_emit, emit_strength=1.15)
    mat_glass = make_mat("Nest_CoverGlass", (1.0, 1.0, 1.0), metallic=0.0, roughness=0.04, alpha=0.14)

    # 1. Recessed Matte-Charcoal Wall Mounting Base Collar (d = 0.0 .. 10.8 mm, Ø 78 -> 80 mm)
    base_prof = [
        (38.5, 0.0),
        (39.2, 1.5),
        (39.6, 9.8),
        (38.0, 10.8),
    ]
    add_wall_lathe("Nest_WallBase", base_prof, mat_base, segs=64)

    # 2. Iconic Rotating Brushed Stainless Steel Outer Dial Ring (Ø 84.0 mm exact official spec!, d = 9.2 .. 28.0 mm)
    ring_prof = [
        (39.2, 9.2),
        (41.4, 10.6),
        (42.0, 13.5),   # Exact 84.0 mm outer diameter!
        (42.0, 24.5),   # Smooth straight cylindrical metal grip surface
        (41.2, 26.8),
        (39.6, 28.0),   # Chamfered gleaming metal bezel rim
        (37.2, 28.1),
        (36.4, 27.2),   # Inner seat for the mirror-glass face
    ]
    add_wall_lathe("Nest_StainlessRing", ring_prof, mat_steel, segs=64)

    # 3. Gently Domed Mirror-Black Bezel + 53 mm Circular Color Display (d = 27.3 .. 29.8 mm, planar UV mapped -> ZERO z-fighting!)
    face_prof = []
    steps = 10
    for s in range(steps + 1):
        t = s / steps  # 0 at rim -> 1 near center
        r = 36.5 * (1.0 - t * 0.96)
        dome = 2.4 * math.sin(t * math.pi * 0.5)
        face_prof.append((r, 27.3 + dome))
    add_wall_lathe("Nest_DisplayFace", face_prof, mat_face, segs=64, cap_front=True, planar_uv=True, max_r_mm=36.5)

    # 4. Crystal-Clear Curved Front Cover Lens (strictly +1.1 mm proud of display -> ZERO z-fighting, real curved highlight!)
    glass_prof = []
    for s in range(steps + 1):
        t = s / steps
        r = 36.6 * (1.0 - t * 0.96)
        dome = 2.6 * math.sin(t * math.pi * 0.5)
        glass_prof.append((r, 28.4 + dome))
    add_wall_lathe("Nest_CoverGlass", glass_prof, mat_glass, segs=64, cap_front=True, planar_uv=True, max_r_mm=36.6)

    out_blend = os.path.join(OUT_DIR, "nest_thermostat.blend")
    bpy.ops.wm.save_as_mainfile(filepath=out_blend)
    print(f"SAVED: {out_blend}")


if __name__ == "__main__":
    build_nest_thermostat()
