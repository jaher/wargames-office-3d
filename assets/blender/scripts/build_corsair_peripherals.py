#!/usr/bin/env python3
"""Build accurate Corsair K70 PRO TKL Black Aluminum Keyboard AND Corsair M75 / DARK CORE Wireless Mouse in headless Blender.

Geometry & PBR material modeling only (rendered live in Three.js in the browser — ZERO Blender Cycles rendering!).
Crafted to match real Corsair flagship peripherals:
1. Corsair K70 PRO TKL (366 x 135 x 38 mm):
   - Aircraft-grade brushed black anodized aluminum top plate with chamfered edges
   - Iconic top-right knurled metallic aluminum volume roller + dedicated mute/media/iCUE control cluster
   - Crisp centered Corsair sails emblem badge on top bezel
   - Sculpted matte-black double-shot PBT keycaps (full TKL ANSI layout) with subtle cool white/cyan under-key glow
   - Braided USB-C cable exit at rear
2. Corsair M75 Wireless Black Mouse (128 x 65 x 41 mm):
   - Sculpted sleek matte-black ergonomic/ambidextrous gaming shell with contoured split L/R click paddles
   - Tactile grooved dark-rubber scroll wheel + DPI switch + dual left side thumb buttons
   - Subtle glowing Corsair sails emblem on the rear palm rest

Outputs:
  assets/blender/corsair_k70_kb.blend
  assets/blender/corsair_mouse.blend
"""
import math
import os
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


def make_mat(name, color, metallic=0.2, roughness=0.45, emit=None, emit_strength=0.0):
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


def make_tex_mat(name, path, metallic=0.3, roughness=0.38, emit_path=None, emit_strength=0.0):
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
        if emit_path:
            etex = nt.nodes.new("ShaderNodeTexImage")
            eimg = bpy.data.images.load(emit_path)
            eimg.pack()
            etex.image = eimg
            nt.links.new(etex.outputs["Color"], bsdf.inputs["Emission"])
        else:
            nt.links.new(tex.outputs["Color"], bsdf.inputs["Emission"])
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


def add_cyl(name, r, depth, loc, rot, mat, verts=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(mat)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def generate_sails_badge(filename, bg=(18, 20, 25), fg=(214, 224, 238), size=256):
    img = Image.new("RGB", (size, size), bg)
    d = ImageDraw.Draw(img)
    s = size / 256.0
    # Iconic 3-sail Corsair ship emblem
    d.polygon([(int(62 * s), int(206 * s)), (int(88 * s), int(92 * s)), (int(108 * s), int(206 * s))], fill=fg)
    d.polygon([(int(106 * s), int(206 * s)), (int(138 * s), int(56 * s)), (int(162 * s), int(206 * s))], fill=fg)
    d.polygon([(int(160 * s), int(206 * s)), (int(184 * s), int(106 * s)), (int(202 * s), int(206 * s))], fill=fg)
    path = os.path.join(TEX_DIR, filename)
    img.save(path)
    return path


def _load_font(size, condensed=False):
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf" if condensed else "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]
    for p in candidates:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def _draw_centered_text(draw, text, cx, cy, font, fill):
    bb = draw.textbbox((0, 0), text, font=font)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    draw.text((cx - tw / 2 - bb[0], cy - th / 2 - bb[1]), text, font=font, fill=fill)


def _draw_corsair_sails(draw, cx, cy, scale, fill):
    # Authentic Corsair curved billowing 3-sail emblem centered at (cx, cy)
    def pt(px, py):
        return (cx + px * scale, cy + py * scale)
    # Left billowing sail
    draw.polygon([
        pt(-0.56, 0.36), pt(-0.50, 0.04), pt(-0.34, -0.34),
        pt(-0.26, -0.02), pt(-0.28, 0.36)
    ], fill=fill)
    # Center tall billowing main sail
    draw.polygon([
        pt(-0.22, 0.38), pt(-0.14, -0.08), pt(0.06, -0.60),
        pt(0.20, -0.14), pt(0.18, 0.38)
    ], fill=fill)
    # Right billowing sail
    draw.polygon([
        pt(0.24, 0.36), pt(0.30, 0.04), pt(0.44, -0.26),
        pt(0.56, 0.06), pt(0.52, 0.36)
    ], fill=fill)
    # Curved ship hull keel underneath
    draw.polygon([
        pt(-0.56, 0.44), pt(0.58, 0.44),
        pt(0.42, 0.56), pt(-0.42, 0.56)
    ], fill=fill)


def generate_k70_top_plate_texture(W_mm, D_mm, logo_x_mm, logo_y_mm):
    """2048x1024 brushed anodized black aluminum top deck with integrated Corsair sails logo (ZERO floating decal planes!)."""
    import random
    rng = random.Random(70)
    tw, th = 2048, 1024
    img = Image.new("RGB", (tw, th), (24, 27, 32))
    px = img.load()
    # Authentic horizontal brushed anodized aluminum grain
    for y in range(th):
        row_delta = rng.randint(-4, 4)
        base_r = max(14, min(38, 23 + row_delta))
        base_g = max(16, min(42, 26 + row_delta))
        base_b = max(20, min(48, 31 + row_delta))
        for x in range(0, tw, 4):
            sd = rng.randint(-2, 2)
            c = (base_r + sd, base_g + sd, base_b + sd)
            px[x, y] = c
            px[x + 1, y] = c
            px[x + 2, y] = c
            px[x + 3, y] = c

    d = ImageDraw.Draw(img)
    # Subtle machined silver chamfer highlight along outer perimeter
    d.rectangle([6, 6, tw - 7, th - 7], outline=(58, 64, 76), width=4)
    d.rectangle([14, 14, tw - 15, th - 15], outline=(16, 18, 22), width=3)

    # Subtle laser-etched "K70 PRO" marking on the top-left brushed aluminum bezel
    f_badge = _load_font(22, condensed=True)
    d.text((54, 14), "K70 PRO TKL", font=f_badge, fill=(92, 100, 114))

    # Crisp metallic silver-white Corsair sails emblem above the arrow keys (matching real K70 PRO TKL!)
    # UV mapping: u = (x + W/2)/W, v_img = (D/2 - y)/D  (PIL y=0 is top = +Y rear of keyboard)
    lx = int(((logo_x_mm + W_mm * 0.5) / W_mm) * tw)
    ly = int(((D_mm * 0.5 - logo_y_mm) / D_mm) * th)
    _draw_corsair_sails(d, lx, ly, scale=54, fill=(184, 194, 210))

    path = os.path.join(TEX_DIR, "corsair_k70_topplate.png")
    img.save(path)
    return path


def generate_k70_keycap_atlas(key_specs):
    """Generate 2048x2048 double-shot PBT keycap legend atlas + shine-through emission mask.

    Every keycap gets its own crisp 204x204 UV tile (cell 99 is solid matte PBT for keycap skirts).
    Because legends are UV-mapped directly onto each keycap's top mesh face, z-fighting is impossible.
    """
    import random
    rng = random.Random(42)
    N = 10
    ATLAS = 2048
    CELL = ATLAS // N  # 204 px per keycap

    base = Image.new("RGB", (ATLAS, ATLAS), (24, 26, 31))
    emit = Image.new("RGB", (ATLAS, ATLAS), (0, 0, 0))
    db = ImageDraw.Draw(base)
    de = ImageDraw.Draw(emit)

    # Subtle matte PBT micro-grain across the atlas
    pb = base.load()
    for _ in range(160000):
        rx = rng.randrange(ATLAS)
        ry = rng.randrange(ATLAS)
        dv = rng.randint(-4, 4)
        pb[rx, ry] = (24 + dv, 26 + dv, 31 + dv)

    # Crisp shine-through legend color: cool crisp ice-white (matching Corsair white/ice-cyan RGB backlight)
    fg_base = (228, 240, 255)
    fg_sub = (182, 206, 232)
    fg_emit = (176, 218, 255)
    fg_emit_sub = (128, 174, 218)
    fg_esc_bg = (30, 34, 42)

    f_big = _load_font(62)
    f_med = _load_font(44)
    f_sm = _load_font(34, condensed=True)
    f_xs = _load_font(27, condensed=True)
    f_sym = _load_font(40)

    def draw_win_icon(draw, cx, cy, sz, col):
        gap = max(2, sz // 10)
        h = (sz - gap) // 2
        draw.rectangle([cx - h - gap // 2, cy - h - gap // 2, cx - gap // 2, cy - gap // 2], fill=col)
        draw.rectangle([cx + gap // 2, cy - h - gap // 2, cx + h + gap // 2, cy - gap // 2], fill=col)
        draw.rectangle([cx - h - gap // 2, cy + gap // 2, cx - gap // 2, cy + h + gap // 2], fill=col)
        draw.rectangle([cx + gap // 2, cy + gap // 2, cx + h + gap // 2, cy + h + gap // 2], fill=col)

    def draw_menu_icon(draw, cx, cy, sz, col):
        r = sz // 2
        draw.rectangle([cx - r, cy - r, cx + r, cy + r], outline=col, width=4)
        for dy in (-r // 2, 0, r // 2):
            draw.line([cx - r + 7, cy + dy, cx + r - 7, cy + dy], fill=col, width=4)

    def draw_arrow(draw, cx, cy, direction, sz, col):
        r = sz // 2
        if direction == "UP":
            pts = [(cx, cy - r), (cx + r, cy + r), (cx - r, cy + r)]
        elif direction == "DOWN":
            pts = [(cx, cy + r), (cx + r, cy - r), (cx - r, cy - r)]
        elif direction == "LEFT":
            pts = [(cx - r, cy), (cx + r, cy - r), (cx + r, cy + r)]
        else:
            pts = [(cx + r, cy), (cx - r, cy - r), (cx - r, cy + r)]
        draw.polygon(pts, fill=col)

    def draw_game_icon(draw, cx, cy, sz, col):
        # Crosshair / Game Mode icon
        r = sz // 2
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=col, width=5)
        draw.ellipse([cx - r // 3, cy - r // 3, cx + r // 3, cy + r // 3], fill=col)
        draw.line([cx - r - 6, cy, cx - r // 2, cy], fill=col, width=5)
        draw.line([cx + r // 2, cy, cx + r + 6, cy], fill=col, width=5)
        draw.line([cx, cy - r - 6, cx, cy - r // 2], fill=col, width=5)
        draw.line([cx, cy + r // 2, cx, cy + r + 6], fill=col, width=5)

    def draw_media_icon(draw, cx, cy, sz, col):
        # Play / Pause icon
        r = sz // 2
        draw.polygon([(cx - r, cy - r + 2), (cx - 2, cy), (cx - r, cy + r - 2)], fill=col)
        draw.rectangle([cx + 5, cy - r + 3, cx + 13, cy + r - 3], fill=col)
        draw.rectangle([cx + 19, cy - r + 3, cx + 27, cy + r - 3], fill=col)

    uv_map = {}
    for idx, spec in enumerate(key_specs):
        col_i = idx % N
        row_i = idx // N
        x0, y0 = col_i * CELL, row_i * CELL
        x1, y1 = x0 + CELL, y0 + CELL

        # Compute actual physical top-face aspect ratio so wide keys (TAB, CAPS, SHIFT, ENTER,
        # BACKSPACE, CTRL, WIN, ALT, SPACE) render at true 1:1 undistorted aspect ratio in 3D!
        w_u = spec.get("w_u", 1.0)
        is_low = bool(spec.get("low"))
        top_w_mm = w_u * 19.05 - 0.95 - 4.2
        top_d_mm = (14.6 if is_low else (19.05 - 0.95)) - 4.2
        aspect = max(1.0, top_w_mm / max(4.0, top_d_mm))
        cw = max(CELL, int(round(CELL * aspect)))
        ch = CELL
        cx, cy = cw // 2, ch // 2

        bg_c = fg_esc_bg if spec.get("accent") else (22, 24, 29)
        tile_b = Image.new("RGB", (cw, ch), bg_c)
        tile_e = Image.new("RGB", (cw, ch), (0, 0, 0))
        tb = ImageDraw.Draw(tile_b)
        te = ImageDraw.Draw(tile_e)
        # Subtle dished top rim bevel inside the keycap top face
        tb.rectangle([6, 6, cw - 7, ch - 7], outline=(36, 40, 48), width=2)

        top_lbl = spec.get("top", "")
        bot_lbl = spec.get("bot", "")
        icon = spec.get("icon")

        if icon == "SPACE":
            # Authentic Corsair subtle diagonal textured thumb bar + crisp centered accent bar
            for gx in range(28, cw - 28, 22):
                tb.line([(gx, 26), (gx + 26, ch - 26)], fill=(31, 35, 43), width=3)
            tb.rounded_rectangle([cx - 64, cy - 4, cx + 64, cy + 4], radius=4, fill=(140, 178, 214))
            te.rounded_rectangle([cx - 64, cy - 4, cx + 64, cy + 4], radius=4, fill=(108, 160, 212))
        elif icon == "WIN":
            draw_win_icon(tb, cx, cy, 48, fg_base)
            draw_win_icon(te, cx, cy, 48, fg_emit)
        elif icon == "MENU":
            draw_menu_icon(tb, cx, cy, 44, fg_base)
            draw_menu_icon(te, cx, cy, 44, fg_emit)
        elif icon in ("UP", "DOWN", "LEFT", "RIGHT"):
            draw_arrow(tb, cx, cy, icon, 44, fg_base)
            draw_arrow(te, cx, cy, icon, 44, fg_emit)
        elif icon == "GAME":
            draw_game_icon(tb, cx, cy, 52, (245, 195, 72))
            draw_game_icon(te, cx, cy, 52, (230, 160, 45))
        elif icon == "MEDIA":
            draw_media_icon(tb, cx, cy, 48, fg_base)
            draw_media_icon(te, cx, cy, 48, fg_emit)
        elif top_lbl and bot_lbl:
            # Dual-legend key (number row / punctuation): secondary shifted symbol upper, primary lower
            if top_lbl == "_":
                tb.rectangle([cx - 22, cy - 26, cx + 22, cy - 19], fill=fg_sub)
                te.rectangle([cx - 22, cy - 26, cx + 22, cy - 19], fill=fg_emit_sub)
            else:
                _draw_centered_text(tb, top_lbl, cx, cy - 34, f_sym, fg_sub)
                _draw_centered_text(te, top_lbl, cx, cy - 34, f_sym, fg_emit_sub)
            _draw_centered_text(tb, bot_lbl, cx, cy + 28, f_med, fg_base)
            _draw_centered_text(te, bot_lbl, cx, cy + 28, f_med, fg_emit)
        elif top_lbl:
            if len(top_lbl) == 1:
                fnt = f_big
            elif len(top_lbl) <= 3:
                fnt = f_med
            elif len(top_lbl) <= 5:
                fnt = f_sm if aspect < 1.3 else f_med
            else:
                fnt = f_sm
            _draw_centered_text(tb, top_lbl, cx, cy - 4, fnt, fg_base)
            _draw_centered_text(te, top_lbl, cx, cy - 4, fnt, fg_emit)

        if cw != CELL:
            tile_b = tile_b.resize((CELL, CELL), Image.Resampling.LANCZOS)
            tile_e = tile_e.resize((CELL, CELL), Image.Resampling.LANCZOS)
        base.paste(tile_b, (x0, y0))
        emit.paste(tile_e, (x0, y0))

        # Store Blender UV bounds (remember Blender UV v=0 is bottom, PIL y=0 is top!)
        pad = 8
        u0 = (x0 + pad) / ATLAS
        u1 = (x1 - pad) / ATLAS
        v1 = 1.0 - (y0 + pad) / ATLAS
        v0 = 1.0 - (y1 - pad) / ATLAS
        uv_map[idx] = (u0, v0, u1, v1)

    # Cell 99 (bottom-right) is clean matte-black PBT skirt swatch (zero emission)
    sx0, sy0 = 9 * CELL, 9 * CELL
    db.rectangle([sx0, sy0, ATLAS - 1, ATLAS - 1], fill=(20, 22, 27))
    de.rectangle([sx0, sy0, ATLAS - 1, ATLAS - 1], fill=(0, 0, 0))
    uv_map["SKIRT"] = (
        (sx0 + 24) / ATLAS,
        1.0 - (ATLAS - 24) / ATLAS,
        (ATLAS - 24) / ATLAS,
        1.0 - (sy0 + 24) / ATLAS,
    )

    p_base = os.path.join(TEX_DIR, "corsair_k70_legends.png")
    p_emit = os.path.join(TEX_DIR, "corsair_k70_legends_emit.png")
    base.save(p_base)
    emit.save(p_emit)
    return p_base, p_emit, uv_map


def _append_sculpted_keycap(bm, uv_layer, cx, cy, z_base, w_base, d_base, h_front, h_back, uv_top, uv_skirt, convex_top=False):
    """Append a realistic tapered double-shot PBT OEM keycap directly into `bm` with crisp top UVs (ZERO z-fighting!)."""
    hb_w = w_base * 0.5
    hb_d = d_base * 0.5
    # Tapered top rim (2.1mm inward each side, matching real 1.5mm thick PBT OEM keycaps)
    taper_x = min(2.1 * MM, hb_w * 0.28)
    taper_y = min(2.1 * MM, hb_d * 0.28)
    ht_w = hb_w - taper_x
    ht_d = hb_d - taper_y
    # Subtle micro-bevel ring just below top face
    hm_w = ht_w + 0.55 * MM
    hm_d = ht_d + 0.55 * MM

    # Base ring (z = z_base)
    b0 = bm.verts.new((cx - hb_w, cy - hb_d, z_base))
    b1 = bm.verts.new((cx + hb_w, cy - hb_d, z_base))
    b2 = bm.verts.new((cx + hb_w, cy + hb_d, z_base))
    b3 = bm.verts.new((cx - hb_w, cy + hb_d, z_base))

    # Shoulder bevel ring (0.55mm below top)
    zf = z_base + h_front
    zb = z_base + h_back
    m0 = bm.verts.new((cx - hm_w, cy - hm_d, zf - 0.55 * MM))
    m1 = bm.verts.new((cx + hm_w, cy - hm_d, zf - 0.55 * MM))
    m2 = bm.verts.new((cx + hm_w, cy + hm_d, zb - 0.55 * MM))
    m3 = bm.verts.new((cx - hm_w, cy + hm_d, zb - 0.55 * MM))

    # Top face corners + subtle cylindrical scoop (3x2 grid along X so finger dish reads cleanly!)
    dish = 0.55 * MM if convex_top else -0.45 * MM
    t_bl = bm.verts.new((cx - ht_w, cy - ht_d, zf))
    t_bm = bm.verts.new((cx, cy - ht_d, zf + dish))
    t_br = bm.verts.new((cx + ht_w, cy - ht_d, zf))
    t_tr = bm.verts.new((cx + ht_w, cy + ht_d, zb))
    t_tm = bm.verts.new((cx, cy + ht_d, zb + dish))
    t_tl = bm.verts.new((cx - ht_w, cy + ht_d, zb))

    su0, sv0, su1, sv1 = uv_skirt
    tu0, tv0, tu1, tv1 = uv_top
    tum = (tu0 + tu1) * 0.5

    def add_quad(v0, v1, v2, v3, uvs, smooth=False):
        f = bm.faces.new((v0, v1, v2, v3))
        f.smooth = smooth
        for loop, uv in zip(f.loops, uvs):
            loop[uv_layer].uv = uv
        return f

    skirt_uv = ((su0, sv0), (su1, sv0), (su1, sv1), (su0, sv1))

    # Lower skirts (4 sides)
    add_quad(b0, b1, m1, m0, skirt_uv, smooth=False)
    add_quad(b1, b2, m2, m1, skirt_uv, smooth=False)
    add_quad(b2, b3, m3, m2, skirt_uv, smooth=False)
    add_quad(b3, b0, m0, m3, skirt_uv, smooth=False)

    # Top micro-chamfer rim (front/back split into 2 quads to match top mid-verts)
    add_quad(m0, m1, t_br, t_bm, skirt_uv, smooth=True)
    # Use clean triangle/quads for split edges
    f_fl = bm.faces.new((m0, t_bm, t_bl))
    f_fl.smooth = True
    for loop, uv in zip(f_fl.loops, ((su0, sv0), (su1, sv1), (su0, sv1))):
        loop[uv_layer].uv = uv
    add_quad(m1, m2, t_tr, t_br, skirt_uv, smooth=True)
    add_quad(m2, m3, t_tl, t_tm, skirt_uv, smooth=True)
    f_br = bm.faces.new((m2, t_tm, t_tr))
    f_br.smooth = True
    for loop, uv in zip(f_br.loops, ((su0, sv0), (su1, sv1), (su0, sv1))):
        loop[uv_layer].uv = uv
    add_quad(m3, m0, t_bl, t_tl, skirt_uv, smooth=True)

    # Sculpted top legend face (left half + right half with exact UV coordinates — upright when viewed from front!)
    add_quad(t_bl, t_bm, t_tm, t_tl, ((tu0, tv0), (tum, tv0), (tum, tv1), (tu0, tv1)), smooth=True)
    add_quad(t_bm, t_br, t_tr, t_tm, ((tum, tv0), (tu1, tv0), (tu1, tv1), (tum, tv1)), smooth=True)


def build_corsair_k70():
    """Build a studio-accurate Corsair K70 PRO TKL (366 x 135 x 39.8 mm, 84 ANSI TKL keys + Game Mode + Media + Knurled Rotary Dial)."""
    clear_scene()

    # Official Corsair K70 PRO TKL dimensions
    W = 366.0 * MM
    D = 135.0 * MM
    PITCH = 19.05 * MM  # Exact industry-standard 0.75" mechanical key pitch
    TILT = math.radians(5.5)

    # Keybed origin in flat deck coordinates (z = 0.0 is brushed aluminum top surface!)
    # Total keybed width = 18.25u * 19.05mm = 347.6625mm -> centered with 9.17mm left/right bezels
    X0 = -(18.25 * PITCH) * 0.5
    # Row Y centers (y = 0u is bottom row, y = 5.25u is F-row -> 119.06mm keybed depth inside 135mm chassis)
    Y_BOTTOM = -D * 0.5 + 7.5 * MM + PITCH * 0.5  # Front bezel = 7.5mm, Rear bezel = 8.44mm

    # Exact OEM row heights (h_front, h_back) for authentic sculpted side profile
    ROW_PROFILE = {
        0: (10.8 * MM, 11.4 * MM),  # R0: Esc / F1-F12 (tall sculpted top row)
        1: (10.2 * MM, 10.6 * MM),  # R1: Number row
        2: (8.9 * MM, 9.6 * MM),    # R2: QWERTY
        3: (8.4 * MM, 8.9 * MM),    # R3: ASDF home row (lowest saddle)
        4: (9.2 * MM, 8.8 * MM),    # R4: ZXCV (angled slightly back)
        5: (9.4 * MM, 9.0 * MM),    # R5: Bottom row
    }

    # Exact 84 ANSI TKL keys + 2 top-right dedicated buttons (Game Mode, Media)
    # Format: (row_idx, y_u, x_u_start, w_u, legend_dict)
    key_specs = []

    def add_row_seq(row_idx, y_u, x_start, items):
        x = x_start
        for w_u, info in items:
            spec = dict(info)
            spec.update({"row": row_idx, "y_u": y_u, "x_u": x, "w_u": w_u})
            key_specs.append(spec)
            x += w_u
        return x

    # R0: F-Row (y = 5.25u) — EXACT 15.00u main block!
    add_row_seq(0, 5.25, 0.0, [(1.0, {"top": "ESC", "accent": True})])
    # 1.0u gap (x = 1.0..2.0) houses the 2 subtle status LEDs
    add_row_seq(0, 5.25, 2.0, [(1.0, {"top": f"F{i}"}) for i in range(1, 5)])
    add_row_seq(0, 5.25, 6.5, [(1.0, {"top": f"F{i}"}) for i in range(5, 9)])
    end_r0 = add_row_seq(0, 5.25, 11.0, [(1.0, {"top": f"F{i}"}) for i in range(9, 13)])
    assert abs(end_r0 - 15.0) < 1e-6, f"R0 width mismatch: {end_r0}"

    # R1: Number Row (y = 4.00u) — EXACT 15.00u main block + INS/HOME/PGUP
    end_r1 = add_row_seq(1, 4.00, 0.0, [
        (1.0, {"top": "~", "bot": "`"}),
        (1.0, {"top": "!", "bot": "1"}),
        (1.0, {"top": "@", "bot": "2"}),
        (1.0, {"top": "#", "bot": "3"}),
        (1.0, {"top": "$", "bot": "4"}),
        (1.0, {"top": "%", "bot": "5"}),
        (1.0, {"top": "^", "bot": "6"}),
        (1.0, {"top": "&", "bot": "7"}),
        (1.0, {"top": "*", "bot": "8"}),
        (1.0, {"top": "(", "bot": "9"}),
        (1.0, {"top": ")", "bot": "0"}),
        (1.0, {"top": "_", "bot": "-"}),
        (1.0, {"top": "+", "bot": "="}),
        (2.0, {"top": "BACKSPACE", "accent": True}),
    ])
    assert abs(end_r1 - 15.0) < 1e-6, f"R1 width mismatch: {end_r1}"
    add_row_seq(1, 4.00, 15.25, [
        (1.0, {"top": "INS", "accent": True}),
        (1.0, {"top": "HOME", "accent": True}),
        (1.0, {"top": "PGUP", "accent": True}),
    ])

    # R2: QWERTY Row (y = 3.00u) — EXACT 15.00u main block + DEL/END/PGDN
    end_r2 = add_row_seq(2, 3.00, 0.0, [
        (1.5, {"top": "TAB", "accent": True}),
        (1.0, {"top": "Q"}), (1.0, {"top": "W"}), (1.0, {"top": "E"}), (1.0, {"top": "R"}),
        (1.0, {"top": "T"}), (1.0, {"top": "Y"}), (1.0, {"top": "U"}), (1.0, {"top": "I"}),
        (1.0, {"top": "O"}), (1.0, {"top": "P"}),
        (1.0, {"top": "{", "bot": "["}),
        (1.0, {"top": "}", "bot": "]"}),
        (1.5, {"top": "|", "bot": "\\", "accent": True}),
    ])
    assert abs(end_r2 - 15.0) < 1e-6, f"R2 width mismatch: {end_r2}"
    add_row_seq(2, 3.00, 15.25, [
        (1.0, {"top": "DEL", "accent": True}),
        (1.0, {"top": "END", "accent": True}),
        (1.0, {"top": "PGDN", "accent": True}),
    ])

    # R3: ASDF Home Row (y = 2.00u) — EXACT 15.00u main block (Corsair sails logo sits at 16.75u!)
    end_r3 = add_row_seq(3, 2.00, 0.0, [
        (1.75, {"top": "CAPS", "accent": True}),
        (1.0, {"top": "A"}), (1.0, {"top": "S"}), (1.0, {"top": "D"}), (1.0, {"top": "F"}),
        (1.0, {"top": "G"}), (1.0, {"top": "H"}), (1.0, {"top": "J"}), (1.0, {"top": "K"}),
        (1.0, {"top": "L"}),
        (1.0, {"top": ":", "bot": ";"}),
        (1.0, {"top": '"', "bot": "'"}),
        (2.25, {"top": "ENTER", "accent": True}),
    ])
    assert abs(end_r3 - 15.0) < 1e-6, f"R3 width mismatch: {end_r3}"

    # R4: ZXCV Row (y = 1.00u) — EXACT 15.00u main block + Up Arrow
    end_r4 = add_row_seq(4, 1.00, 0.0, [
        (2.25, {"top": "SHIFT", "accent": True}),
        (1.0, {"top": "Z"}), (1.0, {"top": "X"}), (1.0, {"top": "C"}), (1.0, {"top": "V"}),
        (1.0, {"top": "B"}), (1.0, {"top": "N"}), (1.0, {"top": "M"}),
        (1.0, {"top": "<", "bot": ","}),
        (1.0, {"top": ">", "bot": "."}),
        (1.0, {"top": "?", "bot": "/"}),
        (2.75, {"top": "SHIFT", "accent": True}),
    ])
    assert abs(end_r4 - 15.0) < 1e-6, f"R4 width mismatch: {end_r4}"
    add_row_seq(4, 1.00, 16.25, [(1.0, {"icon": "UP", "accent": True})])

    # R5: Standard Bottom Row (y = 0.00u) — EXACT 15.00u (3x1.25 + 6.25 + 4x1.25) + Left/Down/Right Arrows
    end_r5 = add_row_seq(5, 0.00, 0.0, [
        (1.25, {"top": "CTRL", "accent": True}),
        (1.25, {"icon": "WIN", "accent": True}),
        (1.25, {"top": "ALT", "accent": True}),
        (6.25, {"icon": "SPACE", "convex": True}),
        (1.25, {"top": "ALT", "accent": True}),
        (1.25, {"top": "FN", "accent": True}),
        (1.25, {"icon": "MENU", "accent": True}),
        (1.25, {"top": "CTRL", "accent": True}),
    ])
    assert abs(end_r5 - 15.0) < 1e-6, f"R5 width mismatch: {end_r5}"
    add_row_seq(5, 0.00, 15.25, [
        (1.0, {"icon": "LEFT", "accent": True}),
        (1.0, {"icon": "DOWN", "accent": True}),
        (1.0, {"icon": "RIGHT", "accent": True}),
    ])

    # Top-right dedicated K70 PRO TKL buttons (Game Mode + Media Play/Pause beside the Rotary Dial)
    key_specs.append({"row": 0, "y_u": 5.25, "x_u": 15.25, "w_u": 0.82, "icon": "GAME", "accent": True, "low": True})
    key_specs.append({"row": 0, "y_u": 5.25, "x_u": 16.18, "w_u": 0.82, "icon": "MEDIA", "accent": True, "low": True})

    # Mathematical anti-overlap verification across EVERY pair of keys (guarantees ZERO keycap z-fighting!)
    GAP_MM = 0.95 * MM
    rects = []
    for sp in key_specs:
        cx = X0 + (sp["x_u"] + sp["w_u"] * 0.5) * PITCH
        cy = Y_BOTTOM + sp["y_u"] * PITCH
        wb = sp["w_u"] * PITCH - GAP_MM
        db_val = (14.6 * MM) if sp.get("low") else (PITCH - GAP_MM)
        rects.append((cx - wb * 0.5, cx + wb * 0.5, cy - db_val * 0.5, cy + db_val * 0.5, sp))
    for i in range(len(rects)):
        ax0, ax1, ay0, ay1, sa = rects[i]
        assert ax0 >= -W * 0.5 + 3 * MM and ax1 <= W * 0.5 - 3 * MM, f"Key out of X bounds: {sa}"
        assert ay0 >= -D * 0.5 + 3 * MM and ay1 <= D * 0.5 - 3 * MM, f"Key out of Y bounds: {sa}"
        for j in range(i + 1, len(rects)):
            bx0, bx1, by0, by1, sb = rects[j]
            ov_x = min(ax1, bx1) - max(ax0, bx0)
            ov_y = min(ay1, by1) - max(ay0, by0)
            assert not (ov_x > -0.3 * MM and ov_y > -0.3 * MM), f"Key overlap detected: {sa} vs {sb}"

    # Generate high-res textures (2048x1024 brushed aluminum top deck + 2048x2048 PBT keycap legend atlas)
    logo_x_mm = (X0 + 16.75 * PITCH) / MM
    logo_y_mm = (Y_BOTTOM + 2.00 * PITCH) / MM
    p_topplate = generate_k70_top_plate_texture(W / MM, D / MM, logo_x_mm, logo_y_mm)
    p_atlas, p_atlas_emit, uv_map = generate_k70_keycap_atlas(key_specs)

    # PBR Materials
    top_plate_mat = make_tex_mat("CorsairKB_BrushedAlu", p_topplate, metallic=0.82, roughness=0.30)
    alu_edge_mat = make_mat("CorsairKB_AluEdge", (0.045, 0.050, 0.058), metallic=0.84, roughness=0.32)
    chassis_bot = make_mat("CorsairKB_Bottom", (0.016, 0.018, 0.022), metallic=0.08, roughness=0.72)
    rubber_foot = make_mat("CorsairKB_RubberFoot", (0.012, 0.013, 0.016), metallic=0.0, roughness=0.92)
    switch_housing = make_mat("CorsairKB_SwitchHousing", (0.018, 0.020, 0.024), metallic=0.05, roughness=0.62)
    rgb_led_mat = make_mat("CorsairKB_RGBUnder", (0.45, 0.82, 1.0), 0.0, 0.22, (0.45, 0.82, 1.0), 1.35)
    status_led_mat = make_mat("CorsairKB_StatusLED", (0.88, 0.94, 1.0), 0.0, 0.25, (0.85, 0.92, 1.0), 0.75)
    roller_alu = make_mat("CorsairKB_RotaryDial", (0.36, 0.40, 0.46), metallic=0.92, roughness=0.24)
    keycap_mat = make_tex_mat("CorsairKB_KeycapPBT", p_atlas, metallic=0.04, roughness=0.66, emit_path=p_atlas_emit, emit_strength=0.65)

    created = []

    # 1. Sculpted Tapered Bottom Housing (z = -15.5mm .. -2.2mm, strictly below top plate -> ZERO z-fighting!)
    bm_bot = bmesh.new()
    hw_t, hd_t = W * 0.5 - 1.2 * MM, D * 0.5 - 1.2 * MM
    hw_b, hd_b = W * 0.5 - 5.2 * MM, D * 0.5 - 5.0 * MM
    vb = [
        bm_bot.verts.new((-hw_b, -hd_b, -15.5 * MM)),
        bm_bot.verts.new((hw_b, -hd_b, -15.5 * MM)),
        bm_bot.verts.new((hw_b, hd_b, -15.5 * MM)),
        bm_bot.verts.new((-hw_b, hd_b, -15.5 * MM)),
    ]
    vt = [
        bm_bot.verts.new((-hw_t, -hd_t, -2.2 * MM)),
        bm_bot.verts.new((hw_t, -hd_t, -2.2 * MM)),
        bm_bot.verts.new((hw_t, hd_t, -2.2 * MM)),
        bm_bot.verts.new((-hw_t, hd_t, -2.2 * MM)),
    ]
    bm_bot.faces.new((vb[3], vb[2], vb[1], vb[0]))
    bm_bot.faces.new((vt[0], vt[1], vt[2], vt[3]))
    for i in range(4):
        ni = (i + 1) % 4
        bm_bot.faces.new((vb[i], vb[ni], vt[ni], vt[i]))
    me_bot = bpy.data.meshes.new("K70_BaseM")
    bm_bot.to_mesh(me_bot)
    bm_bot.free()
    obj_bot = bpy.data.objects.new("K70_Base", me_bot)
    bpy.context.scene.collection.objects.link(obj_bot)
    obj_bot.data.materials.append(chassis_bot)
    mod = obj_bot.modifiers.new("Bevel", "BEVEL")
    mod.width = 1.4 * MM
    mod.segments = 2
    bpy.context.view_layer.objects.active = obj_bot
    bpy.ops.object.modifier_apply(modifier=mod.name)
    created.append(obj_bot)

    # 4 rubber feet cleanly underneath z = -15.5mm (z = -16.8mm .. -15.5mm)
    for fi, (fx, fy) in enumerate([(-155 * MM, -52 * MM), (155 * MM, -52 * MM), (-155 * MM, 52 * MM), (155 * MM, 52 * MM)]):
        created.append(add_box(f"K70_Foot_{fi}", (24 * MM, 11 * MM, 1.3 * MM), (fx, fy, -16.15 * MM), rubber_foot, bevel=0.3 * MM))

    # 2. Brushed Black Anodized Aluminum Top Plate (z = -2.2mm .. 0.0mm) with planar top UVs for brushed grain + Corsair logo!
    bm_top = bmesh.new()
    uv_top_l = bm_top.loops.layers.uv.new("UVMap")
    hw, hd = W * 0.5, D * 0.5
    p_bot = [
        bm_top.verts.new((-hw, -hd, -2.2 * MM)),
        bm_top.verts.new((hw, -hd, -2.2 * MM)),
        bm_top.verts.new((hw, hd, -2.2 * MM)),
        bm_top.verts.new((-hw, hd, -2.2 * MM)),
    ]
    p_top = [
        bm_top.verts.new((-hw + 0.6 * MM, -hd + 0.6 * MM, 0.0)),
        bm_top.verts.new((hw - 0.6 * MM, -hd + 0.6 * MM, 0.0)),
        bm_top.verts.new((hw - 0.6 * MM, hd - 0.6 * MM, 0.0)),
        bm_top.verts.new((-hw + 0.6 * MM, hd - 0.6 * MM, 0.0)),
    ]
    f_up = bm_top.faces.new(p_top)
    f_up.material_index = 0
    for loop in f_up.loops:
        vx, vy = loop.vert.co.x, loop.vert.co.y
        loop[uv_top_l].uv = ((vx + hw) / W, (vy + hd) / D)
    f_dn = bm_top.faces.new(p_bot[::-1])
    f_dn.material_index = 1
    for i in range(4):
        ni = (i + 1) % 4
        fs = bm_top.faces.new((p_bot[i], p_bot[ni], p_top[ni], p_top[i]))
        fs.material_index = 1
    me_top = bpy.data.meshes.new("K70_AluTopPlateM")
    bm_top.to_mesh(me_top)
    bm_top.free()
    obj_top = bpy.data.objects.new("K70_AluTopPlate", me_top)
    bpy.context.scene.collection.objects.link(obj_top)
    obj_top.data.materials.append(top_plate_mat)
    obj_top.data.materials.append(alu_edge_mat)
    created.append(obj_top)

    # 3. Two Subtle Micro Status LEDs between ESC (0..1u) and F1 (2..3u) — cleanly proud of z=0.0
    for li, lx_u in enumerate([1.32, 1.68]):
        lx = X0 + lx_u * PITCH
        ly = Y_BOTTOM + 5.25 * PITCH
        created.append(add_cyl(f"K70_StatusCollar_{li}", 1.5 * MM, 0.45 * MM, (lx, ly, 0.25 * MM), (0, 0, 0), chassis_bot, 16))
        created.append(add_cyl(f"K70_StatusLED_{li}", 1.0 * MM, 0.25 * MM, (lx, ly, 0.56 * MM), (0, 0, 0), status_led_mat, 16))

    # 4. Signature K70 PRO TKL Top-Right Knurled Aluminum Multi-Function Rotary Dial (x = 17.70u, y = 5.25u)
    dial_x = X0 + 17.72 * PITCH
    dial_y = Y_BOTTOM + 5.25 * PITCH
    created.append(add_cyl("K70_DialBaseCollar", 9.4 * MM, 1.6 * MM, (dial_x, dial_y, 0.85 * MM), (0, 0, 0), chassis_bot, 32))
    # Knurled rotary cylinder (36 alternating ridge/valley teeth so metallic light catches the knurling!)
    bm_dial = bmesh.new()
    n_teeth = 36
    n_ring = n_teeth * 2
    r_out, r_in = 8.4 * MM, 7.85 * MM
    z_d0, z_d1, z_d2 = 1.65 * MM, 10.6 * MM, 11.4 * MM
    ring0, ring1, ring2 = [], [], []
    for i in range(n_ring):
        a = (i / n_ring) * math.pi * 2.0
        r = r_out if (i % 2 == 0) else r_in
        ring0.append(bm_dial.verts.new((dial_x + math.cos(a) * r, dial_y + math.sin(a) * r, z_d0)))
        ring1.append(bm_dial.verts.new((dial_x + math.cos(a) * r, dial_y + math.sin(a) * r, z_d1)))
        ring2.append(bm_dial.verts.new((dial_x + math.cos(a) * (r_in - 0.6 * MM), dial_y + math.sin(a) * (r_in - 0.6 * MM), z_d2)))
    for i in range(n_ring):
        ni = (i + 1) % n_ring
        bm_dial.faces.new((ring0[i], ring0[ni], ring1[ni], ring1[i]))
        bm_dial.faces.new((ring1[i], ring1[ni], ring2[ni], ring2[i]))
    bm_dial.faces.new(ring2)
    me_dial = bpy.data.meshes.new("K70_RotaryDialM")
    bm_dial.to_mesh(me_dial)
    bm_dial.free()
    obj_dial = bpy.data.objects.new("K70_RotaryDial", me_dial)
    bpy.context.scene.collection.objects.link(obj_dial)
    obj_dial.data.materials.append(roller_alu)
    created.append(obj_dial)

    # 5. Discrete Exposed Switch Housings + Subtle North-Facing Per-Key RGB Diffusers + All 86 Sculpted PBT Keycaps!
    bm_sw = bmesh.new()
    bm_led = bmesh.new()
    bm_keys = bmesh.new()
    uv_keys = bm_keys.loops.layers.uv.new("UVMap")

    def add_bm_box(bm, cx, cy, z0, z1, sx, sy):
        hx, hy = sx * 0.5, sy * 0.5
        v0 = bm.verts.new((cx - hx, cy - hy, z0))
        v1 = bm.verts.new((cx + hx, cy - hy, z0))
        v2 = bm.verts.new((cx + hx, cy + hy, z0))
        v3 = bm.verts.new((cx - hx, cy + hy, z0))
        v4 = bm.verts.new((cx - hx, cy - hy, z1))
        v5 = bm.verts.new((cx + hx, cy - hy, z1))
        v6 = bm.verts.new((cx + hx, cy + hy, z1))
        v7 = bm.verts.new((cx - hx, cy + hy, z1))
        bm.faces.new((v3, v2, v1, v0))
        bm.faces.new((v4, v5, v6, v7))
        bm.faces.new((v0, v1, v5, v4))
        bm.faces.new((v1, v2, v6, v5))
        bm.faces.new((v2, v3, v7, v6))
        bm.faces.new((v3, v0, v4, v7))

    for idx, sp in enumerate(key_specs):
        cx = X0 + (sp["x_u"] + sp["w_u"] * 0.5) * PITCH
        cy = Y_BOTTOM + sp["y_u"] * PITCH
        wb = sp["w_u"] * PITCH - GAP_MM
        is_low = bool(sp.get("low"))
        db_val = 14.6 * MM if is_low else (PITCH - GAP_MM)

        # Exposed MGX switch housing cleanly above z=0.05mm (zero overlap with aluminum top plate!)
        sw_w = min(13.6 * MM, wb - 1.6 * MM)
        sw_d = min(13.6 * MM, db_val - 1.6 * MM)
        add_bm_box(bm_sw, cx, cy, 0.06 * MM, 2.8 * MM, sw_w, sw_d)
        # Subtle north-facing translucent RGB LED window on top edge of switch housing
        led_w = min(sw_w - 2.4 * MM, 10.5 * MM)
        add_bm_box(bm_led, cx, cy + sw_d * 0.5 + 0.45 * MM, 0.25 * MM, 2.5 * MM, led_w, 0.9 * MM)

        # Sculpted double-shot PBT keycap hovering at z = 2.65mm (authentic K70 floating-keycap gap!)
        if is_low:
            hf, hb = 5.4 * MM, 5.8 * MM
        else:
            hf, hb = ROW_PROFILE[sp["row"]]
        _append_sculpted_keycap(
            bm_keys, uv_keys, cx, cy, 2.65 * MM, wb, db_val, hf, hb,
            uv_map[idx], uv_map["SKIRT"], convex_top=bool(sp.get("convex"))
        )

    for name, bm, mat in [
        ("K70_SwitchHousings", bm_sw, switch_housing),
        ("K70_PerKeyRGB", bm_led, rgb_led_mat),
        ("K70_Keycaps", bm_keys, keycap_mat),
    ]:
        me = bpy.data.meshes.new(name + "M")
        bm.to_mesh(me)
        bm.free()
        obj = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(obj)
        obj.data.materials.append(mat)
        created.append(obj)

    # 6. Rear USB-C port collar (centered on rear +Y edge, recessed flush into bottom housing)
    created.append(add_box("K70_USBC_Collar", (14 * MM, 6 * MM, 7.5 * MM), (0, D * 0.5 + 2.0 * MM, -8.5 * MM), chassis_bot, bevel=1.0 * MM))

    # 7. Apply ONE uniform 5.5° ergonomic tilt to the entire assembled keyboard & ground lowest vertex to exact Z = 0.000!
    pivot = bpy.data.objects.new("K70_Root", None)
    bpy.context.scene.collection.objects.link(pivot)
    for o in created:
        o.parent = pivot
    pivot.rotation_euler = (TILT, 0.0, 0.0)
    bpy.context.view_layer.update()

    # Compute exact world min Z across all meshes and shift cleanly so rubber feet sit flush on Z = 0.000
    min_z = 1e9
    for o in created:
        for corner in o.bound_box:
            wz = (o.matrix_world @ bpy.mathutils.Vector(corner)).z if hasattr(bpy, "mathutils") else (o.matrix_world @ __import__("mathutils").Vector(corner)).z
            if wz < min_z:
                min_z = wz
    pivot.location.z = -min_z
    bpy.context.view_layer.update()

    # Bake transforms cleanly into meshes and remove empty pivot
    bpy.ops.object.select_all(action="DESELECT")
    for o in created:
        o.select_set(True)
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.data.objects.remove(pivot, do_unlink=True)

    out_blend = os.path.join(OUT_DIR, "corsair_k70_kb.blend")
    bpy.ops.wm.save_as_mainfile(filepath=out_blend)
    print(f"SAVED: {out_blend} ({len(key_specs)} keys, zero overlaps)")


def build_corsair_mouse():
    clear_scene()
    p_sails = generate_sails_badge("corsair_mouse_sails.png", bg=(14, 16, 20), fg=(120, 210, 250))

    shell_matte = make_mat("CorsairMouse_MatteBlack", (0.028, 0.031, 0.038), metallic=0.06, roughness=0.48)
    grip_side = make_mat("CorsairMouse_SideGrip", (0.016, 0.018, 0.022), metallic=0.02, roughness=0.84)
    wheel_rubber = make_mat("CorsairMouse_Wheel", (0.020, 0.022, 0.026), metallic=0.08, roughness=0.68)
    trim_gloss = make_mat("CorsairMouse_Trim", (0.015, 0.017, 0.021), metallic=0.22, roughness=0.18)
    sails_glow = make_tex_mat("CorsairMouse_SailsRGB", p_sails, metallic=0.10, roughness=0.28, emit_strength=1.15)
    led_accent = make_mat("CorsairMouse_LED", (0.45, 0.80, 0.96), 0.0, 0.25, (0.45, 0.80, 0.96), 1.4)

    # Sculpted Corsair M75 Wireless aerodynamic silhouette (128 x 65 x 41 mm) via smooth lofted bmesh!
    bm = bmesh.new()
    # Longitudinal stations from rear (-Y = -64mm) to nose (+Y = +64mm)
    stations = [
        (-63 * MM, 18 * MM, 14 * MM, 3 * MM),
        (-52 * MM, 28 * MM, 28 * MM, 2 * MM),
        (-34 * MM, 32 * MM, 38 * MM, 1 * MM),
        (-12 * MM, 31.5 * MM, 41 * MM, 1 * MM),
        (12 * MM, 29.5 * MM, 37 * MM, 1 * MM),
        (34 * MM, 30.5 * MM, 26 * MM, 1.5 * MM),
        (54 * MM, 26 * MM, 15 * MM, 2.5 * MM),
        (64 * MM, 15 * MM, 7 * MM, 3.5 * MM),
    ]
    rings = []
    n_arc = 18
    for y, hw, top_h, bot_z in stations:
        ring = []
        for i in range(n_arc):
            ang = (i / n_arc) * math.pi * 2.0
            ca, sa = math.cos(ang), math.sin(ang)
            vx = ca * hw * (0.94 if sa < 0 else 1.0)
            if sa >= 0:
                vz = bot_z + (top_h - bot_z) * (math.sin(ang) ** 0.72)
            else:
                vz = bot_z + 1.2 * MM * (1.0 + sa)
            ring.append(bm.verts.new((vx, y, vz)))
        rings.append(ring)
    for r_i in range(len(rings) - 1):
        for i in range(n_arc):
            ni = (i + 1) % n_arc
            f = bm.faces.new((rings[r_i][i], rings[r_i][ni], rings[r_i + 1][ni], rings[r_i + 1][i]))
            f.smooth = True
    # Cap front & rear cleanly
    bm.faces.new(rings[0][::-1]).smooth = True
    bm.faces.new(rings[-1]).smooth = True
    me = bpy.data.meshes.new("CorsairMouse_BodyM")
    bm.to_mesh(me)
    bm.free()
    body = bpy.data.objects.new("CorsairMouse_Body", me)
    bpy.context.scene.collection.objects.link(body)
    body.data.materials.append(shell_matte)

    # Center split seam + scroll wheel well + grooved rubber scroll wheel + DPI button
    add_box("Mouse_CenterSeam", (1.6 * MM, 44 * MM, 2.0 * MM), (0, 42 * MM, 22 * MM), trim_gloss, rot=(-0.38, 0, 0))
    add_box("Mouse_WheelWell", (10 * MM, 24 * MM, 8 * MM), (0, 32 * MM, 25 * MM), trim_gloss, bevel=1.5 * MM, rot=(-0.26, 0, 0))
    add_cyl("Mouse_ScrollWheel", 8.5 * MM, 7.0 * MM, (0, 32 * MM, 28 * MM), (0, math.pi / 2, 0), wheel_rubber, 24)
    add_box("Mouse_DPIBtn", (5.5 * MM, 9.0 * MM, 3.0 * MM), (0, 14 * MM, 36.2 * MM), trim_gloss, bevel=0.8 * MM, rot=(-0.12, 0, 0))

    # Dual left-side sculpted thumb buttons (Corsair M75 signature side buttons!)
    add_box("Mouse_ThumbFront", (3.5 * MM, 16 * MM, 6.2 * MM), (-30.5 * MM, 12 * MM, 21 * MM), trim_gloss, bevel=1.0 * MM)
    add_box("Mouse_ThumbBack", (3.5 * MM, 16 * MM, 6.2 * MM), (-31.0 * MM, -7 * MM, 22 * MM), trim_gloss, bevel=1.0 * MM)

    # Subtle glowing Corsair sails emblem on the rear palm rest + crisp rear RGB accent strip
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0, -34 * MM, 38.4 * MM), rotation=(0.30, 0, 0))
    ms = bpy.context.active_object
    ms.name = "Mouse_CorsairSails"
    ms.scale = (14 * MM, 14 * MM, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    ms.data.materials.append(sails_glow)
    add_box("Mouse_RearAccentLED", (22 * MM, 2.5 * MM, 2.5 * MM), (0, -61 * MM, 9 * MM), led_accent, bevel=0.6 * MM)

    out_blend = os.path.join(OUT_DIR, "corsair_mouse.blend")
    bpy.ops.wm.save_as_mainfile(filepath=out_blend)
    print(f"SAVED: {out_blend}")


if __name__ == "__main__":
    build_corsair_k70()
    build_corsair_mouse()
